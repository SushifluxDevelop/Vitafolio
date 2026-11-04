using System.Net;
using Cv.Server.Tests.Support;

namespace Cv.Server.Tests;

public sealed class AdminTests(ServerFixture server) : IClassFixture<ServerFixture>
{
    [Fact]
    public async Task Non_admins_get_403_on_admin_endpoints()
    {
        var admin = await server.AdminAsync();
        var (user, _) = await server.UserAsync(admin, "norbert");
        foreach (var path in new[] { "/api/admin/users", "/api/admin/settings", "/api/admin/activity", "/api/admin/backups" })
        {
            var response = await user.GetAsync(path);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.Equal("auth.forbidden", await response.CodeAsync());
        }
        Assert.Equal(HttpStatusCode.Unauthorized, (await server.Client().GetAsync("/api/admin/users")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/admin/users")).StatusCode);
    }

    [Fact]
    public async Task The_last_admin_is_protected_and_admins_cannot_demote_themselves()
    {
        var admin = await server.AdminAsync();
        var users = (await (await admin.GetAsync("/api/admin/users")).JsonAsync()).EnumerateArray().ToList();
        var adminId = users.Single(u => u.GetProperty("username").GetString() == "admin").GetProperty("id").GetString();

        // Possibly other admins exist from other tests of this class: make sure this one is the only enabled admin
        foreach (var other in users.Where(u => u.GetProperty("role").GetString() == "admin" && u.GetProperty("id").GetString() != adminId))
        {
            await admin.PatchAsync($"/api/admin/users/{other.GetProperty("id").GetString()}", new { role = "user" });
        }

        var demote = await admin.PatchAsync($"/api/admin/users/{adminId}", new { role = "user" });
        Assert.Equal(HttpStatusCode.Conflict, demote.StatusCode);
        Assert.Equal("user.last_admin", await demote.CodeAsync());
        var delete = await admin.DeleteAsync($"/api/admin/users/{adminId}");
        Assert.Equal("user.last_admin", await delete.CodeAsync());

        // With a second admin the self rules apply
        var (second, secondId) = await server.UserAsync(admin, "zweite", role: "admin");
        Assert.Equal("user.self_demote", await (await admin.PatchAsync($"/api/admin/users/{adminId}", new { role = "user" })).CodeAsync());
        Assert.Equal("user.self_disable", await (await admin.PatchAsync($"/api/admin/users/{adminId}", new { disabled = true })).CodeAsync());
        Assert.Equal("user.self_delete", await (await admin.DeleteAsync($"/api/admin/users/{adminId}")).CodeAsync());

        // Disabling an account ends its sessions at once
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsync($"/api/admin/users/{secondId}", new { disabled = true })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await second.GetAsync("/api/auth/me")).StatusCode);
        var login = await server.Client().PostAsync("/api/auth/login", new { username = "zweite", password = "user-password-123" });
        Assert.Equal("auth.disabled", await login.CodeAsync());

        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/admin/users/{secondId}")).StatusCode);
        var log = await (await admin.GetAsync("/api/admin/activity?action=user.deleted")).JsonAsync();
        Assert.Equal(1, log.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Validation_of_admin_input()
    {
        var admin = await server.AdminAsync();
        var bad = await admin.PostAsync("/api/admin/users", new { username = "has space", displayName = "x", password = "long-enough-pw", role = "root" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        var errors = (await bad.JsonAsync()).GetProperty("errors");
        Assert.Equal("validation.pattern", errors.GetProperty("username")[0].GetProperty("code").GetString());
        Assert.Equal("validation.one_of", errors.GetProperty("role")[0].GetProperty("code").GetString());

        var broken = await admin.Http.SendAsync(new HttpRequestMessage(HttpMethod.Put, "/api/admin/settings")
        {
            Content = new StringContent("{not json", System.Text.Encoding.UTF8, "application/json"),
            Headers = { { "X-Cv-Request", "1" }, { "Cookie", string.Join("; ", admin.Cookies.Select(c => $"{c.Key}={c.Value}")) } },
        }, TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.BadRequest, broken.StatusCode);
        Assert.Equal("validation.failed", await broken.CodeAsync());

        var paging = await admin.GetAsync("/api/admin/activity?pageSize=1000");
        Assert.Equal(HttpStatusCode.BadRequest, paging.StatusCode);
    }
}
