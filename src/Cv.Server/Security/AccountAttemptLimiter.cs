using System.Globalization;
using System.Net;
using System.Threading.RateLimiting;
using Cv.Server.Configuration;
using Cv.Server.Errors;

namespace Cv.Server.Security;

/// <summary>
/// A second brake next to the per-IP limits: sign-in and 2FA attempts per account (default 20 per 15 minutes per normalised username /
/// user), so an attacker spread over many addresses still cannot try passwords or codes against one account at speed. A reached limit
/// is logged in German (a series of attempts against one account).
/// </summary>
public sealed class AccountAttemptLimiter : IDisposable
{
    private readonly PartitionedRateLimiter<string> _limiter;
    private readonly RateLimitSettings _limits;
    private readonly ILogger<AccountAttemptLimiter> _logger;

    public AccountAttemptLimiter(ServerSettings settings, ILogger<AccountAttemptLimiter> logger)
    {
        _limits = settings.RateLimits;
        _logger = logger;
        _limiter = PartitionedRateLimiter.Create<string, string>(key => RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = _limits.AccountAttempts,
            Window = _limits.AccountWindow,
            QueueLimit = 0,
            AutoReplenishment = true,
        }));
    }

    /// <summary>Counts one attempt; throws 429 <c>rate_limited</c> (scope <c>account</c>) when the account's budget is used up.</summary>
    public void Attempt(HttpContext context, string kind, string account)
    {
        using var lease = _limiter.AttemptAcquire($"{kind}:{account}");
        if (lease.IsAcquired) return;
        var seconds = lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
            ? (int)Math.Ceiling(retryAfter.TotalSeconds)
            : (int)_limits.AccountWindow.TotalSeconds;
        _logger.LogWarning("Viele Anmeldeversuche ({Kind}) für das Konto '{Account}' - weitere Versuche für {Seconds} Sekunden gesperrt (letzte IP {Ip}).",
            kind, account.Length > 64 ? account[..64] : account, seconds, context.Connection.RemoteIpAddress);
        context.Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
        throw new ApiException(StatusCodes.Status429TooManyRequests, "rate_limited",
            $"Too many attempts for this account. Please wait {seconds} seconds and try again.",
            new Dictionary<string, object?> { ["retryAfterSeconds"] = seconds, ["scope"] = "account" });
    }

    public void Dispose() => _limiter.Dispose();
}

/// <summary>The partition key of a client for the per-IP limits: IPv4 as it is, IPv6 by its /64 network (one connection usually owns a whole /64).</summary>
public static class ClientPartition
{
    public static string Key(IPAddress? address)
    {
        if (address is null) return "unknown";
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        if (address.AddressFamily != System.Net.Sockets.AddressFamily.InterNetworkV6) return address.ToString();
        var bytes = address.GetAddressBytes();
        for (var i = 8; i < 16; i++) bytes[i] = 0;
        return new IPAddress(bytes) + "/64";
    }
}
