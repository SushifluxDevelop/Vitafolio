using System.Security.Claims;

namespace Cv.Server.Auth;

public static class AuthConstants
{
    public const string Scheme = "Cv";

    public const string AccessCookie = "cv_access";
    public const string RefreshCookie = "cv_refresh";
    public const string DesktopCookie = "cv_desktop";

    public const string RefreshCookiePath = "/api/auth";

    public static readonly TimeSpan AccessTokenLifetime = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan SessionLifetime = TimeSpan.FromDays(30);

    public const string Issuer = "cv-server";
    public const string Audience = "cv-ui";

    public const string ClaimUserId = "sub";
    public const string ClaimSessionId = "sid";
    public const string ClaimName = "name";
    public const string ClaimRole = "role";

    /// <summary>Set by the authentication handler when the instance requires 2FA and this user has not set it up yet.</summary>
    public const string ClaimMustSetupTwoFactor = "cv:must_setup_2fa";

    /// <summary>HttpContext item: why authentication failed (the code of the 401 answer).</summary>
    internal const string FailureCodeItem = "cv:auth_failure";

    public const string AdminPolicy = "admin";
}

public static class ClaimsPrincipalExtensions
{
    public static Guid? UserId(this ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(AuthConstants.ClaimUserId), out var id) ? id : null;

    public static Guid RequiredUserId(this ClaimsPrincipal user) =>
        user.UserId() ?? throw new InvalidOperationException("No authenticated user.");

    public static Guid? SessionId(this ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(AuthConstants.ClaimSessionId), out var id) ? id : null;

    public static string? Username(this ClaimsPrincipal user) => user.FindFirstValue(AuthConstants.ClaimName);
}
