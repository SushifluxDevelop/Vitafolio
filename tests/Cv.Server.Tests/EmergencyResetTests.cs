using System.Net;
using Cv.Server.Auth;
using Cv.Server.Data;
using Cv.Server.Tests.Support;

namespace Cv.Server.Tests;

public sealed class EmergencyResetTests(ServerFixture server) : IClassFixture<ServerFixture>
{
    [Fact]
    public async Task Request_creates_token_and_confirm_resets_password_and_disables_2fa()
    {
        var admin = await server.AdminAsync();

        // Admin enables two-factor authentication
        var setup = await (await admin.PostAsync("/api/account/2fa/totp/setup")).JsonAsync();
        var secret = Base32.Decode(setup.GetProperty("secret").GetString()!);
        var step = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        var totpCode = Totp.Compute(secret, step);
        var enable = await admin.PostAsync("/api/account/2fa/totp/enable", new { code = totpCode, currentPassword = ServerFixture.AdminPassword });
        Assert.Equal(HttpStatusCode.OK, enable.StatusCode);

        // Verify admin currently requires 2FA to log in
        var clientBefore = server.Client();
        var login1 = await clientBefore.PostAsync("/api/auth/login", new { username = "admin", password = ServerFixture.AdminPassword });
        Assert.Equal(HttpStatusCode.OK, login1.StatusCode);
        Assert.True((await login1.JsonAsync()).GetProperty("twoFactorRequired").GetBoolean());

        // Anonymous client requests emergency reset
        var anon = server.Client();
        var req = await anon.PostAsync("/api/auth/emergency-reset/request", new { });
        Assert.Equal(HttpStatusCode.OK, req.StatusCode);

        var token = server.EmergencyToken();
        Assert.NotEmpty(token);

        // Wrong code fails
        var wrong = await anon.PostAsync("/api/auth/emergency-reset/confirm", new { code = "WRONG-CODE-1234-5678", newPassword = "new-admin-password-123" });
        Assert.Equal(HttpStatusCode.Forbidden, wrong.StatusCode);
        Assert.Equal("emergency_reset.code_invalid", await wrong.CodeAsync());

        // Weak password fails validation
        var weak = await anon.PostAsync("/api/auth/emergency-reset/confirm", new { code = token, newPassword = "short" });
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
        Assert.Equal("validation.min_length", (await weak.JsonAsync()).GetProperty("errors").GetProperty("newPassword")[0].GetProperty("code").GetString());

        // Correct confirmation
        var confirm = await anon.PostAsync("/api/auth/emergency-reset/confirm", new { code = token, newPassword = "new-admin-password-123" });
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        var confirmJson = await confirm.JsonAsync();
        Assert.True(confirmJson.GetProperty("success").GetBoolean());
        Assert.Equal("admin", confirmJson.GetProperty("username").GetString());

        // Token file is consumed
        Assert.Empty(server.EmergencyToken());

        // Replay fails
        var replay = await anon.PostAsync("/api/auth/emergency-reset/confirm", new { code = token, newPassword = "another-password-123" });
        Assert.Equal(HttpStatusCode.Forbidden, replay.StatusCode);
        Assert.Equal("emergency_reset.code_invalid", await replay.CodeAsync());

        // Admin can now log in directly with the new password without 2FA
        var clientAfter = server.Client();
        var login2 = await clientAfter.PostAsync("/api/auth/login", new { username = "admin", password = "new-admin-password-123" });
        Assert.Equal(HttpStatusCode.OK, login2.StatusCode);
        var login2Json = await login2.JsonAsync();
        Assert.False(login2Json.TryGetProperty("twoFactorRequired", out _));
        var user = login2Json.GetProperty("user");
        Assert.Equal("admin", user.GetProperty("username").GetString());
        Assert.False(user.GetProperty("twoFactorEnabled").GetBoolean());

        // Old admin session was revoked
        var meOld = await admin.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, meOld.StatusCode);

        // Reset is in activity log
        var log = await (await clientAfter.GetAsync("/api/admin/activity?action=admin.emergency_reset")).JsonAsync();
        Assert.True(log.GetProperty("total").GetInt32() >= 1);

        // Restore default AdminPassword so subsequent tests in this fixture can use server.AdminAsync()
        var restorePass = await clientAfter.PostAsync("/api/account/password", new { currentPassword = "new-admin-password-123", newPassword = ServerFixture.AdminPassword });
        Assert.Equal(HttpStatusCode.NoContent, restorePass.StatusCode);
    }

    [Fact]
    public async Task Emergency_reset_refused_when_multiple_active_admins_exist()
    {
        var admin = await server.AdminAsync();
        // Create second admin
        var addSecond = await admin.PostAsync("/api/admin/users", new
        {
            username = "secondadmin",
            displayName = "Second Admin",
            password = "second-admin-password-123",
            role = Roles.Admin,
        });
        Assert.Equal(HttpStatusCode.Created, addSecond.StatusCode);

        var anon = server.Client();
        var req = await anon.PostAsync("/api/auth/emergency-reset/request", new { });
        Assert.Equal(HttpStatusCode.Conflict, req.StatusCode);
        Assert.Equal("admin.emergency_reset_other_admins_exist", await req.CodeAsync());

        var confirm = await anon.PostAsync("/api/auth/emergency-reset/confirm", new { code = "SOME-CODE", newPassword = "new-password-123" });
        Assert.Equal(HttpStatusCode.Conflict, confirm.StatusCode);
        Assert.Equal("admin.emergency_reset_other_admins_exist", await confirm.CodeAsync());

        // Clean up second admin so fixture has only 1 admin again
        var secondId = (await addSecond.JsonAsync()).GetProperty("id").GetString();
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/admin/users/{secondId}")).StatusCode);
    }

    [Fact]
    public void Trigger_file_creates_emergency_token()
    {
        var trigger = Path.Combine(server.DataDir, "emergency-reset");
        File.WriteAllText(trigger, "reset");

        var tokenService = (EmergencyToken)server.Factory.Services.GetService(typeof(EmergencyToken))!;
        tokenService.CheckTriggerFile();

        Assert.False(File.Exists(trigger));
        Assert.NotEmpty(server.EmergencyToken());

        tokenService.Consume();
        Assert.Empty(server.EmergencyToken());
    }
}
