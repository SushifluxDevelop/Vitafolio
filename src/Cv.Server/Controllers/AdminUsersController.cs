using Cv.Server.Auth;
using Cv.Server.Data;
using Cv.Server.Errors;
using Cv.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Controllers;

/// <summary>
/// Account management for admins (server mode only). Rules: there is always at least one enabled admin; an admin cannot demote,
/// disable or delete themselves. Admins manage accounts only - they never see other users' application data.
/// </summary>
[ApiController]
[Route("api/admin/users")]
[Authorize(Policy = AuthConstants.AdminPolicy)]
[ServerModeOnly]
public sealed class AdminUsersController(
    AppDbContext db,
    Accounts accounts,
    SessionService sessions,
    TwoFactorService twoFactor,
    ActivityLogger activity,
    TimeProvider time) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<AdminUserDto>> List(CancellationToken ct)
    {
        var users = await db.Users.AsNoTracking().Where(u => !u.IsLocalOwner).OrderBy(u => u.NormalizedUsername).ToListAsync(ct);
        return users.Select(AdminUserDto.From).ToList();
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest body, CancellationToken ct)
    {
        // All fields in one answer (CreateAsync checks the account fields again, which is harmless)
        var errors = new FieldErrors();
        InputRules.Username(errors, "username", body.Username);
        InputRules.DisplayName(errors, "displayName", body.DisplayName);
        InputRules.Password(errors, "password", body.Password);
        InputRules.OneOf(errors, "role", body.Role, Roles.Admin, Roles.User);
        errors.ThrowIfAny();
        var user = await accounts.CreateAsync(body.Username, body.DisplayName, body.Password, body.Role!, ct);
        activity.Record(HttpContext, "user.created", user.Username, new { role = user.Role });
        await db.SaveChangesAsync(ct);
        return StatusCode(StatusCodes.Status201Created, AdminUserDto.From(user));
    }

    [HttpPatch("{id:guid}")]
    public async Task<AdminUserDto> Update(Guid id, [FromBody] UpdateUserRequest body, CancellationToken ct)
    {
        await using var _ = await AdminChangeGate.EnterAsync(ct);
        return await UpdateCoreAsync(id, body, ct);
    }

    private async Task<AdminUserDto> UpdateCoreAsync(Guid id, UpdateUserRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        if (body.DisplayName is not null) InputRules.DisplayName(errors, "displayName", body.DisplayName);
        if (body.Role is not null) InputRules.OneOf(errors, "role", body.Role, Roles.Admin, Roles.User);
        errors.ThrowIfAny();

        var user = await FindAsync(id, ct);
        var self = user.Id == User.RequiredUserId();
        var losesAdmin = user.Role == Roles.Admin && !user.Disabled
            && ((body.Role is not null && body.Role != Roles.Admin) || body.Disabled == true);
        if (losesAdmin && await accounts.OtherActiveAdminsAsync(user.Id, ct) == 0)
        {
            throw ApiException.Conflict("user.last_admin", "This is the last active administrator; it must stay an enabled administrator.");
        }
        await EnsureActorStillAdminAsync(ct);
        if (self && body.Role is not null && body.Role != Roles.Admin)
        {
            throw ApiException.Conflict("user.self_demote", "You cannot remove your own administrator role.");
        }
        if (self && body.Disabled == true) throw ApiException.Conflict("user.self_disable", "You cannot disable your own account.");

        if (body.DisplayName is not null && body.DisplayName.Trim() != user.DisplayName)
        {
            activity.Record(HttpContext, "user.updated", user.Username, new { displayName = new { from = user.DisplayName, to = body.DisplayName.Trim() } });
            user.DisplayName = body.DisplayName.Trim();
        }
        if (body.Role is not null && body.Role != user.Role)
        {
            activity.Record(HttpContext, "user.role_changed", user.Username, new { from = user.Role, to = body.Role });
            user.Role = body.Role;
        }
        var disabledNow = false;
        if (body.Disabled is { } disabled && disabled != user.Disabled)
        {
            activity.Record(HttpContext, disabled ? "user.disabled" : "user.enabled", user.Username);
            user.Disabled = disabled;
            disabledNow = disabled;
        }
        user.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);
        if (disabledNow) await sessions.RevokeAllAsync(user.Id, "user_disabled", null, ct);
        return AdminUserDto.From(user);
    }

    [HttpPost("{id:guid}/reset-2fa")]
    public async Task<AdminUserDto> ResetTwoFactor(Guid id, CancellationToken ct)
    {
        var user = await FindAsync(id, ct);
        await twoFactor.DisableAsync(user, ct);
        activity.Record(HttpContext, "twofactor.reset", user.Username);
        await db.SaveChangesAsync(ct);
        return AdminUserDto.From(user);
    }

    [HttpPost("{id:guid}/password")]
    public async Task<IActionResult> SetPassword(Guid id, [FromBody] SetPasswordRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Password(errors, "newPassword", body.NewPassword);
        errors.ThrowIfAny();

        var user = await FindAsync(id, ct);
        accounts.SetPassword(user, body.NewPassword!);
        activity.Record(HttpContext, "user.password_set", user.Username);
        await db.SaveChangesAsync(ct);
        var self = user.Id == User.RequiredUserId();
        await sessions.RevokeAllAsync(user.Id, "password_set", self ? User.SessionId() : null, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await using var _ = await AdminChangeGate.EnterAsync(ct);
        return await DeleteCoreAsync(id, ct);
    }

    private async Task<IActionResult> DeleteCoreAsync(Guid id, CancellationToken ct)
    {
        var user = await FindAsync(id, ct);
        if (user.Role == Roles.Admin && !user.Disabled && await accounts.OtherActiveAdminsAsync(user.Id, ct) == 0)
        {
            throw ApiException.Conflict("user.last_admin", "This is the last active administrator and cannot be deleted.");
        }
        await EnsureActorStillAdminAsync(ct);
        if (user.Id == User.RequiredUserId()) throw ApiException.Conflict("user.self_delete", "You cannot delete your own account.");
        db.Users.Remove(user);
        activity.Record(HttpContext, "user.deleted", user.Username, new { userId = user.Id });
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Inside the gate: the acting admin may have lost the role a moment ago through a concurrent request (the authorization ran before).
    /// </summary>
    private async Task EnsureActorStillAdminAsync(CancellationToken ct)
    {
        var actor = User.RequiredUserId();
        if (!await db.Users.AnyAsync(u => u.Id == actor && u.Role == Roles.Admin && !u.Disabled, ct))
        {
            throw ApiException.Forbidden("auth.forbidden", "You are not allowed to do this.");
        }
    }

    private async Task<User> FindAsync(Guid id, CancellationToken ct) =>
        await db.Users.FirstOrDefaultAsync(u => u.Id == id && !u.IsLocalOwner, ct)
        ?? throw ApiException.NotFound("user.not_found", "This account does not exist.");
}
