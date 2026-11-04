using Cv.Server.Auth;
using Cv.Server.Data;
using Cv.Server.Errors;
using Cv.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Controllers;

/// <summary>The signed-in user's own account: preferences, password, 2FA, sessions.</summary>
[ApiController]
[Route("api/account")]
[Authorize]
public sealed class AccountController(
    AppDbContext db,
    Accounts accounts,
    SessionService sessions,
    TwoFactorService twoFactor,
    ActivityLogger activity,
    SettingsService instanceSettings,
    TimeProvider time) : ControllerBase
{
    [HttpPut("preferences")]
    [AllowDuringTwoFactorSetup]
    public async Task<ActionResult<UserResponse>> Preferences([FromBody] PreferencesRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        if (body.Language is not null) InputRules.OneOf(errors, "language", body.Language, "de", "en");
        if (body.Theme is not null) InputRules.OneOf(errors, "theme", body.Theme, "system", "light", "dark");
        errors.ThrowIfAny();

        var user = await CurrentUserAsync(ct);
        if (body.Language is not null) user.Language = body.Language;
        if (body.Theme is not null) user.Theme = body.Theme;
        user.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);
        return new UserResponse(UserDto.From(user, (await instanceSettings.GetAsync(ct)).RequireTwoFactor));
    }

    [HttpPost("password")]
    [ServerModeOnly]
    [EnableRateLimiting(RateLimitPolicies.Password)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "currentPassword", body.CurrentPassword);
        InputRules.Password(errors, "newPassword", body.NewPassword);
        errors.ThrowIfAny();

        var user = await CurrentUserAsync(ct);
        if (!accounts.CheckPassword(user, body.CurrentPassword!))
        {
            throw ApiException.Field("currentPassword", "password.current_invalid", "The current password is wrong.");
        }
        accounts.SetPassword(user, body.NewPassword!);
        activity.Record(HttpContext, "account.password_changed", user.Username);
        await db.SaveChangesAsync(ct);
        // Other devices must sign in again with the new password; this one stays signed in
        await sessions.RevokeAllAsync(user.Id, "password_changed", User.SessionId(), ct);
        return NoContent();
    }

    [HttpPost("2fa/totp/setup")]
    [ServerModeOnly]
    [AllowDuringTwoFactorSetup]
    public async Task<IActionResult> TotpSetup(CancellationToken ct)
    {
        var user = await CurrentUserAsync(ct);
        if (user.TotpEnabled) throw ApiException.Conflict("twofactor.already_enabled", "Two-factor authentication is already on.");
        var (secret, uri) = twoFactor.BeginSetup(user);
        await db.SaveChangesAsync(ct);
        return Ok(new { secret, otpauthUri = uri });
    }

    [HttpPost("2fa/totp/enable")]
    [ServerModeOnly]
    [AllowDuringTwoFactorSetup]
    [EnableRateLimiting(RateLimitPolicies.TwoFactor)]
    public async Task<IActionResult> TotpEnable([FromBody] TotpEnableRequest body, CancellationToken ct)
    {
        // A stolen session alone must not be able to bind the account to the attacker's authenticator: the password is asked again,
        // except in the forced setup right after signing in (the password was just entered)
        var passwordNeeded = !await IsFreshForcedSetupAsync(ct);
        var errors = new FieldErrors();
        InputRules.Required(errors, "code", body.Code, 64);
        if (passwordNeeded) InputRules.Required(errors, "currentPassword", body.CurrentPassword);
        errors.ThrowIfAny();

        var user = await CurrentUserAsync(ct);
        if (passwordNeeded && !accounts.CheckPassword(user, body.CurrentPassword!))
        {
            throw ApiException.Field("currentPassword", "password.current_invalid", "The current password is wrong.", StatusCodes.Status403Forbidden);
        }
        if (user.TotpEnabled) throw ApiException.Conflict("twofactor.already_enabled", "Two-factor authentication is already on.");
        if (user.TotpPendingSecretProtected is null)
        {
            throw ApiException.Conflict("twofactor.setup_not_started", "Start the setup first to get a new secret.");
        }
        var codes = await twoFactor.ConfirmSetupAsync(user, body.Code!, ct)
            ?? throw ApiException.Field("code", "auth.twofactor_invalid", "The code is wrong. Check the time on your phone and try again.");
        await activity.RecordNowAsync(HttpContext, "twofactor.enabled", user.Username, ct: ct);
        return Ok(new { recoveryCodes = codes });
    }

    [HttpPost("2fa/disable")]
    [ServerModeOnly]
    [EnableRateLimiting(RateLimitPolicies.TwoFactor)]
    public async Task<IActionResult> TwoFactorDisable([FromBody] TwoFactorDisableRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "password", body.Password);
        InputRules.Required(errors, "code", body.Code, 64);
        errors.ThrowIfAny();

        if ((await instanceSettings.GetAsync(ct)).RequireTwoFactor)
        {
            throw ApiException.Conflict("twofactor.required_by_admin", "Two-factor authentication is required on this instance and cannot be turned off.");
        }
        var user = await CurrentUserAsync(ct);
        if (!user.TotpEnabled) throw ApiException.Conflict("twofactor.not_enabled", "Two-factor authentication is not on.");
        if (!accounts.CheckPassword(user, body.Password!))
        {
            throw ApiException.Field("password", "password.current_invalid", "The password is wrong.");
        }
        var factor = await twoFactor.VerifyAsync(user, body.Code, ct);
        if (factor == SecondFactor.AlreadyUsed) throw TwoFactorService.CodeAlreadyUsed(StatusCodes.Status400BadRequest);
        if (factor == SecondFactor.Invalid)
        {
            throw ApiException.Field("code", "auth.twofactor_invalid", "The code is wrong or was already used.");
        }
        await twoFactor.DisableAsync(user, ct);
        activity.Record(HttpContext, "twofactor.disabled", user.Username);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("sessions")]
    [ServerModeOnly]
    public async Task<IReadOnlyList<SessionDto>> Sessions(CancellationToken ct)
    {
        var id = User.RequiredUserId();
        var current = User.SessionId();
        var now = time.GetUtcNow().UtcDateTime;
        var rows = await db.Sessions.AsNoTracking()
            .Where(s => s.UserId == id && s.RevokedAt == null && s.ExpiresAt > now)
            .OrderByDescending(s => s.LastUsedAt)
            .ToListAsync(ct);
        return rows.Select(s => new SessionDto(s.Id.ToString(), s.CreatedAt, s.LastUsedAt, s.Ip, s.UserAgent, s.Id == current)).ToList();
    }

    [HttpDelete("sessions/{id:guid}")]
    [ServerModeOnly]
    public async Task<IActionResult> RevokeSession(Guid id, CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var session = await db.Sessions.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId && s.RevokedAt == null, ct)
            ?? throw ApiException.NotFound("session.not_found", "This session does not exist or has already ended.");
        await sessions.RevokeAsync(session, "revoked", ct);
        await activity.RecordNowAsync(HttpContext, "session.revoked", User.Username(), new { sessionId = id }, ct: ct);
        return NoContent();
    }

    /// <summary>How long after signing in the forced 2FA setup may skip the password.</summary>
    public static readonly TimeSpan FreshSession = TimeSpan.FromMinutes(10);

    private async Task<bool> IsFreshForcedSetupAsync(CancellationToken ct)
    {
        if (!User.HasClaim(AuthConstants.ClaimMustSetupTwoFactor, "true") || User.SessionId() is not { } sid) return false;
        var since = time.GetUtcNow().UtcDateTime - FreshSession;
        return await db.Sessions.AnyAsync(s => s.Id == sid && s.CreatedAt > since, ct);
    }

    private async Task<User> CurrentUserAsync(CancellationToken ct)
    {
        var id = User.RequiredUserId();
        return await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new ApiException(StatusCodes.Status401Unauthorized, "auth.invalid", "The account no longer exists.");
    }
}
