using System.Globalization;
using System.Threading.RateLimiting;
using Cv.Server.Configuration;
using Cv.Server.Errors;
using Cv.Server.Security;
using Microsoft.AspNetCore.RateLimiting;

namespace Cv.Server;

/// <summary>
/// Rate limits of the sensitive endpoints: ASP.NET Core's built-in limiter, a fixed window per client IP (after the forwarded headers of
/// trusted proxies), no queue - an over-limit request gets 429 <c>rate_limited</c> with <c>Retry-After</c> at once.
/// </summary>
public static class RateLimitPolicies
{
    public const string Login = "login";
    public const string TwoFactor = "twofactor";
    public const string Setup = "setup";
    public const string Register = "register";
    public const string Password = "password";

    /// <summary>Backup download, upload and restore (they check the admin password again).</summary>
    public const string StepUp = "stepup";

    internal static void Configure(RateLimiterOptions options, RateLimitSettings limits)
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        options.OnRejected = async (context, _) =>
        {
            var seconds = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
                ? (int)Math.Ceiling(retryAfter.TotalSeconds)
                : (int)limits.Window.TotalSeconds;
            context.HttpContext.Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
            await ApiProblem.WriteAsync(context.HttpContext, StatusCodes.Status429TooManyRequests, "rate_limited",
                $"Too many attempts. Please wait {seconds} seconds and try again.",
                new Dictionary<string, object?> { ["retryAfterSeconds"] = seconds, ["scope"] = "ip" });
        };
        Add(options, Login, limits.Login, limits.Window);
        Add(options, TwoFactor, limits.TwoFactor, limits.Window);
        Add(options, Setup, limits.Setup, limits.Window);
        Add(options, Register, limits.Register, limits.Window);
        Add(options, Password, limits.Password, limits.Window);
        Add(options, StepUp, limits.StepUp, limits.Window);
    }

    private static void Add(RateLimiterOptions options, string name, int permits, TimeSpan window) =>
        options.AddPolicy(name, context => RateLimitPartition.GetFixedWindowLimiter(
            ClientPartition.Key(context.Connection.RemoteIpAddress),
            _ => new FixedWindowRateLimiterOptions { PermitLimit = permits, Window = window, QueueLimit = 0, AutoReplenishment = true }));
}
