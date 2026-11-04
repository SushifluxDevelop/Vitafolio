using System.Net;
using Cv.Server.Auth;
using Cv.Server.Tests.Support;

namespace Cv.Server.Tests;

public sealed class AuthTests(ServerFixture server) : IClassFixture<ServerFixture>
{
    [Fact]
    public async Task Login_ok_and_failed()
    {
        var admin = await server.AdminAsync();
        await server.UserAsync(admin, "lena");

        var wrong = await server.Client().PostAsync("/api/auth/login", new { username = "lena", password = "wrong-password-123" });
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal("auth.invalid_credentials", await wrong.CodeAsync());

        var unknown = await server.Client().PostAsync("/api/auth/login", new { username = "nobody", password = "wrong-password-123" });
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal("auth.invalid_credentials", await unknown.CodeAsync());

        var empty = await server.Client().PostAsync("/api/auth/login", new { username = "lena" });
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        Assert.Equal("validation.required", (await empty.JsonAsync()).GetProperty("errors").GetProperty("password")[0].GetProperty("code").GetString());

        var client = server.Client();
        var ok = await client.PostAsync("/api/auth/login", new { username = "LENA", password = "user-password-123" });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var user = (await ok.JsonAsync()).GetProperty("user");
        Assert.Equal("lena", user.GetProperty("username").GetString());
        Assert.False(user.GetProperty("twoFactorEnabled").GetBoolean());
        Assert.Equal("system", user.GetProperty("theme").GetString());

        // The failures are in the activity log
        var log = await (await admin.GetAsync("/api/admin/activity?action=auth.login_failed")).JsonAsync();
        Assert.True(log.GetProperty("total").GetInt32() >= 2);

        // Sign-out ends the session: the old access token no longer works
        var access = client.Cookies["cv_access"];
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/auth/logout")).StatusCode);
        var replay = server.Client();
        replay.Cookies["cv_access"] = access;
        var after = await replay.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, after.StatusCode);
        Assert.Equal("auth.invalid", await after.CodeAsync());
    }

    [Fact]
    public async Task Two_factor_login_rejects_replay_and_recovery_codes_work_once()
    {
        var admin = await server.AdminAsync();
        var (client, _) = await server.UserAsync(admin, "toni");

        var setup = await (await client.PostAsync("/api/account/2fa/totp/setup")).JsonAsync();
        var secret = Base32.Decode(setup.GetProperty("secret").GetString()!);
        Assert.StartsWith("otpauth://totp/", setup.GetProperty("otpauthUri").GetString());

        var wrongEnable = await client.PostAsync("/api/account/2fa/totp/enable", new { code = "000000" == Code(secret, 0) ? "111111" : "000000", currentPassword = "user-password-123" });
        Assert.Equal(HttpStatusCode.BadRequest, wrongEnable.StatusCode);
        Assert.Equal("auth.twofactor_invalid", await wrongEnable.CodeAsync());

        var enable = await client.PostAsync("/api/account/2fa/totp/enable", new { code = Code(secret, 0), currentPassword = "user-password-123" });
        Assert.Equal(HttpStatusCode.OK, enable.StatusCode);
        var recovery = (await enable.JsonAsync()).GetProperty("recoveryCodes").EnumerateArray().Select(c => c.GetString()!).ToList();
        Assert.Equal(10, recovery.Count);

        // Password alone is not enough any more
        var first = server.Client();
        var step1 = await (await first.PostAsync("/api/auth/login", new { username = "toni", password = "user-password-123" })).JsonAsync();
        Assert.True(step1.GetProperty("twoFactorRequired").GetBoolean());
        Assert.False(first.Cookies.ContainsKey("cv_access"));
        var challenge = step1.GetProperty("challengeId").GetString();

        // The step used for enabling cannot be used again; the next step can - once
        var replayOfEnable = await first.PostAsync("/api/auth/login/2fa", new { challengeId = challenge, code = Code(secret, 0) });
        Assert.Equal(HttpStatusCode.Unauthorized, replayOfEnable.StatusCode);
        Assert.Equal("twofactor.code_already_used", await replayOfEnable.CodeAsync());

        var next = Code(secret, 1);
        var ok = await first.PostAsync("/api/auth/login/2fa", new { challengeId = challenge, code = next });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.True((await ok.JsonAsync()).GetProperty("user").GetProperty("twoFactorEnabled").GetBoolean());
        Assert.True(first.Cookies.ContainsKey("cv_access"));

        var second = server.Client();
        var step2 = await (await second.PostAsync("/api/auth/login", new { username = "toni", password = "user-password-123" })).JsonAsync();
        var replay = await second.PostAsync("/api/auth/login/2fa", new { challengeId = step2.GetProperty("challengeId").GetString(), code = next });
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
        Assert.Equal("twofactor.code_already_used", await replay.CodeAsync());

        // A recovery code works (any case, with or without the dash) - and only once
        var viaRecovery = await second.PostAsync("/api/auth/login/2fa",
            new { challengeId = step2.GetProperty("challengeId").GetString(), code = recovery[3].ToUpperInvariant().Replace("-", " ") });
        Assert.Equal(HttpStatusCode.OK, viaRecovery.StatusCode);

        var third = server.Client();
        var step3 = await (await third.PostAsync("/api/auth/login", new { username = "toni", password = "user-password-123" })).JsonAsync();
        var reused = await third.PostAsync("/api/auth/login/2fa", new { challengeId = step3.GetProperty("challengeId").GetString(), code = recovery[3] });
        Assert.Equal(HttpStatusCode.Unauthorized, reused.StatusCode);

        // An unknown challenge is refused
        var bogus = await third.PostAsync("/api/auth/login/2fa", new { challengeId = "not-a-challenge", code = recovery[4] });
        Assert.Equal("auth.challenge_invalid", await bogus.CodeAsync());
    }

    [Fact]
    public async Task Refresh_rotates_and_reuse_revokes_the_whole_family()
    {
        var admin = await server.AdminAsync();
        var (client, _) = await server.UserAsync(admin, "rita");

        var firstRefresh = client.Cookies["cv_refresh"];
        var firstAccess = client.Cookies["cv_access"];
        var refreshed = await client.PostAsync("/api/auth/refresh");
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);
        Assert.Equal("rita", (await refreshed.JsonAsync()).GetProperty("user").GetProperty("username").GetString());
        var secondRefresh = client.Cookies["cv_refresh"];
        Assert.NotEqual(firstRefresh, secondRefresh);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);

        // Somebody presents the old token again (grace period is 0 in the tests)
        var thief = server.Client();
        thief.Cookies["cv_refresh"] = firstRefresh;
        var reuse = await thief.PostAsync("/api/auth/refresh");
        Assert.Equal(HttpStatusCode.Unauthorized, reuse.StatusCode);
        Assert.Equal("auth.refresh_reused", await reuse.CodeAsync());

        // The whole family is gone: the newest refresh token and the access tokens of that session stop working
        var legit = await client.PostAsync("/api/auth/refresh");
        Assert.Equal(HttpStatusCode.Unauthorized, legit.StatusCode);
        Assert.Equal("auth.refresh_invalid", await legit.CodeAsync());
        var stale = server.Client();
        stale.Cookies["cv_access"] = firstAccess;
        Assert.Equal("auth.invalid", await (await stale.GetAsync("/api/auth/me")).CodeAsync());

        var log = await (await admin.GetAsync("/api/admin/activity?action=auth.refresh_reuse")).JsonAsync();
        Assert.Equal(1, log.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task Sessions_can_be_listed_and_revoked_and_password_change_ends_other_sessions()
    {
        var admin = await server.AdminAsync();
        var (laptop, _) = await server.UserAsync(admin, "sam", password: "sam-password-123");
        var phone = server.Client();
        (await phone.PostAsync("/api/auth/login", new { username = "sam", password = "sam-password-123" })).EnsureSuccessStatusCode();

        var list = (await (await laptop.GetAsync("/api/account/sessions")).JsonAsync()).EnumerateArray().ToList();
        Assert.Equal(2, list.Count);
        Assert.Single(list, s => s.GetProperty("current").GetBoolean());

        var wrong = await laptop.PostAsync("/api/account/password", new { currentPassword = "nope-nope-nope", newPassword = "sam-password-456" });
        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        Assert.Equal("password.current_invalid", (await wrong.JsonAsync()).GetProperty("errors").GetProperty("currentPassword")[0].GetProperty("code").GetString());

        var changed = await laptop.PostAsync("/api/account/password", new { currentPassword = "sam-password-123", newPassword = "sam-password-456" });
        Assert.Equal(HttpStatusCode.NoContent, changed.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await laptop.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await phone.GetAsync("/api/auth/me")).StatusCode);

        var other = server.Client();
        (await other.PostAsync("/api/auth/login", new { username = "sam", password = "sam-password-456" })).EnsureSuccessStatusCode();
        var sessions = (await (await laptop.GetAsync("/api/account/sessions")).JsonAsync()).EnumerateArray().ToList();
        var foreign = sessions.Single(s => !s.GetProperty("current").GetBoolean()).GetProperty("id").GetString();
        Assert.Equal(HttpStatusCode.NoContent, (await laptop.DeleteAsync($"/api/account/sessions/{foreign}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await other.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await laptop.DeleteAsync($"/api/account/sessions/{foreign}")).StatusCode);
    }

    private static string Code(byte[] secret, int stepsAhead) => Totp.Compute(secret, Totp.Step(DateTimeOffset.UtcNow) + stepsAhead);
}

/// <summary>Instance setting "requireTwoFactor": separate server, because it affects every account.</summary>
public sealed class ForcedTwoFactorTests(ServerFixture server) : IClassFixture<ServerFixture>
{
    [Fact]
    public async Task Users_without_2fa_must_set_it_up_before_anything_else()
    {
        var admin = await server.AdminAsync();
        var (user, _) = await server.UserAsync(admin, "mia");
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsync("/api/admin/settings", new { registrationOpen = false, requireTwoFactor = true })).StatusCode);

        var me = await (await user.GetAsync("/api/auth/me")).JsonAsync();
        Assert.True(me.GetProperty("user").GetProperty("mustSetupTwoFactor").GetBoolean());

        var blocked = await user.GetAsync("/api/account/sessions");
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Equal("auth.twofactor_setup_required", await blocked.CodeAsync());

        var setup = await (await user.PostAsync("/api/account/2fa/totp/setup")).JsonAsync();
        var secret = Base32.Decode(setup.GetProperty("secret").GetString()!);
        var enable = await user.PostAsync("/api/account/2fa/totp/enable", new { code = Totp.Compute(secret, Totp.Step(DateTimeOffset.UtcNow)) });
        Assert.Equal(HttpStatusCode.OK, enable.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await user.GetAsync("/api/account/sessions")).StatusCode);
        var disable = await user.PostAsync("/api/account/2fa/disable", new { password = "user-password-123", code = "abcde-fghjk" });
        Assert.Equal("twofactor.required_by_admin", await disable.CodeAsync());
    }
}

/// <summary>Low limits on their own server, so the other tests never hit them.</summary>
public sealed class RateLimitFixture : ServerFixture
{
    protected override Dictionary<string, string?> Settings
    {
        get
        {
            var settings = base.Settings;
            settings["RateLimits:Login"] = "3";
            return settings;
        }
    }
}

public sealed class RateLimitTests(RateLimitFixture server) : IClassFixture<RateLimitFixture>
{
    [Fact]
    public async Task Login_is_limited_with_429_and_retry_after()
    {
        var client = server.Client();
        for (var i = 0; i < 3; i++)
        {
            var attempt = await client.PostAsync("/api/auth/login", new { username = "x", password = "wrong-password-123" });
            Assert.Equal(HttpStatusCode.Unauthorized, attempt.StatusCode);
        }
        var limited = await client.PostAsync("/api/auth/login", new { username = "x", password = "wrong-password-123" });
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Equal("rate_limited", await limited.CodeAsync());
        Assert.True(limited.Headers.RetryAfter is not null || limited.Headers.Contains("Retry-After"));
        Assert.True((await limited.JsonAsync()).GetProperty("params").GetProperty("retryAfterSeconds").GetInt32() > 0);
    }
}
