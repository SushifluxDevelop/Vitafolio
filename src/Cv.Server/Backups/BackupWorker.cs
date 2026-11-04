using Cv.Server.Configuration;
using Cv.Server.Services;

namespace Cv.Server.Backups;

/// <summary>
/// Automatic backups after the backup settings: at start (and the catch-up of a missed planned run), on the schedule, and before the
/// host stops. The master switch <see cref="BackupSettings.AutomaticEnabled"/> turns all of it off. Re-plans at once when the settings
/// change. The configuration key <c>Backups:Automatic=false</c> switches the worker off completely (tests, special hosts).
/// Every automatic run is written to the activity log (created / unchanged / failed). An unexpected error is logged and the worker goes on -
/// it never stops the server.
/// </summary>
public sealed class BackupWorker(
    BackupService backups,
    BackupSettingsStore store,
    ServerSettings settings,
    IServiceScopeFactory scopes,
    TimeProvider time,
    ILogger<BackupWorker> logger) : BackgroundService
{
    /// <summary>Pause after an unexpected error before the next attempt.</summary>
    internal static readonly TimeSpan ErrorPause = TimeSpan.FromMinutes(5);

    private CancellationTokenSource _wake = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!settings.AutomaticBackups)
        {
            logger.LogInformation("Automatische Sicherungen sind für diesen Server per Konfiguration ausgeschaltet.");
            return;
        }
        store.Changed += Wake;
        try
        {
            await GuardedAsync(() => StartupAsync(stoppingToken), "beim Start", stoppingToken);
            while (!stoppingToken.IsCancellationRequested)
            {
                await GuardedAsync(() => TickAsync(stoppingToken), "im Zeitplan", stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Stopping: the shutdown backup follows in StopAsync
        }
        finally
        {
            store.Changed -= Wake;
        }
    }

    /// <summary>One step of the schedule: wait for the next planned run (or a settings change), then back up.</summary>
    private async Task TickAsync(CancellationToken stoppingToken)
    {
        var options = await store.GetAsync(stoppingToken);
        var now = time.GetUtcNow().UtcDateTime;
        var next = options.AutomaticEnabled ? BackupSchedule.Next(options.Schedule, now, time.LocalTimeZone) : null;
        // Wake at the planned time, at the latest after an hour (clock changes), or at once when the settings change
        var wait = next is { } n ? n - now : TimeSpan.FromHours(1);
        if (wait > TimeSpan.FromHours(1)) wait = TimeSpan.FromHours(1);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken, _wake.Token);
        try
        {
            if (wait > TimeSpan.Zero) await Task.Delay(wait, time, linked.Token);
        }
        catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
        {
            ResetWake();
            return;
        }
        if (next is { } due && time.GetUtcNow().UtcDateTime >= due)
        {
            await RunAutomaticAsync(BackupKinds.Scheduled, stoppingToken);
            await store.SetLastScheduledAsync(due, stoppingToken);
        }
    }

    /// <summary>Runs an action; an unexpected error is logged in German and followed by a pause - the server keeps running.</summary>
    internal async Task GuardedAsync(Func<Task> action, string where, CancellationToken stoppingToken, TimeSpan? pause = null)
    {
        try
        {
            await action();
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unerwarteter Fehler der automatischen Sicherung ({Where}). Nächster Versuch in {Minutes} Minuten; der Server läuft weiter.",
                where, (pause ?? ErrorPause).TotalMinutes);
            await Task.Delay(pause ?? ErrorPause, time, stoppingToken);
        }
    }

    private async Task StartupAsync(CancellationToken ct)
    {
        var options = await store.GetAsync(ct);
        if (!options.AutomaticEnabled)
        {
            logger.LogInformation("Automatische Sicherungen sind in den Einstellungen ausgeschaltet.");
            return;
        }
        logger.LogInformation("Automatische Sicherungen nach {Dir}.", settings.BackupDirectory);
        var now = time.GetUtcNow().UtcDateTime;
        var last = await store.LastScheduledAsync(ct);
        var missed = BackupSchedule.MissedRun(options, last, now, time.LocalTimeZone);
        if (options.OnStart)
        {
            await RunAutomaticAsync(BackupKinds.Start, ct);
        }
        else if (missed is not null)
        {
            logger.LogInformation("Verpasste geplante Sicherung ({Planned:u}) wird nachgeholt.", missed);
            await RunAutomaticAsync(BackupKinds.Scheduled, ct);
        }
        // The start backup covers a missed run as well; the first start ever only remembers "now"
        if (missed is not null || last is null) await store.SetLastScheduledAsync(now, ct);
    }

    /// <summary>An automatic backup plus its activity-log entry (system entry, no user).</summary>
    internal async Task<BackupResult> RunAutomaticAsync(string kind, CancellationToken ct)
    {
        var result = await backups.RunAsync(kind, false, ct);
        var action = result.Outcome switch
        {
            BackupOutcome.Created => "backup.auto_created",
            BackupOutcome.Unchanged => "backup.auto_unchanged",
            _ => "backup.auto_failed",
        };
        try
        {
            using var scope = scopes.CreateScope();
            await scope.ServiceProvider.GetRequiredService<ActivityLogger>()
                .RecordSystemAsync(action, result.Entry?.File, new { kind, problem = result.Problem }, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning("Eintrag der automatischen Sicherung im Aktivitätsprotokoll nicht möglich: {Message}", ex.Message);
        }
        return result;
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);
        if (!settings.AutomaticBackups) return;
        try
        {
            var options = await store.GetAsync(cancellationToken);
            if (options.AutomaticEnabled && options.BeforeShutdown)
            {
                await RunAutomaticAsync(BackupKinds.Shutdown, cancellationToken);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Sicherung vor dem Beenden fehlgeschlagen.");
        }
    }

    private void Wake()
    {
        try
        {
            _wake.Cancel();
        }
        catch (ObjectDisposedException)
        {
        }
    }

    private void ResetWake()
    {
        var old = _wake;
        _wake = new CancellationTokenSource();
        old.Dispose();
    }

    public override void Dispose()
    {
        _wake.Dispose();
        base.Dispose();
    }
}
