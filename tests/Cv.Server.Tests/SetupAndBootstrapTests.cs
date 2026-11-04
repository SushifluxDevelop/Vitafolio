using System.Net;
using Cv.Server.Tests.Support;

namespace Cv.Server.Tests;

public sealed class SetupAndBootstrapTests(ServerFixture server) : IClassFixture<ServerFixture>
{
    [Fact]
    public async Task Setup_works_once_and_bootstrap_follows()
    {
        var client = server.Client();

        var before = await (await client.GetAsync("/api/bootstrap")).JsonAsync();
        Assert.Equal("server", before.GetProperty("mode").GetString());
        Assert.True(before.GetProperty("setupRequired").GetBoolean());
        Assert.False(before.GetProperty("registrationOpen").GetBoolean());
        Assert.False(string.IsNullOrEmpty(before.GetProperty("productName").GetString()));
        Assert.Equal(12, before.GetProperty("rules").GetProperty("password").GetProperty("minLength").GetInt32());
        Assert.Equal("^[A-Za-z0-9._-]+$", before.GetProperty("rules").GetProperty("username").GetProperty("pattern").GetString());
        Assert.Equal(["de", "en"], before.GetProperty("languages").EnumerateArray().Select(l => l.GetString()));

        // Invalid input: specific field errors, nothing created
        var invalid = await client.PostAsync("/api/setup", new { username = "a", displayName = "", password = "short", setupToken = server.SetupToken() });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var problem = await invalid.JsonAsync();
        Assert.Equal("validation.failed", problem.GetProperty("code").GetString());
        var errors = problem.GetProperty("errors");
        Assert.Equal("validation.min_length", errors.GetProperty("username")[0].GetProperty("code").GetString());
        Assert.Equal(3, errors.GetProperty("username")[0].GetProperty("params").GetProperty("min").GetInt32());
        Assert.Equal("validation.required", errors.GetProperty("displayName")[0].GetProperty("code").GetString());
        Assert.Equal("validation.min_length", errors.GetProperty("password")[0].GetProperty("code").GetString());

        // The one-time setup code is required: missing or wrong -> 403
        Assert.True(before.GetProperty("setupTokenRequired").GetBoolean());
        var token = server.SetupToken();
        Assert.Matches(@"^([A-Z2-9]{4}-){6}[A-Z2-9]{4}$", token);
        var noToken = await client.PostAsync("/api/setup", new { username = "Admin", displayName = "Die Chefin", password = ServerFixture.AdminPassword });
        Assert.Equal(HttpStatusCode.Forbidden, noToken.StatusCode);
        Assert.Equal("setup.token_invalid", await noToken.CodeAsync());
        var wrongToken = await client.PostAsync("/api/setup", new { username = "Admin", displayName = "Die Chefin", password = ServerFixture.AdminPassword, setupToken = "AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA" });
        Assert.Equal("setup.token_invalid", await wrongToken.CodeAsync());

        // Dashes, spaces and case do not matter
        var setup = await client.PostAsync("/api/setup", new { username = "Admin", displayName = "Die Chefin", password = ServerFixture.AdminPassword, setupToken = token.Replace("-", " ").ToLowerInvariant() });
        Assert.Equal(HttpStatusCode.OK, setup.StatusCode);
        var user = (await setup.JsonAsync()).GetProperty("user");
        Assert.Equal("admin", user.GetProperty("role").GetString());
        Assert.Equal("Admin", user.GetProperty("username").GetString());
        Assert.True(client.Cookies.ContainsKey("cv_access"));
        Assert.True(client.Cookies.ContainsKey("cv_refresh"));

        // Logged in right away
        var me = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);

        // Second setup: refused, even from another client
        var again = await server.Client().PostAsync("/api/setup", new { username = "other", displayName = "Other", password = "another-password-1", setupToken = token });
        Assert.Equal("", server.SetupToken());
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal("setup.already_done", await again.CodeAsync());

        var after = await (await client.GetAsync("/api/bootstrap")).JsonAsync();
        Assert.False(after.GetProperty("setupRequired").GetBoolean());

        // Registration is closed by default
        var register = await server.Client().PostAsync("/api/auth/register", new { username = "guest", displayName = "Guest", password = "guest-password-1" });
        Assert.Equal(HttpStatusCode.Forbidden, register.StatusCode);
        Assert.Equal("registration.closed", await register.CodeAsync());

        // ... and opens with the database-backed setting
        var put = await client.PutAsync("/api/admin/settings", new { registrationOpen = true, requireTwoFactor = false });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        Assert.True((await (await client.GetAsync("/api/bootstrap")).JsonAsync()).GetProperty("registrationOpen").GetBoolean());
        var registered = await server.Client().PostAsync("/api/auth/register", new { username = "guest", displayName = "Guest", password = "guest-password-1" });
        Assert.Equal(HttpStatusCode.OK, registered.StatusCode);
        Assert.Equal("user", (await registered.JsonAsync()).GetProperty("user").GetProperty("role").GetString());

        // Usernames are case-insensitive
        var taken = await client.PostAsync("/api/admin/users", new { username = "GUEST", displayName = "x", password = "guest-password-2", role = "user" });
        Assert.Equal(HttpStatusCode.Conflict, taken.StatusCode);
        Assert.Equal("user.username_taken", await taken.CodeAsync());
    }

    [Fact]
    public async Task Health_version_and_unknown_api_routes()
    {
        var client = server.Client();
        var health = await (await client.GetAsync("/api/health")).JsonAsync();
        Assert.Equal("ok", health.GetProperty("status").GetString());

        var version = await (await client.GetAsync("/api/version")).JsonAsync();
        Assert.Equal("dev", version.GetProperty("channel").GetString());
        var shortVersion = version.GetProperty("short").GetString()!;
        Assert.StartsWith(shortVersion, version.GetProperty("version").GetString());
        Assert.Matches(@"-dev\)?$",version.GetProperty("version").GetString());

        var unknown = await client.GetAsync("/api/does-not-exist");
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
        Assert.Equal("not_found", await unknown.CodeAsync());

        var anonymous = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal("auth.required", await anonymous.CodeAsync());
        Assert.Equal("nosniff", anonymous.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Contains("frame-ancestors 'none'", anonymous.Headers.GetValues("Content-Security-Policy").Single());
    }

    [Fact]
    public async Task Csrf_header_is_required_on_state_changing_requests()
    {
        var client = server.Client();
        var response = await client.PostAsync("/api/auth/login", new { username = "admin", password = "whatever-password" }, csrf: false);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("csrf.missing", await response.CodeAsync());

        // GET needs no header
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/bootstrap")).StatusCode);
    }
}
