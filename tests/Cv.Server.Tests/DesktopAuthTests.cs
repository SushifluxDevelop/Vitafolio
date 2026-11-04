using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using Cv.Server.Tests.Support;
using Microsoft.AspNetCore.Builder;
using Microsoft.Data.Sqlite;

namespace Cv.Server.Tests;

[CollectionDefinition(nameof(DesktopCollection), DisableParallelization = true)]
public sealed class DesktopCollection;

/// <summary>
/// The server as the Windows program runs it: ServerApp.Build in desktop mode on a real loopback port (the Host check needs the real
/// "127.0.0.1:&lt;port&gt;"). Not parallel to the WebApplicationFactory tests, which watch host creation process-wide.
/// </summary>
public sealed class DesktopFixture : IAsyncLifetime
{
    public string DataDir { get; } = Path.Combine(Path.GetTempPath(), "cv-server-tests", Guid.NewGuid().ToString("N"));

    public string Token { get; } = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(32));

    public int Port { get; private set; }

    public WebApplication App { get; private set; } = null!;

    public async ValueTask InitializeAsync()
    {
        using (var probe = new TcpListener(IPAddress.Loopback, 0))
        {
            probe.Start();
            Port = ((IPEndPoint)probe.LocalEndpoint).Port;
        }
        App = ServerApp.Build(new ServerAppOptions
        {
            Mode = HostMode.Desktop,
            Urls = [$"http://127.0.0.1:{Port}"],
            DataDirectory = DataDir,
            DesktopToken = Token,
        }, ["--Backups:Automatic=false"]);
        await App.StartAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await App.StopAsync();
        await App.DisposeAsync();
        SqliteConnection.ClearAllPools();
        TestFiles.DeleteDirectory(DataDir);
    }

    public TestClient Client(string? token, string? host = null)
    {
        var client = new TestClient(new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{Port}") });
        if (token is not null) client.Cookies["cv_desktop"] = token;
        if (host is not null) client.Http.DefaultRequestHeaders.Host = host;
        return client;
    }
}

[Collection(nameof(DesktopCollection))]
public sealed class DesktopAuthTests(DesktopFixture desktop) : IClassFixture<DesktopFixture>
{
    [Fact]
    public async Task Right_cookie_and_host_authenticate_as_the_local_owner()
    {
        var response = await desktop.Client(desktop.Token).GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var user = (await response.JsonAsync()).GetProperty("user");
        Assert.Equal("admin", user.GetProperty("role").GetString());
        Assert.False(user.GetProperty("mustSetupTwoFactor").GetBoolean());

        var bootstrap = await (await desktop.Client(null).GetAsync("/api/bootstrap")).JsonAsync();
        Assert.Equal("desktop", bootstrap.GetProperty("mode").GetString());
        Assert.False(bootstrap.GetProperty("setupRequired").GetBoolean());

        // Preferences and admin settings work for the owner
        var prefs = await desktop.Client(desktop.Token).PutAsync("/api/account/preferences", new { theme = "dark", language = "en" });
        Assert.Equal(HttpStatusCode.OK, prefs.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await desktop.Client(desktop.Token).GetAsync("/api/admin/settings")).StatusCode);
    }

    [Fact]
    public async Task Missing_or_wrong_cookie_is_401_and_a_wrong_host_is_400_everywhere()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await desktop.Client(null).GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await desktop.Client(new string('a', 64)).GetAsync("/api/auth/me")).StatusCode);
        // DNS rebinding: the right cookie under another host name is refused
        // DNS rebinding: any other host name is refused, also for the public endpoints and the UI
        foreach (var host in new[] { $"localhost:{desktop.Port}", "evil.example", $"127.0.0.1:{desktop.Port + 1}" })
        {
            foreach (var path in new[] { "/api/auth/me", "/api/bootstrap", "/api/version", "/" })
            {
                var response = await desktop.Client(desktop.Token, host).GetAsync(path);
                Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
                Assert.Equal("host.not_allowed", await response.CodeAsync());
            }
        }
        // Kestrel does not announce itself
        Assert.False((await desktop.Client(null).GetAsync("/api/version")).Headers.Contains("Server"));
    }

    [Fact]
    public void Keys_of_the_desktop_program_are_encrypted_with_dpapi()
    {
        Assert.SkipUnless(OperatingSystem.IsWindows(), "DPAPI exists only on Windows.");
        var keys = Path.Combine(desktop.DataDir, "keys");
        Assert.StartsWith("<", File.ReadAllText(Path.Combine(keys, "jwt-signing.key")).TrimStart(), StringComparison.Ordinal);
        var ring = Directory.GetFiles(Path.Combine(keys, "dataprotection"), "key-*.xml");
        Assert.NotEmpty(ring);
        Assert.All(ring, file => Assert.Contains("DpapiXmlDecryptor", File.ReadAllText(file), StringComparison.Ordinal));
    }

    [Fact]
    public async Task Server_only_endpoints_do_not_exist_and_csrf_still_applies()
    {
        var owner = desktop.Client(desktop.Token);
        foreach (var path in new[] { "/api/auth/login", "/api/setup", "/api/auth/refresh", "/api/auth/logout" })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await owner.PostAsync(path, new { })).StatusCode);
        }
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync("/api/admin/users")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync("/api/admin/activity")).StatusCode);

        var noCsrf = await owner.SendAsync(new HttpRequestMessage(HttpMethod.Put, "/api/account/preferences")
        {
            Content = System.Net.Http.Json.JsonContent.Create(new { theme = "light" }),
        }, csrf: false);
        Assert.Equal(HttpStatusCode.Forbidden, noCsrf.StatusCode);
    }
}
