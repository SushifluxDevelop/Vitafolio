using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Cv.Server.Tests.Support;
using Microsoft.Data.Sqlite;

namespace Cv.Server.Tests;

public sealed class BackupApiTests(ServerFixture server) : IClassFixture<ServerFixture>
{
    private static readonly object Credentials = new { password = ServerFixture.AdminPassword };

    [Fact]
    public async Task Settings_schedule_and_master_switch()
    {
        var admin = await server.AdminAsync();
        var defaults = await (await admin.GetAsync("/api/admin/backups/settings")).JsonAsync();
        Assert.True(defaults.GetProperty("automaticEnabled").GetBoolean());
        Assert.Equal("interval", defaults.GetProperty("schedule").GetProperty("kind").GetString());
        Assert.Equal(6, defaults.GetProperty("schedule").GetProperty("intervalHours").GetInt32());
        Assert.Equal(28, defaults.GetProperty("nextRuns").GetArrayLength());
        Assert.False(string.IsNullOrEmpty(defaults.GetProperty("timeZone").GetString()));
        Assert.False(string.IsNullOrEmpty(defaults.GetProperty("directory").GetString()));

        var off = await admin.PutAsync("/api/admin/backups/settings", Settings(automaticEnabled: false, kind: "interval"));
        Assert.Equal(HttpStatusCode.OK, off.StatusCode);
        var offBody = await off.JsonAsync();
        Assert.False(offBody.GetProperty("automaticEnabled").GetBoolean());
        Assert.Equal(0, offBody.GetProperty("nextRuns").GetArrayLength());

        var times = await (await admin.PutAsync("/api/admin/backups/settings", Settings(automaticEnabled: true, kind: "times"))).JsonAsync();
        Assert.Equal(["02:00", "14:00"], times.GetProperty("schedule").GetProperty("times").EnumerateArray().Select(t => t.GetString()));
        Assert.Equal(14, times.GetProperty("nextRuns").GetArrayLength());

        var invalid = await admin.PutAsync("/api/admin/backups/settings", new { automaticEnabled = true, schedule = new { kind = "weekly" }, keepRecent = 1 });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var errors = (await invalid.JsonAsync()).GetProperty("errors");
        Assert.True(errors.TryGetProperty("schedule.kind", out _));
        Assert.True(errors.TryGetProperty("keepRecent", out _));

        // Manual backups stay available while automatic ones are off
        await admin.PutAsync("/api/admin/backups/settings", Settings(automaticEnabled: false, kind: "off"));
        var manual = await admin.PostAsync("/api/admin/backups");
        Assert.True(manual.StatusCode is HttpStatusCode.Created or HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Backup_download_upload_and_restore_round_trip()
    {
        var admin = await server.AdminAsync();
        await server.UserAsync(admin, "vorher");

        var created = await admin.PostAsync("/api/admin/backups");
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var entry = await created.JsonAsync();
        Assert.Equal("manual", entry.GetProperty("kind").GetString());
        var id = entry.GetProperty("id").GetString()!;

        var unchanged = await admin.PostAsync("/api/admin/backups");
        Assert.Equal(HttpStatusCode.Conflict, unchanged.StatusCode);
        Assert.Equal("backup.unchanged", await unchanged.CodeAsync());

        var list = (await (await admin.GetAsync("/api/admin/backups")).JsonAsync()).EnumerateArray().ToList();
        Assert.Contains(list, e => e.GetProperty("id").GetString() == id);

        // Step-up: no or a wrong password is refused
        var noPassword = await admin.PostAsync($"/api/admin/backups/{id}/download", new { });
        Assert.Equal(HttpStatusCode.Forbidden, noPassword.StatusCode);
        Assert.Equal("auth.reauth_failed", await noPassword.CodeAsync());
        Assert.Equal("auth.reauth_failed", await (await admin.PostAsync($"/api/admin/backups/{id}/restore", new { password = "wrong-password-1" })).CodeAsync());

        // Only listed ids, no paths
        foreach (var bad in new[] { "..%2F..%2Fapp", "recent-..%5C..%5Capp", "..", "app.db" })
        {
            var traversal = await admin.PostAsync($"/api/admin/backups/{bad}/download", Credentials);
            Assert.Equal(HttpStatusCode.NotFound, traversal.StatusCode);
        }

        var download = await admin.PostAsync($"/api/admin/backups/{id}/download", Credentials);
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        var bytes = await download.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        Assert.Equal("SQLite format 3\0"u8.ToArray(), bytes[..16]);
        Assert.Matches(@"^[a-z0-9]+-backup-\d{4}-\d{2}-\d{2}-\d{4}\.db$", download.Content.Headers.ContentDisposition!.FileNameStar ?? download.Content.Headers.ContentDisposition.FileName!.Trim('"'));

        var current = await admin.PostAsync("/api/admin/backups/current/download", Credentials);
        Assert.Equal(HttpStatusCode.OK, current.StatusCode);

        // Upload: a file that is no SQLite database is refused
        var notSqlite = await Upload(admin, "kein backup"u8.ToArray());
        Assert.Equal(HttpStatusCode.BadRequest, notSqlite.StatusCode);
        Assert.Equal("backup.invalid", await notSqlite.CodeAsync());

        // ... so is a backup of a newer schema
        var newer = await Upload(admin, WithFutureMigration(bytes));
        Assert.Equal(HttpStatusCode.Conflict, newer.StatusCode);
        Assert.Equal("backup.too_new", await newer.CodeAsync());

        var noStepUp = await Upload(admin, bytes, password: null);
        Assert.Equal("auth.reauth_failed", await noStepUp.CodeAsync());

        var uploaded = await Upload(admin, bytes);
        Assert.Equal(HttpStatusCode.Created, uploaded.StatusCode);
        var uploadedEntry = await uploaded.JsonAsync();
        Assert.Equal("uploaded", uploadedEntry.GetProperty("kind").GetString());

        // Something that the restore must take away again
        await server.UserAsync(admin, "nachher");

        var restored = await admin.PostAsync($"/api/admin/backups/{uploadedEntry.GetProperty("id").GetString()}/restore", Credentials);
        Assert.Equal(HttpStatusCode.OK, restored.StatusCode);
        Assert.True((await restored.JsonAsync()).GetProperty("restored").GetBoolean());

        // Every session has ended, including the admin's
        Assert.Equal(HttpStatusCode.Unauthorized, (await admin.GetAsync("/api/auth/me")).StatusCode);
        var again = await server.AdminAsync();
        var users = (await (await again.GetAsync("/api/admin/users")).JsonAsync()).EnumerateArray().Select(u => u.GetProperty("username").GetString()).ToList();
        Assert.Contains("vorher", users);
        Assert.DoesNotContain("nachher", users);

        var log = await (await again.GetAsync("/api/admin/activity?action=backup.restored")).JsonAsync();
        Assert.Equal(1, log.GetProperty("total").GetInt32());
        var kinds = (await (await again.GetAsync("/api/admin/backups")).JsonAsync()).EnumerateArray().Select(e => e.GetProperty("kind").GetString()).ToList();
        Assert.Contains("pre-restore", kinds);
    }

    [Fact]
    public async Task Non_admins_cannot_touch_backups()
    {
        var admin = await server.AdminAsync();
        var (user, _) = await server.UserAsync(admin, "keinadmin");
        Assert.Equal(HttpStatusCode.Forbidden, (await user.GetAsync("/api/admin/backups/settings")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.PostAsync("/api/admin/backups/current/download", new { password = "user-password-123" })).StatusCode);
    }

    private static object Settings(bool automaticEnabled, string kind) => new
    {
        automaticEnabled,
        onStart = true,
        beforeShutdown = true,
        schedule = new { kind, intervalHours = 6, times = new[] { "14:00", "02:00" }, weekdays = new[] { 1, 2, 3, 4, 5, 6, 7 } },
        catchUpMissed = true,
        keepRecent = 20,
        keepDailyDays = 60,
    };

    private static async Task<HttpResponseMessage> Upload(TestClient client, byte[] content, string? password = ServerFixture.AdminPassword)
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(file, "file", "backup.db");
        if (password is not null) form.Add(new StringContent(password), "password");
        return await client.SendAsync(new HttpRequestMessage(HttpMethod.Post, "/api/admin/backups/upload") { Content = form });
    }

    /// <summary>A copy of a backup that claims a migration this build does not know (= made by a newer version).</summary>
    private static byte[] WithFutureMigration(byte[] backup)
    {
        var file = Path.Combine(Path.GetTempPath(), $"cv-future-{Guid.NewGuid():N}.db");
        File.WriteAllBytes(file, backup);
        try
        {
            using (var connection = new SqliteConnection($"Data Source={file};Pooling=False"))
            {
                connection.Open();
                using var command = connection.CreateCommand();
                command.CommandText = "INSERT INTO \"__EFMigrationsHistory\" (\"MigrationId\", \"ProductVersion\") VALUES ('29991231000000_Future', '99.0')";
                command.ExecuteNonQuery();
            }
            return File.ReadAllBytes(file);
        }
        finally
        {
            File.Delete(file);
        }
    }
}
