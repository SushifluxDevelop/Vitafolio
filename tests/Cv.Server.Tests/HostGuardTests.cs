using System.Net;
using Cv.Server.Configuration;
using Cv.Server.Security;
using Cv.Server.Tests.Support;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Cv.Server.Tests;

public sealed class HostGuardRuleTests
{
    private static readonly IReadOnlyList<string> Allowed = HostGuard.ParseAllowedHosts("cv.example.com, *.home.example");

    [Theory]
    [InlineData("192.168.1.20", true)]
    [InlineData("192.168.1.20:8080", true)]
    [InlineData("[::1]:5241", true)]
    [InlineData("[fe80::1]", true)]
    [InlineData("localhost:5241", true)]
    [InlineData("LOCALHOST", true)]
    [InlineData("cv.example.com", true)]
    [InlineData("CV.Example.com:443", true)]
    [InlineData("vitafolio.home.example", true)]
    [InlineData("home.example", false)]
    [InlineData("evil.example", false)]
    [InlineData("cv.example.com.evil.example", false)]
    [InlineData("localhost.evil.example", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Allowed_hosts(string? host, bool expected) => Assert.Equal(expected, HostGuard.IsAllowed(host, Allowed));

    [Fact]
    public void Forwarded_host_counts_only_from_a_trusted_proxy()
    {
        var (proxies, networks) = ServerSettings.ParseTrustedProxies("172.17.0.1, 10.0.0.0/8");
        var settings = new ServerSettings
        {
            Mode = HostMode.Server, DataDirectory = "x", BackupDirectory = "y", Channel = "dev", TrustedProxies = proxies, TrustedNetworks = networks,
        };
        Assert.Equal("cv.example.com", HostGuard.EffectiveHost("172.17.0.5:8080", "cv.example.com", IPAddress.Parse("172.17.0.1"), settings));
        Assert.Equal("last.example", HostGuard.EffectiveHost("x", "first.example, last.example", IPAddress.Parse("10.1.2.3"), settings));
        Assert.Equal("172.17.0.5:8080", HostGuard.EffectiveHost("172.17.0.5:8080", "evil.example", IPAddress.Parse("192.168.1.30"), settings));
        Assert.Equal("172.17.0.5:8080", HostGuard.EffectiveHost("172.17.0.5:8080", "evil.example", null, settings));
        Assert.True(HostGuard.IsTrustedProxy(IPAddress.Parse("::ffff:172.17.0.1"), settings));
    }

    [Fact]
    public void Invalid_allowed_hosts_stop_the_start()
    {
        Assert.Throws<InvalidOperationException>(() => HostGuard.ParseAllowedHosts("https://cv.example.com"));
        Assert.Throws<InvalidOperationException>(() => HostGuard.ParseAllowedHosts("cv.example.com:443"));
        Assert.Empty(HostGuard.ParseAllowedHosts(""));
    }
}

public sealed class HostGuardFixture : ServerFixture
{
    protected override Dictionary<string, string?> Settings
    {
        get
        {
            var settings = base.Settings;
            settings["ALLOWED_HOSTS"] = "cv.example.com,*.home.example";
            return settings;
        }
    }

    public HttpClient ClientFor(string baseAddress) =>
        Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri(baseAddress), HandleCookies = false });
}

public sealed class HostGuardTests(HostGuardFixture server) : IClassFixture<HostGuardFixture>
{
    [Theory]
    [InlineData("http://localhost")]
    [InlineData("http://192.168.1.20:5242")]
    [InlineData("http://[::1]:8080")]
    [InlineData("http://cv.example.com")]
    [InlineData("http://vitafolio.home.example")]
    public async Task Ip_localhost_and_allowed_names_are_served(string baseAddress)
    {
        var response = await server.ClientFor(baseAddress).GetAsync("/api/health", TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("http://evil.example")]
    [InlineData("http://home.example")]
    public async Task Unknown_names_get_400_also_for_the_ui(string baseAddress)
    {
        var client = server.ClientFor(baseAddress);
        foreach (var path in new[] { "/api/health", "/api/bootstrap", "/", "/index.html" })
        {
            var response = await client.GetAsync(path, TestContext.Current.CancellationToken);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("host.not_allowed", await response.CodeAsync());
        }
    }

    [Fact]
    public async Task Forwarded_host_from_an_untrusted_sender_is_ignored()
    {
        // The test server's connection has no trusted proxy address: the header must neither help nor hurt
        var evil = server.ClientFor("http://evil.example");
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/health") { Headers = { { "X-Forwarded-Host", "cv.example.com" } } };
        Assert.Equal(HttpStatusCode.BadRequest, (await evil.SendAsync(request, TestContext.Current.CancellationToken)).StatusCode);

        var local = server.ClientFor("http://localhost");
        var request2 = new HttpRequestMessage(HttpMethod.Get, "/api/health") { Headers = { { "X-Forwarded-Host", "evil.example" } } };
        Assert.Equal(HttpStatusCode.OK, (await local.SendAsync(request2, TestContext.Current.CancellationToken)).StatusCode);
    }
}
