using Cv.Server.Auth;
using Cv.Server.Configuration;
using Cv.Server.Data;
using Cv.Server.Errors;
using Cv.Server.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Backups;

/// <summary>
/// Restores a backup into the live database. Order (never weakened):
/// <list type="number">
/// <item>The backup is copied to a work file and checked (SQLite, intact, this app, not from a newer schema - <c>backup.too_new</c>).</item>
/// <item>The API is closed (maintenance gate) and the requests in flight are waited for; if they do not finish within 15 seconds the
/// restore is abandoned with 503 <c>maintenance.busy</c> and nothing has changed.</item>
/// <item>A <c>pre-restore</c> safety backup of the current state; if it fails, nothing is restored.</item>
/// <item>The content is written with SQLite's online backup API into the live database (no file swap of an open database), then the
/// migrations lift an older backup to the current schema. If either fails, the safety backup is written back the same way and the answer
/// is <c>backup.restore_failed</c> - the live database is the state from before.</item>
/// <item>All sessions are revoked and the token signing key is rotated, so everybody signs in again; an activity-log entry is written into
/// the restored database.</item>
/// </list>
/// </summary>
public sealed class RestoreService(
    BackupService backups,
    MaintenanceGate gate,
    ServerSettings settings,
    SigningKeyStore signingKeys,
    SettingsService instanceSettings,
    BackupSettingsStore backupSettings,
    IServiceScopeFactory scopes,
    TimeProvider time,
    ILogger<RestoreService> logger)
{
    public static readonly TimeSpan QuietTimeout = TimeSpan.FromSeconds(15);

    public async Task RestoreAsync(BackupEntry entry, HttpContext context, CancellationToken ct)
    {
        var workDir = Path.Combine(backups.Root, "restore");
        Directory.CreateDirectory(workDir);
        var work = Path.Combine(workDir, $"restore-{Guid.NewGuid():N}.db");
        File.Copy(entry.FullPath, work);
        var actorId = context.User.UserId();
        var actorName = context.User.Username();
        var ip = ClientInfo.Ip(context);
        try
        {
            var (check, detail) = await BackupService.CheckAsync(work, KnownMigrations.All, ct);
            ThrowIfUnusable(check, detail, logger);

            gate.Close();
            try
            {
                // The restore request itself is one of the requests in flight
                if (!await WaitForQuietAsync(gate, 1, QuietTimeout, time, ct))
                {
                    logger.LogWarning("Wiederherstellung abgebrochen: andere Anfragen liefen nach {Seconds} Sekunden noch. Nichts wurde verändert.",
                        QuietTimeout.TotalSeconds);
                    throw new ApiException(StatusCodes.Status503ServiceUnavailable, "maintenance.busy",
                        "Other requests were still running, so the restore was not started. Nothing was changed - please try again.");
                }

                await backups.Gate.WaitAsync(ct);
                try
                {
                    var safety = await backups.RunLockedAsync(BackupKinds.PreRestore, force: true, ct);
                    if (safety.Outcome != BackupOutcome.Created || safety.Entry is null)
                    {
                        throw new ApiException(StatusCodes.Status500InternalServerError, "backup.failed",
                            "The safety backup of the current state failed, so nothing was restored. The server log has the details.");
                    }

                    try
                    {
                        await WriteIntoLiveAsync(work, ct);
                    }
                    catch (Exception ex) when (ex is SqliteException or InvalidOperationException or DbUpdateException or IOException)
                    {
                        logger.LogError(ex, "Wiederherstellung von {File} fehlgeschlagen - der Stand von vorher ({Safety}) wird zurückgeschrieben.",
                            entry.File, safety.Entry.File);
                        var rolledBack = RollBack(safety.Entry.FullPath);
                        throw new ApiException(StatusCodes.Status500InternalServerError, "backup.restore_failed",
                            rolledBack
                                ? $"The backup could not be restored. The previous state was put back from the safety backup {safety.Entry.File}. The server log has the details."
                                : $"The backup could not be restored, and putting back the safety backup {safety.Entry.File} failed too. Restore that backup before using the app. The server log has the details.",
                            new Dictionary<string, object?>
                            {
                                ["safetyBackup"] = safety.Entry.File,
                                ["safetyBackupId"] = safety.Entry.Id,
                                ["rolledBack"] = rolledBack,
                            });
                    }

                    await FinishAsync(entry, safety.Entry, actorId, actorName, ip, ct);
                }
                finally
                {
                    backups.Gate.Release();
                }
            }
            finally
            {
                gate.Open();
            }
        }
        finally
        {
            BackupService.TryDelete(work);
            BackupService.DeleteSideFiles(work);
        }
    }

    /// <summary>Waits until at most <paramref name="allowed"/> requests are in flight; false on timeout.</summary>
    internal static async Task<bool> WaitForQuietAsync(MaintenanceGate gate, int allowed, TimeSpan timeout, TimeProvider time, CancellationToken ct)
    {
        var deadline = time.GetUtcNow() + timeout;
        while (gate.InFlight > allowed)
        {
            if (time.GetUtcNow() >= deadline) return false;
            await Task.Delay(TimeSpan.FromMilliseconds(50), time, ct);
        }
        return true;
    }

    /// <summary>Sessions end, the signing key changes, the restore is logged into the restored database, caches are dropped.</summary>
    private async Task FinishAsync(BackupEntry entry, BackupEntry safety, Guid? actorId, string? actorName, string? ip, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = time.GetUtcNow().UtcDateTime;
        await db.Sessions.Where(s => s.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, now).SetProperty(x => x.RevokedReason, "restore"), ct);
        signingKeys.Rotate();
        db.ActivityLog.Add(new ActivityEntry
        {
            At = now,
            ActorId = actorId,
            ActorName = actorName,
            Action = "backup.restored",
            Target = entry.File,
            Ip = ip,
            Details = System.Text.Json.JsonSerializer.Serialize(new { backup = entry.Id, kind = entry.Kind, safetyBackup = safety.File },
                System.Text.Json.JsonSerializerOptions.Web),
        });
        await db.SaveChangesAsync(ct);

        instanceSettings.Invalidate();
        backupSettings.Invalidate();
        backups.ForgetLastHash();
        if (settings.IsDesktop) DesktopOwner.Ensure(scope.ServiceProvider, logger);
        logger.LogWarning("Sicherung {File} wiederhergestellt (vorher gesichert als {Safety}). Alle Sitzungen wurden beendet.", entry.File, safety.File);
    }

    /// <summary>Online backup API from a file into the live database, then the migrations. Throws on any failure.</summary>
    private async Task WriteIntoLiveAsync(string source, CancellationToken ct)
    {
        CopyIntoLive(source);
        if (AfterCopyForTests is { } hook) await hook();
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync(ct);
        // The schema was checked before, but the append-only triggers are always recreated from the app's own text
        AppendOnlyTriggers.Ensure(settings.DatabaseFile);
    }

    /// <summary>Tests only: runs after the copy into the live database, before the migrations (to simulate a failure there).</summary>
    internal Func<Task>? AfterCopyForTests { get; set; }

    private void CopyIntoLive(string source)
    {
        SqliteConnection.ClearAllPools();
        using (var from = new SqliteConnection(SqliteDatabase.ConnectionString(source, pooling: false, SqliteOpenMode.ReadOnly)))
        using (var target = new SqliteConnection(SqliteDatabase.ConnectionString(settings.DatabaseFile, pooling: false)))
        {
            from.Open();
            target.Open();
            SqliteDatabase.Execute(target, $"PRAGMA busy_timeout = {SqliteDatabase.BusyTimeoutMilliseconds};");
            from.BackupDatabase(target);
            SqliteDatabase.Scalar(target, "PRAGMA journal_mode = WAL;");
        }
        SqliteConnection.ClearAllPools();
    }

    /// <summary>Writes the pre-restore safety backup back into the live database; false when even that failed (logged as critical).</summary>
    private bool RollBack(string safetyFile)
    {
        try
        {
            CopyIntoLive(safetyFile);
            logger.LogWarning("Stand von vorher aus {File} zurückgeschrieben.", Path.GetFileName(safetyFile));
            return true;
        }
        catch (Exception ex) when (ex is SqliteException or IOException)
        {
            logger.LogCritical(ex, "Zurückschreiben der Sicherung {File} fehlgeschlagen. Die Datenbank kann unvollständig sein - bitte diese Sicherung wiederherstellen.",
                safetyFile);
            return false;
        }
    }

    /// <summary>The API answer for an unusable backup file. Technical details (SQLite messages) go to the German log only.</summary>
    public static void ThrowIfUnusable(BackupCheck check, string? detail, ILogger logger)
    {
        if (check != BackupCheck.Ok) logger.LogWarning("Sicherungsdatei abgelehnt ({Check}): {Detail}", check, detail);
        switch (check)
        {
            case BackupCheck.Ok:
                return;
            case BackupCheck.TooNew:
                throw new ApiException(StatusCodes.Status409Conflict, "backup.too_new",
                    "This backup comes from a newer version of the app and cannot be used by this one. Update the app first.",
                    new Dictionary<string, object?> { ["migrations"] = detail });
            case BackupCheck.NotSqlite:
                throw new ApiException(StatusCodes.Status400BadRequest, "backup.invalid", "The file is not a database backup.",
                    new Dictionary<string, object?> { ["reason"] = "not_sqlite" });
            case BackupCheck.SchemaMismatch:
                throw new ApiException(StatusCodes.Status400BadRequest, "backup.invalid",
                    "The database structure of this file differs from what this app creates (for example additional triggers), so it is not used.",
                    new Dictionary<string, object?> { ["reason"] = "schema_mismatch" });
            case BackupCheck.NotAppDatabase:
                throw new ApiException(StatusCodes.Status400BadRequest, "backup.invalid", "The file is a database, but not a backup of this app.",
                    new Dictionary<string, object?> { ["reason"] = "not_app_database" });
            default:
                throw new ApiException(StatusCodes.Status400BadRequest, "backup.invalid", "The backup file is damaged.",
                    new Dictionary<string, object?> { ["reason"] = "damaged" });
        }
    }
}
