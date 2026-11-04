using Cv.Server.Auth;
using Cv.Server.Configuration;
using Cv.Server.Data;
using Cv.Server.Errors;
using Cv.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Controllers;

/// <summary>Public start information for the UI and the one-time creation of the first admin.</summary>
[ApiController]
[AllowAnonymous]
public sealed class SetupController(AppDbContext db, ServerSettings settings, SettingsService instanceSettings) : ControllerBase
{
    // Setup must happen exactly once even when two requests arrive at the same moment
    private static readonly SemaphoreSlim SetupGate = new(1, 1);

    [HttpGet("/api/bootstrap")]
    public async Task<IActionResult> Bootstrap(CancellationToken ct)
    {
        var server = !settings.IsDesktop;
        var setupRequired = server && !await db.Users.AnyAsync(ct);
        var instance = await instanceSettings.GetAsync(ct);
        return Ok(new
        {
            productName = Branding.ProductName,
            mode = server ? "server" : "desktop",
            setupRequired,
            registrationOpen = server && !setupRequired && instance.RegistrationOpen,
            // The first admin needs the one-time setup code from the server log
            setupTokenRequired = setupRequired,
            rules = InputRules.Describe(),
            languages = new[] { "de", "en" },
        });
    }

    [HttpPost("/api/setup")]
    [ServerModeOnly]
    [EnableRateLimiting(RateLimitPolicies.Setup)]
    public async Task<ActionResult<UserResponse>> Setup([FromBody] SetupRequest body, [FromServices] Accounts accounts,
        [FromServices] SessionService sessions, [FromServices] ActivityLogger activity, [FromServices] SetupToken setupToken,
        [FromServices] ILogger<SetupController> logger, CancellationToken ct)
    {
        await SetupGate.WaitAsync(ct);
        try
        {
            if (await db.Users.AnyAsync(ct))
            {
                throw ApiException.Conflict("setup.already_done", "The first account has already been created.");
            }
            if (!setupToken.Matches(body.SetupToken))
            {
                logger.LogWarning("Einrichtung mit fehlendem oder falschem Einrichtungscode abgewiesen (IP {Ip}).", ClientInfo.Ip(HttpContext));
                throw ApiException.Field("setupToken", "setup.token_invalid",
                    "The setup code is missing or wrong. It is in the server log (Docker / Unraid: the container's logs).", StatusCodes.Status403Forbidden);
            }
            var user = await accounts.CreateAsync(body.Username, body.DisplayName, body.Password, Roles.Admin, ct);
            activity.Record(HttpContext, "setup.completed", user.Username, null, user.Id, user.Username);
            await db.SaveChangesAsync(ct);
            setupToken.Consume();
            await sessions.StartAsync(HttpContext, user, ct);
            await activity.RecordNowAsync(HttpContext, "auth.login", user.Username, new { method = "setup" }, user.Id, user.Username, ct);
            return new UserResponse(UserDto.From(user, (await instanceSettings.GetAsync(ct)).RequireTwoFactor));
        }
        finally
        {
            SetupGate.Release();
        }
    }
}
