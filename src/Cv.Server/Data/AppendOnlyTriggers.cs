using Microsoft.Data.Sqlite;

namespace Cv.Server.Data;

/// <summary>
/// The triggers that make the activity log append-only. The same text is used by the initial migration and by <see cref="Ensure"/>, so
/// the schema of a live database always equals the schema the migrations create (backup checks compare them).
/// </summary>
public static class AppendOnlyTriggers
{
    public const string NoUpdate =
        "CREATE TRIGGER activity_log_no_update BEFORE UPDATE ON activity_log BEGIN SELECT RAISE(ABORT, 'activity_log is append-only'); END;";

    public const string NoDelete =
        "CREATE TRIGGER activity_log_no_delete BEFORE DELETE ON activity_log BEGIN SELECT RAISE(ABORT, 'activity_log is append-only'); END;";

    /// <summary>Recreates both triggers (idempotent) - at every start and after every restore, whatever a database file brought along.</summary>
    public static void Ensure(SqliteConnection connection)
    {
        using var transaction = connection.BeginTransaction();
        foreach (var sql in new[]
                 {
                     "DROP TRIGGER IF EXISTS activity_log_no_update;", "DROP TRIGGER IF EXISTS activity_log_no_delete;", NoUpdate, NoDelete,
                 })
        {
            using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = sql;
            command.ExecuteNonQuery();
        }
        transaction.Commit();
    }

    public static void Ensure(string databaseFile)
    {
        using var connection = new SqliteConnection(SqliteDatabase.ConnectionString(databaseFile, pooling: false));
        connection.Open();
        SqliteDatabase.Execute(connection, $"PRAGMA busy_timeout = {SqliteDatabase.BusyTimeoutMilliseconds};");
        Ensure(connection);
    }
}
