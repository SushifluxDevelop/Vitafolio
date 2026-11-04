using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using Cv.Server.Configuration;
using Cv.Server.Data;
using Cv.Server.Errors;
using Cv.Server.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Cv.Server.Auth;

/// <summary>
/// The one authentication scheme of the server.
/// <list type="bullet">
/// <item><b>Server mode:</b> the JWT from cookie <c>cv_access</c>; its session must still be active and its user enabled (checked on
/// every request, so revoking a session or disabling an account takes effect at once).</item>
/// <item><b>Desktop mode:</b> the local owner, but only when cookie <c>cv_desktop</c> equals the host's per-run token (constant-time) AND
/// the Host header is exactly <c>127.0.0.1:&lt;port&gt;</c> (DNS rebinding protection). Other programs and browsers on the PC do not have
/// the cookie.</item>
/// </list>
/// Failures answer 401 with a code: <c>auth.required</c> (nothing presented), <c>auth.expired</c> (refresh and retry),
/// <c>auth.invalid</c> (bad token or ended session), <c>auth.disabled</c>.
/// </summary>
public sealed class CvAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    ServerSettings settings,
    TokenService tokens,
    SettingsService instanceSettings,
    DesktopOwner desktopOwner,
    AppDbContext db,
    TimeProvider time)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        return settings.IsDesktop ? AuthenticateDesktop() : await AuthenticateServerAsync();
    }

    private AuthenticateResult AuthenticateDesktop()
    {
        var cookie = Request.Cookies[AuthConstants.DesktopCookie];
        if (string.IsNullOrEmpty(cookie) || !string.Equals(Request.Host.Value, settings.DesktopHost, StringComparison.Ordinal)
            || !FixedTimeEquals(cookie, settings.DesktopToken!) || desktopOwner.User is not { } owner)
        {
            return Fail("auth.required");
        }
        return Success(owner, sessionId: null, mustSetupTwoFactor: false);
    }

    private async Task<AuthenticateResult> AuthenticateServerAsync()
    {
        var token = Request.Cookies[AuthConstants.AccessCookie];
        if (string.IsNullOrEmpty(token)) return Fail("auth.required");
        if (token.Length > 4096) return Fail("auth.invalid");

        var result = await tokens.ValidateAccessTokenAsync(token);
        if (!result.Valid) return Fail(result.Expired ? "auth.expired" : "auth.invalid");

        var now = time.GetUtcNow().UtcDateTime;
        var row = await db.Sessions.AsNoTracking()
            .Where(s => s.Id == result.SessionId && s.UserId == result.UserId)
            .Select(s => new { s.RevokedAt, s.ExpiresAt, s.User })
            .FirstOrDefaultAsync(Context.RequestAborted);
        if (row?.User is null || row.RevokedAt is not null || row.ExpiresAt <= now) return Fail("auth.invalid");
        if (row.User.Disabled) return Fail("auth.disabled");

        var instance = await instanceSettings.GetAsync(Context.RequestAborted);
        return Success(row.User, result.SessionId, instance.RequireTwoFactor && !row.User.TotpEnabled);
    }

    private AuthenticateResult Success(User user, Guid? sessionId, bool mustSetupTwoFactor)
    {
        var claims = new List<Claim>
        {
            new(AuthConstants.ClaimUserId, user.Id.ToString()),
            new(AuthConstants.ClaimName, user.Username),
            new(AuthConstants.ClaimRole, user.Role),
        };
        if (sessionId is { } sid) claims.Add(new Claim(AuthConstants.ClaimSessionId, sid.ToString()));
        if (mustSetupTwoFactor) claims.Add(new Claim(AuthConstants.ClaimMustSetupTwoFactor, "true"));
        var principal = new ClaimsPrincipal(TokenService.Identity(claims));
        return AuthenticateResult.Success(new AuthenticationTicket(principal, AuthConstants.Scheme));
    }

    private AuthenticateResult Fail(string code)
    {
        Context.Items[AuthConstants.FailureCodeItem] = code;
        // "Nothing presented" is no failure of a credential, just an anonymous request
        return code == "auth.required" ? AuthenticateResult.NoResult() : AuthenticateResult.Fail(code);
    }

    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        var code = Context.Items[AuthConstants.FailureCodeItem] as string ?? "auth.required";
        var detail = code switch
        {
            "auth.expired" => "The sign-in token has expired. Refresh it and try again.",
            "auth.disabled" => "This account is disabled.",
            "auth.invalid" => "The sign-in is not valid any more. Please sign in again.",
            _ => "Sign-in required.",
        };
        return ApiProblem.WriteAsync(Context, StatusCodes.Status401Unauthorized, code, detail);
    }

    protected override Task HandleForbiddenAsync(AuthenticationProperties properties) =>
        ApiProblem.WriteAsync(Context, StatusCodes.Status403Forbidden, "auth.forbidden", "You are not allowed to do this.");

    private static bool FixedTimeEquals(string a, string b) =>
        CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(a), Encoding.UTF8.GetBytes(b));
}

/// <summary>Desktop mode: the automatically created owner account (role admin). Loaded at start; null in server mode.</summary>
public sealed class DesktopOwner
{
    public User? User { get; private set; }

    internal void Set(User user) => User = user;

    /// <summary>Creates the owner on the first start of the Windows program, or loads it.</summary>
    internal static void Ensure(IServiceProvider services, ILogger logger)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var time = services.GetRequiredService<TimeProvider>();
        var owner = db.Users.AsNoTracking().FirstOrDefault(u => u.IsLocalOwner);
        if (owner is null)
        {
            var now = time.GetUtcNow().UtcDateTime;
            var name = Environment.UserName;
            owner = new User
            {
                Id = Guid.NewGuid(),
                Username = "owner",
                NormalizedUsername = "owner",
                DisplayName = string.IsNullOrWhiteSpace(name) ? "Owner" : (name.Length > 64 ? name[..64] : name),
                Role = Roles.Admin,
                IsLocalOwner = true,
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.Users.Add(owner);
            db.SaveChanges();
            db.ChangeTracker.Clear();
            logger.LogInformation("Lokales Besitzerkonto für das Windows-Programm angelegt.");
        }
        services.GetRequiredService<DesktopOwner>().Set(owner);
    }
}
