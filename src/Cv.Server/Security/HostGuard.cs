using System.Collections.Concurrent;
using System.Net;
using Cv.Server.Configuration;
using Cv.Server.Errors;

namespace Cv.Server.Security;

/// <summary>
/// DNS-rebinding protection of the server mode. A rebinding attack always arrives with the attacker's DNS name in the Host header, so a
/// request is accepted only when its host is
/// <list type="bullet">
/// <item>an IP literal (IPv4 or IPv6, any port) - plain access by IP needs no configuration,</item>
/// <item><c>localhost</c>, or</item>
/// <item>listed in <c>ALLOWED_HOSTS</c> (comma-separated names; <c>*.example.com</c> allows every sub-domain of example.com, not the name
/// itself).</item>
/// </list>
/// Behind a reverse proxy listed in <c>TRUSTED_PROXIES</c> the proxy's <c>X-Forwarded-Host</c> is checked instead (the last entry, the one
/// the nearest proxy wrote). From any other sender that header is ignored. Anything else: 400 <c>host.not_allowed</c>.
/// Runs before the forwarded headers are applied, so the connection's own address still decides whether the sender is a trusted proxy.
/// Desktop mode does not use this guard: there the authentication accepts only <c>127.0.0.1:&lt;port&gt;</c>.
/// </summary>
public static class HostGuard
{
    private static readonly ConcurrentDictionary<string, DateTime> LastLogged = new(StringComparer.Ordinal);

    public static IApplicationBuilder UseHostGuard(this IApplicationBuilder app, ServerSettings settings, ILogger logger) => app.Use(async (context, next) =>
    {
        var forwarded = context.Request.Headers["X-Forwarded-Host"].ToString();
        var host = EffectiveHost(context.Request.Host.Value, forwarded, context.Connection.RemoteIpAddress, settings);
        if (IsAllowed(host, settings.AllowedHosts))
        {
            await next();
            return;
        }
        LogRejected(logger, host);
        await ApiProblem.WriteAsync(context, StatusCodes.Status400BadRequest, "host.not_allowed",
            "This server is not reachable under this host name. The operator can allow it with the setting ALLOWED_HOSTS.",
            new Dictionary<string, object?> { ["host"] = Truncate(HostName(host), 253) });
    });

    /// <summary>
    /// Desktop mode: only the exact Host <c>127.0.0.1:&lt;port&gt;</c> is answered - also the public endpoints and the UI, so a page under
    /// another name (DNS rebinding) cannot even read version or bootstrap data from the local program.
    /// </summary>
    public static IApplicationBuilder UseDesktopHostGuard(this IApplicationBuilder app, ServerSettings settings, ILogger logger) => app.Use(async (context, next) =>
    {
        var host = context.Request.Host.Value;
        if (string.Equals(host, settings.DesktopHost, StringComparison.Ordinal))
        {
            await next();
            return;
        }
        LogRejected(logger, host);
        await ApiProblem.WriteAsync(context, StatusCodes.Status400BadRequest, "host.not_allowed",
            "This program only answers on its own local address.", new Dictionary<string, object?> { ["host"] = Truncate(HostName(host), 253) });
    });

    /// <summary>The host to check: the forwarded host when the sender is a trusted proxy and sent one, else the Host header.</summary>
    public static string? EffectiveHost(string? hostHeader, string? forwardedHost, IPAddress? remote, ServerSettings settings)
    {
        if (!string.IsNullOrWhiteSpace(forwardedHost) && IsTrustedProxy(remote, settings))
        {
            var parts = forwardedHost.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (parts.Length > 0) return parts[^1];
        }
        return hostHeader;
    }

    public static bool IsTrustedProxy(IPAddress? remote, ServerSettings settings)
    {
        if (remote is null) return false;
        if (remote.IsIPv4MappedToIPv6) remote = remote.MapToIPv4();
        return settings.TrustedProxies.Any(p => p.Equals(remote)) || settings.TrustedNetworks.Any(n => n.Contains(remote));
    }

    /// <summary>The rule itself (host = "name[:port]", "a.b.c.d[:port]" or "[v6][:port]").</summary>
    public static bool IsAllowed(string? host, IReadOnlyList<string> allowedHosts)
    {
        var name = HostName(host);
        if (name.Length == 0) return false;
        if (IPAddress.TryParse(name, out _)) return true;
        if (string.Equals(name, "localhost", StringComparison.OrdinalIgnoreCase)) return true;
        foreach (var allowed in allowedHosts)
        {
            if (allowed.StartsWith("*.", StringComparison.Ordinal))
            {
                if (name.EndsWith(allowed[1..], StringComparison.OrdinalIgnoreCase) && name.Length > allowed.Length - 1) return true;
            }
            else if (string.Equals(name, allowed, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }

    /// <summary>
    /// <c>ALLOWED_HOSTS</c>: host names without scheme or port, optionally <c>*.</c> in front. An invalid entry stops the start, so a typo
    /// does not silently lock everybody out.
    /// </summary>
    public static IReadOnlyList<string> ParseAllowedHosts(string? value)
    {
        var result = new List<string>();
        if (string.IsNullOrWhiteSpace(value)) return result;
        foreach (var raw in value.Split([',', ';', ' '], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var entry = raw.TrimEnd('.').ToLowerInvariant();
            var name = entry.StartsWith("*.", StringComparison.Ordinal) ? entry[2..] : entry;
            var kind = Uri.CheckHostName(name);
            // IP literals are always allowed anyway
            if (kind is UriHostNameType.IPv4 or UriHostNameType.IPv6 && entry == name) continue;
            if (name.Length == 0 || kind != UriHostNameType.Dns)
            {
                throw new InvalidOperationException(
                    $"ALLOWED_HOSTS: '{raw}' ist kein gültiger Hostname (erlaubt: z. B. vitafolio.example.com oder *.example.com, ohne http:// und ohne Port).");
            }
            result.Add(entry);
        }
        return result;
    }

    /// <summary>"Name:port" -> "name", "[::1]:80" -> "::1"; trailing dot removed.</summary>
    internal static string HostName(string? host)
    {
        if (string.IsNullOrWhiteSpace(host)) return "";
        var value = host.Trim();
        if (value.StartsWith('['))
        {
            var end = value.IndexOf(']');
            return end > 1 ? value[1..end] : "";
        }
        var colon = value.IndexOf(':');
        // More than one colon without brackets: a bare IPv6 literal
        if (colon >= 0 && value.IndexOf(':', colon + 1) < 0) value = value[..colon];
        return value.TrimEnd('.');
    }

    private static void LogRejected(ILogger logger, string? host)
    {
        // One line per host name and 10 minutes, so a scanner cannot flood the log
        var key = Truncate(HostName(host), 253);
        var now = DateTime.UtcNow;
        if (LastLogged.TryGetValue(key, out var last) && now - last < TimeSpan.FromMinutes(10)) return;
        if (LastLogged.Count > 1000) LastLogged.Clear();
        LastLogged[key] = now;
        logger.LogWarning(
            "Anfrage mit nicht erlaubtem Hostnamen '{Host}' abgewiesen (Schutz gegen DNS-Rebinding). Wenn der Server unter diesem Namen erreichbar sein soll (z. B. über einen Reverse-Proxy), den Namen in der Einstellung ALLOWED_HOSTS eintragen (kommagetrennt, *.example.com für alle Unterdomains).",
            key);
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}
