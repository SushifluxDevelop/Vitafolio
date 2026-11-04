using Cv.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Auth;

/// <summary>
/// Removes sign-in data that is no longer needed: at start and once a day. Revoked or expired sessions are kept
/// <see cref="Retention"/> long (so a late reuse of one of their refresh tokens is still recognised and logged), then deleted with their
/// tokens; rotated refresh tokens older than that are deleted too (presenting one later simply fails as unknown).
/// </summary>
public sealed class SessionCleanupWorker(IServiceScopeFactory scopes, TimeProvider time, ILogger<SessionCleanupWorker> logger) : BackgroundService
{
    public static readonly TimeSpan Retention = TimeSpan.FromDays(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var (sessions, tokens) = await CleanupAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>(), time.GetUtcNow().UtcDateTime, stoppingToken);
                if (sessions + tokens > 0)
                {
                    logger.LogInformation("Aufgeräumt: {Sessions} beendete Sitzungen und {Tokens} alte Refresh-Tokens gelöscht.", sessions, tokens);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning("Aufräumen der Sitzungen fehlgeschlagen: {Message}", ex.Message);
            }
            try
            {
                await Task.Delay(TimeSpan.FromDays(1), time, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    /// <summary>The cleanup itself: returns how many sessions and (separately deleted) refresh tokens were removed.</summary>
    public static async Task<(int Sessions, int Tokens)> CleanupAsync(AppDbContext db, DateTime nowUtc, CancellationToken ct)
    {
        var cutoff = nowUtc - Retention;
        var tokens = await db.RefreshTokens.Where(t => t.RotatedAt != null && t.RotatedAt < cutoff).ExecuteDeleteAsync(ct);
        // Foreign keys cascade: the tokens of these sessions go with them
        var sessions = await db.Sessions.Where(s => (s.RevokedAt != null && s.RevokedAt < cutoff) || s.ExpiresAt < cutoff).ExecuteDeleteAsync(ct);
        return (sessions, tokens);
    }
}
