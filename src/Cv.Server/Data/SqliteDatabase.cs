using System.Data.Common;
using System.Globalization;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Cv.Server.Data;

/// <summary>
/// How the server opens its SQLite file: WAL journal (readers never block the writer), foreign keys on, a busy timeout on every
/// connection, and a full <c>PRAGMA integrity_check</c> before the first use. A damaged file stops the start - nothing is repaired,
/// deleted or recreated automatically; the operator restores a backup.
/// </summary>
public static class SqliteDatabase
{
    public const int BusyTimeoutMilliseconds = 10_000;

    public static string ConnectionString(string file, bool pooling = true, SqliteOpenMode mode = SqliteOpenMode.ReadWriteCreate) =>
        new SqliteConnectionStringBuilder
        {
            DataSource = file,
            Mode = mode,
            Pooling = pooling,
            ForeignKeys = true,
            DefaultTimeout = 30,
        }.ToString();

    /// <summary>Checks an existing file, switches it to WAL and applies the EF Core migrations. Throws <see cref="DatabaseRefusedException"/> on a damaged file.</summary>
    public static void Prepare(string file, IServiceProvider services, ILogger logger)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        var existed = File.Exists(file) && new FileInfo(file).Length > 0;
        using (var connection = new SqliteConnection(ConnectionString(file, pooling: false)))
        {
            try
            {
                connection.Open();
                Execute(connection, $"PRAGMA busy_timeout = {BusyTimeoutMilliseconds};");
                if (existed)
                {
                    var problem = IntegrityCheck(connection);
                    if (problem is not null)
                    {
                        logger.LogCritical("Datenbankprüfung (integrity_check) für {File} fehlgeschlagen: {Problem}. Der Server startet nicht; nichts wurde verändert. Bitte eine Sicherung wiederherstellen.", file, problem);
                        throw new DatabaseRefusedException($"Die Datenbank {file} ist beschädigt: {problem}");
                    }
                    logger.LogInformation("Datenbankprüfung (integrity_check) für {File}: ok.", file);
                }
                else
                {
                    logger.LogInformation("Neue Datenbank {File} wird angelegt.", file);
                }
                var mode = Convert.ToString(Scalar(connection, "PRAGMA journal_mode = WAL;"), CultureInfo.InvariantCulture);
                if (!string.Equals(mode, "wal", StringComparison.OrdinalIgnoreCase))
                {
                    logger.LogWarning("Datenbank {File}: WAL-Modus nicht aktiv (Modus {Mode}).", file, mode);
                }
            }
            catch (SqliteException ex) when (ex.SqliteErrorCode is SQLitePCL.raw.SQLITE_CORRUPT or SQLitePCL.raw.SQLITE_NOTADB)
            {
                logger.LogCritical("Datenbank {File} ist beschädigt oder keine SQLite-Datei ({Message}). Der Server startet nicht; nichts wurde verändert.", file, ex.Message);
                throw new DatabaseRefusedException($"Die Datenbank {file} ist beschädigt: {ex.Message}", ex);
            }
        }

        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var pending = db.Database.GetPendingMigrations().ToList();
        if (pending.Count > 0)
        {
            logger.LogInformation("Wende {Count} Datenbank-Migration(en) an: {Migrations}", pending.Count, string.Join(", ", pending));
        }
        db.Database.Migrate();
        // Whatever a database file brought along: the append-only triggers are always the app's own
        AppendOnlyTriggers.Ensure(file);
    }

    /// <summary><c>PRAGMA integrity_check</c>: null when the file is fine, else the first lines SQLite reported.</summary>
    public static string? IntegrityCheck(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA integrity_check;";
        var lines = new List<string>();
        using var reader = command.ExecuteReader();
        while (reader.Read() && lines.Count < 5) lines.Add(reader.GetString(0));
        return lines is ["ok"] ? null : string.Join("; ", lines);
    }

    internal static void Execute(SqliteConnection connection, string sql)
    {
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.ExecuteNonQuery();
    }

    internal static object? Scalar(SqliteConnection connection, string sql)
    {
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        return command.ExecuteScalar();
    }
}

/// <summary>Sets the busy timeout (not stored in the file) on every connection EF Core opens.</summary>
public sealed class SqliteConnectionSetup : DbConnectionInterceptor
{
    private static readonly string Pragmas = $"PRAGMA busy_timeout = {SqliteDatabase.BusyTimeoutMilliseconds};";

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        using var command = connection.CreateCommand();
        command.CommandText = Pragmas;
        command.ExecuteNonQuery();
    }

    public override async Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = Pragmas;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}

/// <summary>The server must not start on this database (damaged). Nothing was changed.</summary>
public sealed class DatabaseRefusedException(string message, Exception? inner = null) : Exception(message, inner);
