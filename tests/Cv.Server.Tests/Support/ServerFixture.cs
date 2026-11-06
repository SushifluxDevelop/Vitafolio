using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;

namespace Cv.Server.Tests.Support;

/// <summary>
/// One server per test class (WebApplicationFactory over the real Program.cs) with its own temporary data directory, which is deleted
/// afterwards. Settings reach the server like environment variables do (as host configuration).
/// </summary>
public class ServerFixture : IAsyncLifetime
{
    public string DataDir { get; } = Path.Combine(Path.GetTempPath(), "cv-server-tests", Guid.NewGuid().ToString("N"));

    public WebApplicationFactory<Program> Factory { get; private set; } = null!;

    /// <summary>Generous limits by default, so ordinary tests never hit them; the rate-limit tests override this.</summary>
    protected virtual Dictionary<string, string?> Settings => new()
    {
        ["DATA_DIR"] = DataDir,
        ["Backups:Automatic"] = "false",
        ["Auth:RefreshReuseGraceSeconds"] = "0",
        ["RateLimits:Login"] = "1000",
        ["RateLimits:TwoFactor"] = "1000",
        ["RateLimits:Setup"] = "1000",
        ["RateLimits:Register"] = "1000",
        ["RateLimits:Password"] = "1000",
        ["RateLimits:EmergencyReset"] = "1000",
        ["RateLimits:StepUp"] = "1000",
    };

    public ValueTask InitializeAsync()
    {
        Directory.CreateDirectory(DataDir);
        var settings = Settings;
        Factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            foreach (var (key, value) in settings) builder.UseSetting(key, value);
        });
        // Start the server once (migrations) before the first test of the class
        _ = Factory.Server;
        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        await Factory.DisposeAsync();
        SqliteConnection.ClearAllPools();
        TestFiles.DeleteDirectory(DataDir);
        GC.SuppressFinalize(this);
    }

    /// <summary>The one-time setup code the server wrote into its data folder (empty once setup is done).</summary>
    public string SetupToken()
    {
        var file = Path.Combine(DataDir, "setup-token");
        return File.Exists(file) ? File.ReadAllText(file).Trim() : "";
    }

    /// <summary>The one-time emergency reset code the server wrote into its data folder (empty if none active).</summary>
    public string EmergencyToken()
    {
        var file = Path.Combine(DataDir, "emergency-token");
        return File.Exists(file) ? File.ReadAllText(file).Trim() : "";
    }

    public TestClient Client() => new(Factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false, AllowAutoRedirect = false }));

    public const string AdminPassword = "admin-password-123";

    /// <summary>A client signed in as the first admin; runs setup when it has not happened yet in this server.</summary>
    public async Task<TestClient> AdminAsync()
    {
        var client = Client();
        var setup = await client.PostAsync("/api/setup", new { username = "admin", displayName = "Admin", password = AdminPassword, setupToken = SetupToken() });
        if (setup.StatusCode == HttpStatusCode.Conflict)
        {
            (await client.PostAsync("/api/auth/login", new { username = "admin", password = AdminPassword })).EnsureSuccessStatusCode();
        }
        else
        {
            setup.EnsureSuccessStatusCode();
        }
        return client;
    }

    /// <summary>Creates an account through the admin API and returns a client signed in as it.</summary>
    public async Task<(TestClient Client, string Id)> UserAsync(TestClient admin, string username, string role = "user", string password = "user-password-123")
    {
        var created = await admin.PostAsync("/api/admin/users", new { username, displayName = username, password, role });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await created.JsonAsync()).GetProperty("id").GetString()!;
        var client = Client();
        (await client.PostAsync("/api/auth/login", new { username, password })).EnsureSuccessStatusCode();
        return (client, id);
    }
}

public static class TestFiles
{
    public static void DeleteDirectory(string path)
    {
        for (var attempt = 0; attempt < 10 && Directory.Exists(path); attempt++)
        {
            try
            {
                Directory.Delete(path, recursive: true);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                Thread.Sleep(100);
            }
        }
    }
}

public static class ResponseExtensions
{
    public static async Task<JsonElement> JsonAsync(this HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(text).RootElement.Clone();
    }

    /// <summary>The <c>code</c> of a problem answer.</summary>
    public static async Task<string?> CodeAsync(this HttpResponseMessage response) =>
        (await response.JsonAsync()).TryGetProperty("code", out var code) ? code.GetString() : null;
}

/// <summary>
/// An HTTP client with its own cookie jar that can be read and changed by the test (e.g. to present an old refresh token again).
/// Sends the CSRF header on every non-GET request unless told otherwise.
/// </summary>
public sealed class TestClient(HttpClient http)
{
    public Dictionary<string, string> Cookies { get; } = new(StringComparer.Ordinal);

    public HttpClient Http => http;

    public Task<HttpResponseMessage> GetAsync(string path) => SendAsync(new HttpRequestMessage(HttpMethod.Get, path));

    public Task<HttpResponseMessage> PostAsync(string path, object? body = null, bool csrf = true) =>
        SendAsync(new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body ?? new { }) }, csrf);

    public Task<HttpResponseMessage> PutAsync(string path, object body) =>
        SendAsync(new HttpRequestMessage(HttpMethod.Put, path) { Content = JsonContent.Create(body) });

    public Task<HttpResponseMessage> PatchAsync(string path, object body) =>
        SendAsync(new HttpRequestMessage(HttpMethod.Patch, path) { Content = JsonContent.Create(body) });

    public Task<HttpResponseMessage> DeleteAsync(string path) => SendAsync(new HttpRequestMessage(HttpMethod.Delete, path));

    public async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, bool csrf = true)
    {
        if (csrf && request.Method != HttpMethod.Get && request.Method != HttpMethod.Head) request.Headers.Add("X-Cv-Request", "1");
        if (Cookies.Count > 0) request.Headers.Add("Cookie", string.Join("; ", Cookies.Select(c => $"{c.Key}={c.Value}")));
        var response = await http.SendAsync(request);
        if (response.Headers.TryGetValues("Set-Cookie", out var setCookies))
        {
            foreach (var header in setCookies) Apply(header);
        }
        return response;
    }

    private void Apply(string header)
    {
        var parts = header.Split(';', StringSplitOptions.TrimEntries);
        var eq = parts[0].IndexOf('=');
        var name = parts[0][..eq];
        var value = parts[0][(eq + 1)..];
        var expired = parts.Any(p => p.StartsWith("expires=", StringComparison.OrdinalIgnoreCase)
            && DateTimeOffset.TryParse(p[8..], System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal, out var at)
            && at < DateTimeOffset.UtcNow);
        if (string.IsNullOrEmpty(value) || expired) Cookies.Remove(name);
        else Cookies[name] = value;
    }
}
