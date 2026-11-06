using Cv.Server.Auth;
using Cv.Server.Data;
using Cv.Server.Errors;
using Cv.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Controllers;

/// <summary>Sign-in, second factor, token refresh, sign-out, registration and "who am I".</summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    AppDbContext db,
    Accounts accounts,
    SessionService sessions,
    TwoFactorService twoFactor,
    LoginChallengeStore challenges,
    ActivityLogger activity,
    SettingsService instanceSettings,
    Security.AccountAttemptLimiter accountLimiter) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    [ServerModeOnly]
    [EnableRateLimiting(RateLimitPolicies.Login)]
    public async Task<IActionResult> Login([FromBody] LoginRequest body, CancellationToken ct)
    {
        // No rules are revealed here: only presence and an upper bound
        var errors = new FieldErrors();
        InputRules.Required(errors, "username", body.Username);
        InputRules.Required(errors, "password", body.Password);
        errors.ThrowIfAny();

        var normalized = Accounts.Normalize(body.Username!);
        accountLimiter.Attempt(HttpContext, "login", normalized);
        var user = await db.Users.FirstOrDefaultAsync(u => u.NormalizedUsername == normalized && !u.IsLocalOwner, ct);
        if (!accounts.CheckPassword(user, body.Password!))
        {
            await activity.RecordNowAsync(HttpContext, "auth.login_failed", body.Username, new { reason = "invalid_credentials" },
                user?.Id, user?.Username, ct);
            throw new ApiException(StatusCodes.Status401Unauthorized, "auth.invalid_credentials", "Username or password is wrong.");
        }
        if (user!.Disabled)
        {
            await activity.RecordNowAsync(HttpContext, "auth.login_failed", user.Username, new { reason = "disabled" }, user.Id, user.Username, ct);
            throw ApiException.Forbidden("auth.disabled", "This account is disabled.");
        }
        if (user.TotpEnabled)
        {
            await db.SaveChangesAsync(ct); // a re-hashed password
            return Ok(new { twoFactorRequired = true, challengeId = challenges.Create(user.Id) });
        }
        return Ok(await CompleteLoginAsync(user, "password", ct));
    }

    [HttpPost("login/2fa")]
    [AllowAnonymous]
    [ServerModeOnly]
    [EnableRateLimiting(RateLimitPolicies.TwoFactor)]
    public async Task<ActionResult<UserResponse>> LoginTwoFactor([FromBody] LoginTwoFactorRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "challengeId", body.ChallengeId, 128);
        InputRules.Required(errors, "code", body.Code, 64);
        errors.ThrowIfAny();

        var userId = challenges.Use(body.ChallengeId);
        if (userId is null)
        {
            throw new ApiException(StatusCodes.Status401Unauthorized, "auth.challenge_invalid",
                "The sign-in step has expired or was used too often. Please enter your password again.");
        }
        accountLimiter.Attempt(HttpContext, "2fa", userId.Value.ToString());
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null || user.Disabled)
        {
            challenges.Complete(body.ChallengeId!);
            throw ApiException.Forbidden("auth.disabled", "This account is disabled.");
        }
        var factor = await twoFactor.VerifyAsync(user, body.Code, ct);
        if (factor != SecondFactor.Totp && factor != SecondFactor.RecoveryCode)
        {
            await activity.RecordNowAsync(HttpContext, "auth.twofactor_failed", user.Username, null, user.Id, user.Username, ct);
            if (factor == SecondFactor.AlreadyUsed) throw TwoFactorService.CodeAlreadyUsed(StatusCodes.Status401Unauthorized);
            throw ApiException.Field("code", "auth.twofactor_invalid", "The code is wrong or was already used.", StatusCodes.Status401Unauthorized);
        }
        challenges.Complete(body.ChallengeId!);
        return await CompleteLoginAsync(user, factor == SecondFactor.Totp ? "totp" : "recovery_code", ct);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    [ServerModeOnly]
    public async Task<ActionResult<UserResponse>> Refresh(CancellationToken ct)
    {
        var user = await sessions.RefreshAsync(HttpContext, ct);
        return new UserResponse(UserDto.From(user, (await instanceSettings.GetAsync(ct)).RequireTwoFactor));
    }

    /// <summary>Ends the current session. Anonymous on purpose: it also works with an expired access token (via the refresh cookie).</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    [ServerModeOnly]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var session = await sessions.FindCurrentAsync(HttpContext, ct);
        if (session is not null && session.RevokedAt is null)
        {
            await sessions.RevokeAsync(session, "logout", ct);
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == session.UserId, ct);
            await activity.RecordNowAsync(HttpContext, "auth.logout", user?.Username, null, session.UserId, user?.Username, ct);
        }
        SessionService.ClearCookies(HttpContext);
        return NoContent();
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [ServerModeOnly]
    [EnableRateLimiting(RateLimitPolicies.Register)]
    public async Task<ActionResult<UserResponse>> Register([FromBody] SetupRequest body, CancellationToken ct)
    {
        if (!await db.Users.AnyAsync(ct)) throw ApiException.Conflict("setup.required", "The first account must be created through setup.");
        if (!(await instanceSettings.GetAsync(ct)).RegistrationOpen)
        {
            throw ApiException.Forbidden("registration.closed", "Registration is closed. Ask an administrator for an account.");
        }
        var user = await accounts.CreateAsync(body.Username, body.DisplayName, body.Password, Roles.User, ct);
        activity.Record(HttpContext, "auth.register", user.Username, null, user.Id, user.Username);
        await db.SaveChangesAsync(ct);
        return await CompleteLoginAsync(user, "register", ct);
    }

    [HttpPost("emergency-reset/request")]
    [AllowAnonymous]
    [ServerModeOnly]
    [EnableRateLimiting(RateLimitPolicies.EmergencyReset)]
    public async Task<IActionResult> RequestEmergencyReset(
        [FromServices] EmergencyToken emergencyToken,
        CancellationToken ct)
    {
        var admins = await db.Users.Where(u => u.Role == Roles.Admin && !u.Disabled && !u.IsLocalOwner).ToListAsync(ct);
        if (admins.Count == 0)
        {
            throw ApiException.BadRequest("admin.emergency_reset_no_admin", "No active administrator account was found.");
        }
        if (admins.Count > 1)
        {
            throw ApiException.Conflict("admin.emergency_reset_other_admins_exist",
                "Another administrator account is active. Please ask another administrator to reset your password in App-Administration -> Users.");
        }
        emergencyToken.GenerateAndAnnounce();
        return Ok(new { requested = true });
    }

    [HttpPost("emergency-reset/confirm")]
    [AllowAnonymous]
    [ServerModeOnly]
    [EnableRateLimiting(RateLimitPolicies.EmergencyReset)]
    public async Task<IActionResult> ConfirmEmergencyReset(
        [FromBody] EmergencyResetConfirmRequest body,
        [FromServices] EmergencyToken emergencyToken,
        [FromServices] ILogger<AuthController> logger,
        CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "code", body.Code, 128);
        InputRules.Password(errors, "newPassword", body.NewPassword);
        errors.ThrowIfAny();

        var admins = await db.Users.Where(u => u.Role == Roles.Admin && !u.Disabled && !u.IsLocalOwner).ToListAsync(ct);
        if (admins.Count == 0)
        {
            throw ApiException.BadRequest("admin.emergency_reset_no_admin", "No active administrator account was found.");
        }
        if (admins.Count > 1)
        {
            throw ApiException.Conflict("admin.emergency_reset_other_admins_exist",
                "Another administrator account is active. Please ask another administrator to reset your password in App-Administration -> Users.");
        }

        if (!emergencyToken.Matches(body.Code))
        {
            logger.LogWarning("Admin-Notfall-Reset mit ungültigem oder abgelaufenem Code abgewiesen (IP {Ip}).", ClientInfo.Ip(HttpContext));
            throw ApiException.Field("code", "emergency_reset.code_invalid",
                "The emergency reset code is missing, expired or wrong.", StatusCodes.Status403Forbidden);
        }

        var admin = admins[0];
        accounts.SetPassword(admin, body.NewPassword!);
        await twoFactor.DisableAsync(admin, ct);
        emergencyToken.Consume();
        await db.SaveChangesAsync(ct);

        await sessions.RevokeAllAsync(admin.Id, "emergency_reset", null, ct);
        await activity.RecordNowAsync(HttpContext, "admin.emergency_reset", admin.Username, new { resetTwoFactor = true }, admin.Id, admin.Username, ct);
        logger.LogWarning("Passwort und 2FA für Administrator '{Admin}' per Notfall-Reset zurückgesetzt (IP {Ip}).", admin.Username, ClientInfo.Ip(HttpContext));

        return Ok(new { success = true, username = admin.Username });
    }

    [HttpGet("me")]
    [Authorize]
    [AllowDuringTwoFactorSetup]
    public async Task<ActionResult<UserResponse>> Me(CancellationToken ct)
    {
        var id = User.RequiredUserId();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new ApiException(StatusCodes.Status401Unauthorized, "auth.invalid", "The account no longer exists.");
        return new UserResponse(UserDto.From(user, (await instanceSettings.GetAsync(ct)).RequireTwoFactor));
    }

    private async Task<UserResponse> CompleteLoginAsync(User user, string method, CancellationToken ct)
    {
        await sessions.StartAsync(HttpContext, user, ct);
        await activity.RecordNowAsync(HttpContext, "auth.login", user.Username, new { method }, user.Id, user.Username, ct);
        return new UserResponse(UserDto.From(user, (await instanceSettings.GetAsync(ct)).RequireTwoFactor));
    }
}
