using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Cv.Server.Configuration;
using Cv.Server.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Cv.Server.Backups;

public enum BackupOutcome
{
    Created,
    Unchanged,
    Failed,
}

public static class BackupKinds
{
    public const string Start = "start";
    public const string Shutdown = "shutdown";
    public const string Scheduled = "scheduled";
    public const string Manual = "manual";
    public const string PreRestore = "pre-restore";
    public const string Uploaded = "uploaded";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal) { Start, Shutdown, Scheduled, Manual, PreRestore, Uploaded };
}

/// <summary>One backup file as the admin API lists it. <see cref="Id"/> = "&lt;tier&gt;-&lt;stamp&gt;-&lt;kind&gt;", the only handle the API accepts.</summary>
public sealed record BackupEntry(string Id, string File, DateTime CreatedAt, long SizeBytes, string Kind, string Tier)
{
    [System.Text.Json.Serialization.JsonIgnore]
    public string FullPath { get; init; } = "";
}

public sealed record BackupResult(BackupOutcome Outcome, BackupEntry? Entry, string? Problem);

/// <summary>Why a file cannot be used as a backup.</summary>
public enum BackupCheck
{
    Ok,
    NotSqlite,
    Damaged,
    NotAppDatabase,
    TooNew,

    /// <summary>The schema differs from what the migrations create (e.g. smuggled triggers or views, a missing append-only trigger).</summary>
    SchemaMismatch,
}

/// <summary>
/// Backups of the SQLite file, the same for every host:
/// <list type="bullet">
/// <item><b>How:</b> SQLite's online backup API (a consistent copy while the server keeps writing) - never a copy of the live file.</item>
/// <item><b>Only when something changed:</b> a hash of the content (schema plus every row of every table in a fixed order) is compared
/// with the last kept backup; otherwise an empty database after a data loss would push the last good backups out of the rotation.</item>
/// <item><b>Verified:</b> <c>PRAGMA integrity_check</c> on the copy must answer "ok", else the copy is discarded.</item>
/// <item><b>Kept:</b> <c>recent/</c> the newest N, <c>daily/</c> the first backup of each day for D days (both from the backup settings);
/// <c>uploaded/</c> is never pruned. Only files named <c>app-&lt;yyyyMMdd-HHmmss&gt;-&lt;kind&gt;.db</c> are ever deleted.</item>
/// </list>
/// </summary>
public sealed partial class BackupService(ServerSettings settings, BackupSettingsStore backupSettings, ILogger<BackupService> logger, TimeProvider time)
{
    public const string Prefix = "app";
    public const string Extension = ".db";

    public const string TierRecent = "recent";
    public const string TierDaily = "daily";
    public const string TierUploaded = "uploaded";

    /// <summary>
    /// Tables that do not count as "content changed": EF Core's migration lock, and the sign-in state (sessions, refresh tokens) - every
    /// token refresh rewrites those, and they are not the users' data.
    /// </summary>
    private static readonly HashSet<string> VolatileTables = new(StringComparer.Ordinal) { "__EFMigrationsLock", "sessions", "refresh_tokens" };

    /// <summary>Columns that change with every sign-in or save without changing the content (time stamps, the last used TOTP step).</summary>
    private static readonly HashSet<string> VolatileColumns = new(StringComparer.Ordinal)
    {
        "app_settings.UpdatedAt", "users.LastLoginAt", "users.TotpLastUsedStep",
    };

    /// <summary>Activity entries about backups, sign-ins and sessions are written by the backups themselves and by every login: no content change.</summary>
    private const string ActivityFilter = " WHERE \"Action\" NOT LIKE 'backup.%' AND \"Action\" NOT LIKE 'auth.%' AND \"Action\" NOT LIKE 'session.%'";

    private static readonly byte[] SqliteHeader = "SQLite format 3\0"u8.ToArray();

    [GeneratedRegex(@"^app-(\d{8}-\d{6})-(start|shutdown|scheduled|manual|pre-restore|uploaded)\.db$")]
    private static partial Regex NamePattern();

    private readonly SemaphoreSlim _gate = new(1, 1);

    public string Root => settings.BackupDirectory;

    public string Dir(string tier) => Path.Combine(Root, tier);

    private string HashFile => Path.Combine(Root, ".last-hash");

    /// <summary>Serialises backups and restores (a restore holds it while it replaces the database).</summary>
    internal SemaphoreSlim Gate => _gate;

    /// <param name="kind">One of <see cref="BackupKinds"/>; also used in the log.</param>
    /// <param name="force">Keep the copy even when nothing changed (the safety backup before a restore).</param>
    public async Task<BackupResult> RunAsync(string kind, bool force, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            return await RunLockedAsync(kind, force, ct);
        }
        finally
        {
            _gate.Release();
        }
    }

    internal async Task<BackupResult> RunLockedAsync(string kind, bool force, CancellationToken ct)
    {
        string? temp = null;
        try
        {
            if (!File.Exists(settings.DatabaseFile))
            {
                logger.LogWarning("Sicherung ({Kind}): keine Datenbank unter {File} - nichts zu sichern.", kind, settings.DatabaseFile);
                return new BackupResult(BackupOutcome.Failed, null, "The database file does not exist.");
            }
            var options = await backupSettings.GetAsync(ct);
            Directory.CreateDirectory(Dir(TierRecent));
            Directory.CreateDirectory(Dir(TierDaily));

            temp = Path.Combine(Dir(TierRecent), $".tmp-{Guid.NewGuid():N}{Extension}");
            Snapshot(settings.DatabaseFile, temp);
            if (Verify(temp) is { } problem)
            {
                logger.LogError("Sicherung ({Kind}): die Kopie ist nicht in Ordnung ({Problem}) - verworfen.", kind, problem);
                return new BackupResult(BackupOutcome.Failed, null, "The backup copy failed its integrity check: " + problem);
            }

            var hash = ContentHash(temp);
            if (!force && File.Exists(HashFile) && (await File.ReadAllTextAsync(HashFile, ct)).Trim() == hash)
            {
                logger.LogInformation("Sicherung ({Kind}): keine Änderung seit der letzten Sicherung - übersprungen.", kind);
                return new BackupResult(BackupOutcome.Unchanged, null, null);
            }

            var final = FreeName(Dir(TierRecent), kind, out var now);
            File.Move(temp, final);
            temp = null;
            await File.WriteAllTextAsync(HashFile, hash, ct);
            if (options.KeepDailyDays > 0 && !Directory.GetFiles(Dir(TierDaily), DayPattern(now)).Any(f => Parse(f) is not null))
            {
                File.Copy(final, Path.Combine(Dir(TierDaily), Path.GetFileName(final)));
            }
            Prune(options, now);
            var entry = Describe(final, TierRecent)!;
            logger.LogInformation("Sicherung ({Kind}) angelegt: {File} ({Bytes} Bytes).", kind, entry.File, entry.SizeBytes);
            return new BackupResult(BackupOutcome.Created, entry, null);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or SqliteException)
        {
            logger.LogError("Sicherung ({Kind}) fehlgeschlagen: {Message}", kind, ex.Message);
            return new BackupResult(BackupOutcome.Failed, null, ex.Message);
        }
        finally
        {
            if (temp is not null) TryDelete(temp);
        }
    }

    /// <summary>All backups, newest first.</summary>
    public IReadOnlyList<BackupEntry> List()
    {
        var result = new List<BackupEntry>();
        foreach (var tier in new[] { TierRecent, TierDaily, TierUploaded })
        {
            var dir = Dir(tier);
            if (!Directory.Exists(dir)) continue;
            foreach (var file in Directory.GetFiles(dir, Prefix + "-*" + Extension))
            {
                if (Describe(file, tier) is { } entry) result.Add(entry);
            }
        }
        return result.OrderByDescending(e => e.CreatedAt).ThenBy(e => e.Tier, StringComparer.Ordinal).ToList();
    }

    /// <summary>The backup with this id - only ids from <see cref="List"/> are accepted (no paths).</summary>
    public BackupEntry? Find(string? id) =>
        string.IsNullOrEmpty(id) || id.Length > 64 ? null : List().FirstOrDefault(e => string.Equals(e.Id, id, StringComparison.Ordinal));

    /// <summary>
    /// Deletes one listed backup file; false when a backup or restore holds the lock right now. Deleting the newest recent backup also
    /// forgets its content hash, so the next run makes a new copy of the current state instead of answering "unchanged".
    /// </summary>
    public async Task<bool> TryDeleteAsync(BackupEntry entry)
    {
        if (!await _gate.WaitAsync(0)) return false;
        try
        {
            var newest = Latest();
            File.Delete(entry.FullPath);
            if (newest?.Id == entry.Id) ForgetLastHash();
            logger.LogInformation("Sicherung {File} ({Tier}) gelöscht.", entry.File, entry.Tier);
            return true;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>The newest entry of the recent tier (the current state when nothing changed since).</summary>
    public BackupEntry? Latest() => List().FirstOrDefault(e => e.Tier == TierRecent);

    /// <summary>
    /// Checks an uploaded file and stores it as kind <c>uploaded</c>. The source file is moved away (it must be a temporary file).
    /// </summary>
    public async Task<(BackupCheck Check, BackupEntry? Entry, string? Detail)> StoreUploadAsync(string tempFile, IReadOnlyCollection<string> knownMigrations, CancellationToken ct)
    {
        var (check, detail) = await CheckAsync(tempFile, knownMigrations, ct);
        if (check != BackupCheck.Ok) return (check, null, detail);
        Directory.CreateDirectory(Dir(TierUploaded));
        var final = FreeName(Dir(TierUploaded), BackupKinds.Uploaded, out _);
        File.Move(tempFile, final);
        logger.LogInformation("Hochgeladene Sicherung gespeichert: {File}.", Path.GetFileName(final));
        return (BackupCheck.Ok, Describe(final, TierUploaded), null);
    }

    /// <summary>Is this file a usable backup of this app (SQLite, intact, our tables, no migrations this build does not know)?</summary>
    public static async Task<(BackupCheck Check, string? Detail)> CheckAsync(string file, IReadOnlyCollection<string> knownMigrations, CancellationToken ct)
    {
        var header = new byte[SqliteHeader.Length];
        await using (var stream = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.Read))
        {
            if (await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, ct) < header.Length || !header.SequenceEqual(SqliteHeader))
            {
                return (BackupCheck.NotSqlite, "The file is not an SQLite database.");
            }
        }
        try
        {
            // An uploaded database can be in WAL mode: switch it to a plain journal first, so no -wal/-shm files appear next to it
            MakeSelfContained(file);
            if (Verify(file) is { } problem) return (BackupCheck.Damaged, problem);
            using var connection = OpenUntrusted(file, SqliteOpenMode.ReadOnly);
            if (!TableExists(connection, "__EFMigrationsHistory") || !TableExists(connection, "users") || !TableExists(connection, "app_settings"))
            {
                return (BackupCheck.NotAppDatabase, "The file is not a database of this app.");
            }
            var applied = new List<string>();
            using (var command = connection.CreateCommand())
            {
                command.CommandText = "SELECT \"MigrationId\" FROM \"__EFMigrationsHistory\"";
                using var reader = command.ExecuteReader();
                while (reader.Read()) applied.Add(reader.GetString(0));
            }
            var unknown = applied.Where(id => !knownMigrations.Contains(id)).ToList();
            if (unknown.Count > 0) return (BackupCheck.TooNew, string.Join(", ", unknown));

            // The file may only contain what the migrations create - no extra triggers, views or tables, nothing missing
            var last = applied.Count == 0 ? null : applied.Max(StringComparer.Ordinal);
            var expected = ReferenceSchema(last);
            var actual = Schema(connection);
            if (!expected.SetEquals(actual))
            {
                var extra = actual.Except(expected).Select(DescribeSchemaEntry);
                var missing = expected.Except(actual).Select(DescribeSchemaEntry);
                return (BackupCheck.SchemaMismatch, $"extra: [{string.Join("; ", extra)}] missing: [{string.Join("; ", missing)}]");
            }
            return (BackupCheck.Ok, null);
        }
        catch (SqliteException ex)
        {
            return (BackupCheck.Damaged, ex.Message);
        }
        finally
        {
            DeleteSideFiles(file);
        }
    }

    /// <summary>Switches a database file (that nobody else uses) to the plain rollback journal: one file, no -wal/-shm next to it.</summary>
    internal static void MakeSelfContained(string file)
    {
        using var connection = OpenUntrusted(file, SqliteOpenMode.ReadWrite);
        SqliteDatabase.Scalar(connection, "PRAGMA journal_mode = DELETE;");
    }

    /// <summary>
    /// Opens a file that may come from outside (an upload) with <c>trusted_schema = OFF</c>: SQL functions with side effects cannot be
    /// called from the file's own triggers, views or defaults while it is read.
    /// </summary>
    internal static SqliteConnection OpenUntrusted(string file, SqliteOpenMode mode)
    {
        var connection = new SqliteConnection(SqliteDatabase.ConnectionString(file, pooling: false, mode));
        connection.Open();
        SqliteDatabase.Execute(connection, "PRAGMA trusted_schema = OFF;");
        return connection;
    }

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, HashSet<string>> ReferenceSchemas = new(StringComparer.Ordinal);

    /// <summary>The schema the migrations create up to <paramref name="lastMigration"/> (null: none), built once per migration in a temporary database.</summary>
    internal static HashSet<string> ReferenceSchema(string? lastMigration) => ReferenceSchemas.GetOrAdd(lastMigration ?? "", key =>
    {
        var temp = Path.Combine(Path.GetTempPath(), $"cv-reference-{Guid.NewGuid():N}.db");
        try
        {
            if (key.Length > 0)
            {
                using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(SqliteDatabase.ConnectionString(temp, pooling: false)).Options);
                db.GetService<Microsoft.EntityFrameworkCore.Migrations.IMigrator>().Migrate(key);
            }
            using var connection = new SqliteConnection(SqliteDatabase.ConnectionString(temp, pooling: false));
            connection.Open();
            return Schema(connection);
        }
        finally
        {
            TryDelete(temp);
            DeleteSideFiles(temp);
        }
    });

    /// <summary>
    /// The schema entries of a database as "type|name|table|sql" (whitespace in the SQL collapsed). SQLite's internal objects and EF Core's
    /// migration lock table (created on demand) are left out; the migration history table is compared like every other table.
    /// </summary>
    internal static HashSet<string> Schema(SqliteConnection connection)
    {
        var result = new HashSet<string>(StringComparer.Ordinal);
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT type, name, tbl_name, coalesce(sql, '') FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name <> '__EFMigrationsLock'";
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var sql = WhitespaceRun().Replace(reader.GetString(3), " ").Trim();
            result.Add($"{reader.GetString(0)}|{reader.GetString(1)}|{reader.GetString(2)}|{sql}");
        }
        return result;
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRun();

    private static string DescribeSchemaEntry(string schemaEntry)
    {
        var parts = schemaEntry.Split('|', 4);
        return parts.Length >= 2 ? $"{parts[0]} {parts[1]}" : schemaEntry;
    }

    /// <summary>Removes -wal/-shm/-journal files a check may have left next to a work or upload file.</summary>
    internal static void DeleteSideFiles(string file)
    {
        foreach (var suffix in new[] { "-wal", "-shm", "-journal" }) TryDelete(file + suffix);
    }

    /// <summary>After a restore the restored content is the new reference for "changed since the last backup".</summary>
    internal void ForgetLastHash() => TryDelete(HashFile);

    /// <summary>A consistent copy of the (possibly running) database through SQLite's online backup API, as one self-contained file.</summary>
    public static void Snapshot(string databaseFile, string target)
    {
        using (var source = new SqliteConnection(SqliteDatabase.ConnectionString(databaseFile, pooling: false, SqliteOpenMode.ReadOnly)))
        using (var destination = new SqliteConnection(SqliteDatabase.ConnectionString(target, pooling: false)))
        {
            source.Open();
            SqliteDatabase.Execute(source, $"PRAGMA busy_timeout = {SqliteDatabase.BusyTimeoutMilliseconds};");
            destination.Open();
            source.BackupDatabase(destination);
        }
        using var copy = new SqliteConnection(SqliteDatabase.ConnectionString(target, pooling: false));
        copy.Open();
        // The copy inherits WAL from the source; a backup must be one file without -wal/-shm next to it
        SqliteDatabase.Scalar(copy, "PRAGMA journal_mode = DELETE;");
    }

    /// <summary><c>PRAGMA integrity_check</c> of a file nobody else uses: null when fine, else what is wrong.</summary>
    public static string? Verify(string file)
    {
        try
        {
            using var connection = OpenUntrusted(file, SqliteOpenMode.ReadOnly);
            return SqliteDatabase.IntegrityCheck(connection);
        }
        catch (SqliteException ex)
        {
            return ex.Message;
        }
    }

    /// <summary>
    /// Hash of the content - independent of the page layout: the schema sorted by name, then every row of every table sorted by all hashed
    /// columns, with type tags. Not hashed (no "content change"): the sign-in state (tables sessions and refresh_tokens), time stamps that
    /// change on every sign-in or save (<see cref="VolatileColumns"/>), and activity entries about backups, sign-ins and sessions.
    /// </summary>
    public static string ContentHash(string file)
    {
        using var connection = new SqliteConnection(SqliteDatabase.ConnectionString(file, pooling: false, SqliteOpenMode.ReadOnly));
        connection.Open();
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var tables = new List<string>();
        using (var schema = connection.CreateCommand())
        {
            schema.CommandText = "SELECT type, name, coalesce(sql, '') FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name";
            using var reader = schema.ExecuteReader();
            while (reader.Read())
            {
                var (type, name) = (reader.GetString(0), reader.GetString(1));
                if (VolatileTables.Contains(name)) continue;
                Append(hash, $"S|{type}|{name}|{reader.GetString(2)}\n");
                if (type == "table") tables.Add(name);
            }
        }
        foreach (var table in tables)
        {
            var quoted = Quote(table);
            var columns = new List<string>();
            using (var info = connection.CreateCommand())
            {
                info.CommandText = $"PRAGMA table_info({quoted})";
                using var infoReader = info.ExecuteReader();
                while (infoReader.Read())
                {
                    var column = infoReader.GetString(1);
                    if (!VolatileColumns.Contains($"{table}.{column}")) columns.Add(column);
                }
            }
            if (columns.Count == 0) continue;
            using var rows = connection.CreateCommand();
            var filter = table == "activity_log" ? ActivityFilter : "";
            rows.CommandText = $"SELECT {string.Join(", ", columns.Select(Quote))} FROM {quoted}{filter} ORDER BY {string.Join(", ", Enumerable.Range(1, columns.Count))}";
            Append(hash, $"T|{table}\n");
            using var data = rows.ExecuteReader();
            while (data.Read())
            {
                for (var i = 0; i < data.FieldCount; i++)
                {
                    switch (data.GetValue(i))
                    {
                        case DBNull:
                            Append(hash, "N;");
                            break;
                        case byte[] bytes:
                            Append(hash, $"B{bytes.Length}:");
                            hash.AppendData(bytes);
                            Append(hash, ";");
                            break;
                        case string text:
                            Append(hash, $"S{text.Length}:{text};");
                            break;
                        case var value:
                            Append(hash, $"V:{Convert.ToString(value, CultureInfo.InvariantCulture)};");
                            break;
                    }
                }
                Append(hash, "\n");
            }
        }
        return Convert.ToHexStringLower(hash.GetHashAndReset());
    }

    /// <summary>Stamp (local time) and kind of a file name; null for any name this service did not write.</summary>
    public static (DateTime Stamp, string Kind)? Parse(string path)
    {
        var match = NamePattern().Match(Path.GetFileName(path));
        if (!match.Success) return null;
        return DateTime.TryParseExact(match.Groups[1].Value, "yyyyMMdd-HHmmss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var at)
            ? (at, match.Groups[2].Value)
            : null;
    }

    private BackupEntry? Describe(string path, string tier)
    {
        if (Parse(path) is not { } parsed) return null;
        var info = new FileInfo(path);
        if (!info.Exists) return null;
        var created = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(parsed.Stamp, DateTimeKind.Unspecified), LocalZoneSafe(parsed.Stamp));
        return new BackupEntry($"{tier}-{Stamp(parsed.Stamp)}-{parsed.Kind}", info.Name, created, info.Length, parsed.Kind, tier)
        {
            FullPath = info.FullName,
        };
    }

    // A stamp in the skipped hour of a DST change cannot be converted: fall back to UTC for that one
    private TimeZoneInfo LocalZoneSafe(DateTime stamp) => time.LocalTimeZone.IsInvalidTime(stamp) ? TimeZoneInfo.Utc : time.LocalTimeZone;

    /// <summary>"app-20261104-020000-manual.db" - always Gregorian digits, whatever the culture of the machine (file names are identifiers).</summary>
    internal static string FileName(DateTime at, string kind) => $"{Prefix}-{Stamp(at)}-{kind}{Extension}";

    internal static string Stamp(DateTime at) => at.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture);

    internal static string DayPattern(DateTime at) => $"{Prefix}-{at.ToString("yyyyMMdd", CultureInfo.InvariantCulture)}-*{Extension}";

    private string FreeName(string dir, string kind, out DateTime now)
    {
        now = time.GetLocalNow().DateTime;
        // Two backups within one second must never overwrite each other
        while (Directory.GetFiles(dir, $"{Prefix}-{Stamp(now)}-*{Extension}").Length > 0) now = now.AddSeconds(1);
        return Path.Combine(dir, FileName(now, kind));
    }

    private static string Quote(string name) => "\"" + name.Replace("\"", "\"\"", StringComparison.Ordinal) + "\"";

    private void Prune(BackupSettings options, DateTime now)
    {
        foreach (var old in Retention.ToDelete(Directory.GetFiles(Dir(TierRecent), Prefix + "-*" + Extension),
                     Directory.GetFiles(Dir(TierDaily), Prefix + "-*" + Extension), now, options.KeepRecent, options.KeepDailyDays))
        {
            TryDelete(old);
        }
    }

    private static bool TableExists(SqliteConnection connection, string table)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = $name";
        command.Parameters.AddWithValue("$name", table);
        return Convert.ToInt64(command.ExecuteScalar(), CultureInfo.InvariantCulture) > 0;
    }

    private static void Append(IncrementalHash hash, string text) => hash.AppendData(Encoding.UTF8.GetBytes(text));

    internal static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // Left for later; the name never matches the retention pattern
        }
    }

    /// <summary>The retention rules on file names (no clock or disk access, so they can be unit-tested).</summary>
    public static class Retention
    {
        public static IEnumerable<string> ToDelete(IEnumerable<string> recent, IEnumerable<string> daily, DateTime now, int keepRecent, int keepDailyDays)
        {
            var sortedRecent = recent.Select(path => (path, parsed: Parse(path))).Where(e => e.parsed is not null)
                .OrderByDescending(e => e.parsed!.Value.Stamp).ToList();
            foreach (var (path, _) in sortedRecent.Skip(keepRecent)) yield return path;

            var cutoff = now.Date.AddDays(-keepDailyDays);
            foreach (var path in daily)
            {
                if (Parse(path) is { } parsed && (keepDailyDays == 0 || parsed.Stamp.Date < cutoff)) yield return path;
            }
        }
    }
}

/// <summary>Known migration ids of this build (to refuse backups from a newer version).</summary>
public static class KnownMigrations
{
    private static readonly Lazy<IReadOnlyCollection<string>> Ids = new(() =>
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source=:memory:").Options);
        return db.Database.GetMigrations().ToHashSet(StringComparer.Ordinal);
    });

    public static IReadOnlyCollection<string> All => Ids.Value;
}
