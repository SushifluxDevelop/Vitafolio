using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using Cv.Server.Auth;
using Cv.Server.Backups;
using Cv.Server.Data;
using Cv.Server.Tests.Support;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace Cv.Server.Tests;

/// <summary>Regression tests for the findings of the code review (backups, restore, 2FA, cleanup).</summary>
public sealed class ReviewRegressionTests(ServerFixture server) : IClassFixture<ServerFixture>
{
    private static readonly object Credentials = new { password = ServerFixture.AdminPassword };

    [Fact]
    public async Task Scheduled_backup_then_manual_is_unchanged_even_after_sign_ins()
    {
        var admin = await server.AdminAsync();
        var worker = server.Factory.Services.GetServices<IHostedService>().OfType<BackupWorker>().Single();
        var scheduled = await worker.RunAutomaticAsync(BackupKinds.Scheduled, TestContext.Current.CancellationToken);
        Assert.NotEqual(BackupOutcome.Failed, scheduled.Outcome);

        // Sign-in state changes (refresh rotation, another session, failed login) are no content change
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync("/api/auth/refresh")).StatusCode);
        await server.AdminAsync();
        await server.Client().PostAsync("/api/auth/login", new { username = "admin", password = "wrong-password-1" });

        var manual = await admin.PostAsync("/api/admin/backups");
        Assert.Equal(HttpStatusCode.Conflict, manual.StatusCode);
        Assert.Equal("backup.unchanged", await manual.CodeAsync());

        // Automatic runs are in the activity log
        var log = await (await admin.GetAsync("/api/admin/activity?action=backup.auto_created")).JsonAsync();
        var unchanged = await (await admin.GetAsync("/api/admin/activity?action=backup.auto_unchanged")).JsonAsync();
        Assert.Equal(1, log.GetProperty("total").GetInt32() + unchanged.GetProperty("total").GetInt32());

        // A real change is seen
        await server.UserAsync(admin, "neuerdaten");
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsync("/api/admin/backups")).StatusCode);
    }

    [Fact]
    public async Task Saving_the_same_backup_settings_twice_logs_one_change()
    {
        var admin = await server.AdminAsync();
        var before = (await (await admin.GetAsync("/api/admin/activity?action=backup.settings_changed")).JsonAsync()).GetProperty("total").GetInt32();
        var body = new
        {
            automaticEnabled = true, onStart = false, beforeShutdown = true,
            schedule = new { kind = "times", intervalHours = 6, times = new[] { "03:00" }, weekdays = new[] { 1, 2, 3, 4, 5 } },
            catchUpMissed = true, keepRecent = 30, keepDailyDays = 60,
        };
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsync("/api/admin/backups/settings", body)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsync("/api/admin/backups/settings", body)).StatusCode);
        var after = (await (await admin.GetAsync("/api/admin/activity?action=backup.settings_changed")).JsonAsync()).GetProperty("total").GetInt32();
        Assert.Equal(before + 1, after);
    }

    [Fact]
    public async Task A_failing_restore_is_rolled_back_to_the_safety_backup()
    {
        var admin = await server.AdminAsync();
        var download = await admin.PostAsync("/api/admin/backups/current/download", Credentials);
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        var bytes = await download.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);

        var uploaded = await Upload(admin, bytes);
        Assert.Equal(HttpStatusCode.Created, uploaded.StatusCode);
        var id = (await uploaded.JsonAsync()).GetProperty("id").GetString();

        // The step after the copy fails (as a failing migration would), with a message that names an internal path
        var restoreService = server.Factory.Services.GetRequiredService<RestoreService>();
        restoreService.AfterCopyForTests = () => throw new IOException("/data/secret/internal/path.db is locked");
        await server.UserAsync(admin, "bleibtda");
        HttpResponseMessage restore;
        try
        {
            restore = await admin.PostAsync($"/api/admin/backups/{id}/restore", Credentials);
        }
        finally
        {
            restoreService.AfterCopyForTests = null;
        }
        Assert.Equal(HttpStatusCode.InternalServerError, restore.StatusCode);
        var problem = await restore.JsonAsync();
        Assert.Equal("backup.restore_failed", problem.GetProperty("code").GetString());
        Assert.True(problem.GetProperty("params").GetProperty("rolledBack").GetBoolean());
        Assert.EndsWith("-pre-restore.db", problem.GetProperty("params").GetProperty("safetyBackup").GetString());
        // Internal details stay in the log
        Assert.DoesNotContain("secret", problem.GetRawText(), StringComparison.OrdinalIgnoreCase);

        // The state from before is back, sign-ins still work, the API is open again
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/auth/me")).StatusCode);
        var users = (await (await admin.GetAsync("/api/admin/users")).JsonAsync()).EnumerateArray().Select(u => u.GetProperty("username").GetString());
        Assert.Contains("bleibtda", users);
    }

    [Fact]
    public async Task Uploading_a_wal_database_leaves_no_side_files()
    {
        var admin = await server.AdminAsync();
        var bytes = await (await admin.PostAsync("/api/admin/backups/current/download", Credentials)).Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        var wal = Modify(bytes, "PRAGMA journal_mode = WAL");
        Assert.Equal(2, wal[18]);
        Assert.Equal(HttpStatusCode.Created, (await Upload(admin, wal)).StatusCode);
        var backupDir = Path.Combine(server.DataDir, "backups");
        var leftovers = Directory.GetFiles(backupDir, "*", SearchOption.AllDirectories)
            .Where(f => f.EndsWith("-wal", StringComparison.Ordinal) || f.EndsWith("-shm", StringComparison.Ordinal) || f.Contains("incoming", StringComparison.Ordinal));
        Assert.Empty(leftovers);
    }

    [Fact]
    public async Task Missing_data_protection_keys_answer_key_unavailable_and_recovery_codes_still_work()
    {
        var admin = await server.AdminAsync();
        var (client, id) = await server.UserAsync(admin, "schluessel");
        var setup = await (await client.PostAsync("/api/account/2fa/totp/setup")).JsonAsync();
        var secret = Base32.Decode(setup.GetProperty("secret").GetString()!);
        var enable = await (await client.PostAsync("/api/account/2fa/totp/enable", new { code = Totp.Compute(secret, Totp.Step(DateTimeOffset.UtcNow)), currentPassword = "user-password-123" })).JsonAsync();
        var recovery = enable.GetProperty("recoveryCodes")[0].GetString();

        // As after restoring into a data folder without the old key ring
        Execute(Path.Combine(server.DataDir, "app.db"), $"UPDATE users SET \"TotpSecretProtected\" = 'CfDJ8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' WHERE \"Id\" = '{id.ToUpperInvariant()}' OR \"Id\" = '{id}'");

        var login = server.Client();
        var step1 = await (await login.PostAsync("/api/auth/login", new { username = "schluessel", password = "user-password-123" })).JsonAsync();
        var challenge = step1.GetProperty("challengeId").GetString();
        var totp = await login.PostAsync("/api/auth/login/2fa", new { challengeId = challenge, code = Totp.Compute(secret, Totp.Step(DateTimeOffset.UtcNow) + 1) });
        Assert.Equal(HttpStatusCode.Conflict, totp.StatusCode);
        Assert.Equal("twofactor.key_unavailable", await totp.CodeAsync());

        var viaRecovery = await login.PostAsync("/api/auth/login/2fa", new { challengeId = challenge, code = recovery });
        Assert.Equal(HttpStatusCode.OK, viaRecovery.StatusCode);
    }

    [Fact]
    public async Task Old_sessions_and_tokens_are_cleaned_up()
    {
        var admin = await server.AdminAsync();
        var (_, id) = await server.UserAsync(admin, "aufraeumen");
        using var scope = server.Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userId = Guid.Parse(id);
        var now = DateTime.UtcNow;
        var old = new Session { Id = Guid.NewGuid(), UserId = userId, CreatedAt = now.AddDays(-90), LastUsedAt = now.AddDays(-60), ExpiresAt = now.AddDays(-31), RevokedAt = now.AddDays(-40) };
        old.RefreshTokens.Add(new RefreshToken { TokenHash = Guid.NewGuid().ToString("N"), CreatedAt = now.AddDays(-60) });
        var recentlyRevoked = new Session { Id = Guid.NewGuid(), UserId = userId, CreatedAt = now.AddDays(-5), LastUsedAt = now.AddDays(-5), ExpiresAt = now.AddDays(25), RevokedAt = now.AddDays(-1) };
        db.Sessions.AddRange(old, recentlyRevoked);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        var (sessions, _) = await SessionCleanupWorker.CleanupAsync(db, now, TestContext.Current.CancellationToken);
        Assert.True(sessions >= 1);
        db.ChangeTracker.Clear();
        Assert.False(db.Sessions.Any(s => s.Id == old.Id));
        Assert.True(db.Sessions.Any(s => s.Id == recentlyRevoked.Id));
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/auth/me")).StatusCode);
    }

    private static async Task<HttpResponseMessage> Upload(TestClient client, byte[] content)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(file, "file", "backup.db");
        form.Add(new StringContent(ServerFixture.AdminPassword), "password");
        return await client.SendAsync(new HttpRequestMessage(HttpMethod.Post, "/api/admin/backups/upload") { Content = form });
    }

    private static byte[] Modify(byte[] database, string sql)
    {
        var file = Path.Combine(Path.GetTempPath(), $"cv-modify-{Guid.NewGuid():N}.db");
        File.WriteAllBytes(file, database);
        try
        {
            Execute(file, sql);
            return File.ReadAllBytes(file);
        }
        finally
        {
            foreach (var path in new[] { file, file + "-wal", file + "-shm" }) File.Delete(path);
        }
    }

    private static void Execute(string file, string sql)
    {
        using var connection = new SqliteConnection($"Data Source={file};Pooling=False");
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.ExecuteNonQuery();
    }
}

/// <summary>A correct TOTP code used twice within its 30 seconds (sign-in, then a sensitive action): a specific answer.</summary>
public sealed class StepUpCodeReuseTests(ServerFixture server) : IClassFixture<ServerFixture>
{
    [Fact]
    public async Task Step_up_with_a_just_used_code_says_so()
    {
        var admin = await server.AdminAsync();
        var setup = await (await admin.PostAsync("/api/account/2fa/totp/setup")).JsonAsync();
        var secret = Base32.Decode(setup.GetProperty("secret").GetString()!);
        var step = Totp.Step(DateTimeOffset.UtcNow);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync("/api/account/2fa/totp/enable", new { code = Totp.Compute(secret, step), currentPassword = ServerFixture.AdminPassword })).StatusCode);

        var reused = await admin.PostAsync("/api/admin/backups/current/download", new { password = ServerFixture.AdminPassword, code = Totp.Compute(secret, step) });
        Assert.Equal(HttpStatusCode.Forbidden, reused.StatusCode);
        Assert.Equal("twofactor.code_already_used", await reused.CodeAsync());

        var wrong = await admin.PostAsync("/api/admin/backups/current/download", new { password = ServerFixture.AdminPassword, code = "000000" == Totp.Compute(secret, step + 1) ? "111111" : "000000" });
        Assert.Equal("auth.reauth_failed", await wrong.CodeAsync());

        var next = await admin.PostAsync("/api/admin/backups/current/download", new { password = ServerFixture.AdminPassword, code = Totp.Compute(secret, step + 1) });
        Assert.Equal(HttpStatusCode.OK, next.StatusCode);
    }
}

public sealed class ReviewUnitTests
{
    [Fact]
    public void Backup_file_names_use_gregorian_digits_in_every_culture()
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = new CultureInfo("ar-SA");
            var at = new DateTime(2026, 11, 4, 2, 0, 0);
            Assert.Equal("app-20261104-020000-manual.db", BackupService.FileName(at, BackupKinds.Manual));
            Assert.Equal("app-20261104-*.db", BackupService.DayPattern(at));
            Assert.NotNull(BackupService.Parse(BackupService.FileName(at, BackupKinds.Manual)));
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    [Fact]
    public async Task Restore_waits_for_requests_in_flight_and_gives_up_after_the_timeout()
    {
        var gate = new MaintenanceGate();
        gate.Enter();
        gate.Enter();
        Assert.False(await RestoreService.WaitForQuietAsync(gate, 1, TimeSpan.FromMilliseconds(200), TimeProvider.System, TestContext.Current.CancellationToken));
        gate.Leave();
        Assert.True(await RestoreService.WaitForQuietAsync(gate, 1, TimeSpan.FromMilliseconds(200), TimeProvider.System, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task An_error_in_the_backup_worker_is_logged_and_does_not_escape()
    {
        var worker = new BackupWorker(null!, null!, null!, null!, TimeProvider.System, NullLogger<BackupWorker>.Instance);
        await worker.GuardedAsync(() => throw new InvalidOperationException("boom"), "Test", TestContext.Current.CancellationToken, TimeSpan.Zero);
    }
}
