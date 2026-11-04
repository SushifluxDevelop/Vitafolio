using Cv.Server.Configuration;
using Cv.Server.Data;
using Cv.Server.Errors;
using Cv.Server.Services;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Auth;

/// <summary>
/// Sessions (= refresh-token families) and the two auth cookies. Access cookie <c>cv_access</c> (Path /) carries the 15-minute JWT;
/// the cookie itself lives as long as the session, so an expired token reaches the server and is answered with <c>auth.expired</c>
/// (the UI then refreshes). Refresh cookie <c>cv_refresh</c> (Path /api/auth) carries the opaque refresh token. Both HttpOnly,
/// SameSite=Strict, Secure on HTTPS.
/// </summary>
public sealed class SessionService(AppDbContext db, TokenService tokens, ActivityLogger activity, ServerSettings settings, TimeProvider time)
{
    /// <summary>Signs the user in on this device: new session, first refresh token, both cookies.</summary>
    public async Task<Session> StartAsync(HttpContext context, User user, CancellationToken ct)
    {
        var now = time.GetUtcNow().UtcDateTime;
        var session = new Session
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            CreatedAt = now,
            LastUsedAt = now,
            ExpiresAt = now + AuthConstants.SessionLifetime,
            Ip = ClientInfo.Ip(context),
            UserAgent = ClientInfo.UserAgent(context),
        };
        var refresh = TokenService.NewRefreshToken();
        session.RefreshTokens.Add(new RefreshToken { TokenHash = TokenService.Hash(refresh), CreatedAt = now });
        db.Sessions.Add(session);
        user.LastLoginAt = now;
        await db.SaveChangesAsync(ct);
        WriteCookies(context, tokens.CreateAccessToken(user.Id, session.Id, user.Role), refresh, session.ExpiresAt);
        return session;
    }

    /// <summary>
    /// Exchanges the refresh cookie for a new access token and a new refresh token. A token that was already exchanged earlier is a
    /// reuse: the whole session is revoked (except within the short grace period for two tabs refreshing at the same moment, which
    /// only gets a new access token).
    /// </summary>
    public async Task<User> RefreshAsync(HttpContext context, CancellationToken ct)
    {
        var presented = context.Request.Cookies[AuthConstants.RefreshCookie];
        if (string.IsNullOrEmpty(presented) || presented.Length > 128) throw RefreshInvalid(context);

        var hash = TokenService.Hash(presented);
        var token = await db.RefreshTokens.Include(t => t.Session).ThenInclude(s => s!.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        var session = token?.Session;
        var user = session?.User;
        var now = time.GetUtcNow().UtcDateTime;
        if (token is null || session is null || user is null || session.RevokedAt is not null || session.ExpiresAt <= now)
        {
            throw RefreshInvalid(context);
        }
        if (user.Disabled)
        {
            await RevokeAsync(session, "user_disabled", ct);
            ClearCookies(context);
            throw new ApiException(StatusCodes.Status401Unauthorized, "auth.disabled", "This account is disabled.");
        }

        if (token.RotatedAt is { } rotatedAt)
        {
            if (now - rotatedAt <= settings.RefreshReuseGrace)
            {
                // A parallel refresh of the same browser: the other answer already set the new refresh cookie
                WriteAccessCookie(context, tokens.CreateAccessToken(user.Id, session.Id, user.Role), session.ExpiresAt);
                return user;
            }
            await RevokeAsync(session, "refresh_reuse", ct);
            await activity.RecordNowAsync(context, "auth.refresh_reuse", user.Username,
                new { sessionId = session.Id }, actorId: user.Id, actorName: user.Username, ct: ct);
            ClearCookies(context);
            throw new ApiException(StatusCodes.Status401Unauthorized, "auth.refresh_reused",
                "This sign-in was ended because an old refresh token was used again. Please sign in again.");
        }

        // Atomic: only one of two concurrent requests with the same token wins the rotation
        var claimed = await db.RefreshTokens.Where(t => t.Id == token.Id && t.RotatedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RotatedAt, now), ct);
        if (claimed == 0)
        {
            WriteAccessCookie(context, tokens.CreateAccessToken(user.Id, session.Id, user.Role), session.ExpiresAt);
            return user;
        }

        var next = TokenService.NewRefreshToken();
        db.RefreshTokens.Add(new RefreshToken { SessionId = session.Id, TokenHash = TokenService.Hash(next), CreatedAt = now });
        session.LastUsedAt = now;
        session.ExpiresAt = now + AuthConstants.SessionLifetime;
        session.Ip = ClientInfo.Ip(context);
        session.UserAgent = ClientInfo.UserAgent(context);
        await db.SaveChangesAsync(ct);
        WriteCookies(context, tokens.CreateAccessToken(user.Id, session.Id, user.Role), next, session.ExpiresAt);
        return user;
    }

    /// <summary>The session of this request: from the refresh cookie (sent to /api/auth/*) or the access token's session id.</summary>
    public async Task<Session?> FindCurrentAsync(HttpContext context, CancellationToken ct)
    {
        var presented = context.Request.Cookies[AuthConstants.RefreshCookie];
        if (!string.IsNullOrEmpty(presented) && presented.Length <= 128)
        {
            var hash = TokenService.Hash(presented);
            var viaRefresh = await db.RefreshTokens.Where(t => t.TokenHash == hash).Select(t => t.Session).FirstOrDefaultAsync(ct);
            if (viaRefresh is not null) return viaRefresh;
        }
        var sid = context.User.SessionId();
        return sid is null ? null : await db.Sessions.FirstOrDefaultAsync(s => s.Id == sid, ct);
    }

    public async Task RevokeAsync(Session session, string reason, CancellationToken ct)
    {
        if (session.RevokedAt is not null) return;
        session.RevokedAt = time.GetUtcNow().UtcDateTime;
        session.RevokedReason = reason;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Ends all sessions of a user, optionally keeping one (the session that changed its own password).</summary>
    public async Task<int> RevokeAllAsync(Guid userId, string reason, Guid? except, CancellationToken ct)
    {
        var now = time.GetUtcNow().UtcDateTime;
        return await db.Sessions
            .Where(s => s.UserId == userId && s.RevokedAt == null && (except == null || s.Id != except))
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, now).SetProperty(x => x.RevokedReason, reason), ct);
    }

    public static void ClearCookies(HttpContext context)
    {
        context.Response.Cookies.Delete(AuthConstants.AccessCookie, CookieOptions(context, "/", null));
        context.Response.Cookies.Delete(AuthConstants.RefreshCookie, CookieOptions(context, AuthConstants.RefreshCookiePath, null));
    }

    private ApiException RefreshInvalid(HttpContext context)
    {
        ClearCookies(context);
        return new ApiException(StatusCodes.Status401Unauthorized, "auth.refresh_invalid", "The sign-in has ended. Please sign in again.");
    }

    private static void WriteCookies(HttpContext context, string access, string refresh, DateTime expires)
    {
        WriteAccessCookie(context, access, expires);
        context.Response.Cookies.Append(AuthConstants.RefreshCookie, refresh, CookieOptions(context, AuthConstants.RefreshCookiePath, expires));
    }

    private static void WriteAccessCookie(HttpContext context, string access, DateTime expires) =>
        context.Response.Cookies.Append(AuthConstants.AccessCookie, access, CookieOptions(context, "/", expires));

    private static CookieOptions CookieOptions(HttpContext context, string path, DateTime? expires) => new()
    {
        HttpOnly = true,
        SameSite = SameSiteMode.Strict,
        Secure = context.Request.IsHttps,
        Path = path,
        Expires = expires is null ? null : new DateTimeOffset(expires.Value, TimeSpan.Zero),
        IsEssential = true,
    };
}

/// <summary>Client details stored with sessions and log entries (bounded lengths).</summary>
public static class ClientInfo
{
    public static string? Ip(HttpContext context) => context.Connection.RemoteIpAddress?.ToString();

    public static string? UserAgent(HttpContext context)
    {
        var value = context.Request.Headers.UserAgent.ToString();
        if (string.IsNullOrWhiteSpace(value)) return null;
        return value.Length > 256 ? value[..256] : value;
    }
}
