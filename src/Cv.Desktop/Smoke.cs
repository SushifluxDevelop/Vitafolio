using System.Net;
using System.Text.Json;
using Cv.Desktop.Hosting;
using Cv.Server.Auth;
using Cv.Server.Configuration;
using Microsoft.Web.WebView2.Core;

namespace Cv.Desktop;

/// <summary>
/// <c>--smoke</c>: the program's self test for CI, without a window. Starts the server exactly as the program does (desktop mode, a free
/// loopback port, a temporary data folder), checks <c>/api/health</c>, <c>/api/version</c>, that the desktop cookie is what opens the API
/// (and a missing or wrong one does not), that the UI is served when it is bundled, and that the server stops gracefully. Prints one line
/// per check and the result; exit code 0 = everything passed, 1 = something failed.
/// </summary>
internal static class Smoke
{
    public static async Task<int> RunAsync()
    {
        Native.AttachToParentConsole();
        var failures = 0;
        void Check(bool ok, string what)
        {
            Console.WriteLine((ok ? "OK      " : "FEHLER  ") + what);
            if (!ok) failures++;
        }

        var dataDirectory = Path.Combine(Path.GetTempPath(), $"{Branding.ProductName}-smoke-{Guid.NewGuid():N}");
        Console.WriteLine($"{Branding.ProductName} {DesktopVersion.Readable("release")} - Smoke-Test (temporäre Daten: {dataDirectory})");
        DesktopServer? server = null;
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(90));
            DesktopLog.Init(Path.Combine(dataDirectory, "logs"));
            server = await DesktopServer.StartAsync(new DesktopServerOptions(dataDirectory, "release", Development: false), timeout.Token);
            Check(true, $"Server gestartet auf {server.BaseUri}");

            using var http = new HttpClient(new SocketsHttpHandler { UseProxy = false, UseCookies = false }) { BaseAddress = server.BaseUri, Timeout = TimeSpan.FromSeconds(20) };

            using (var health = await http.GetAsync("api/health", timeout.Token))
            {
                var body = await health.Content.ReadAsStringAsync(timeout.Token);
                Check(health.StatusCode == HttpStatusCode.OK && StringProperty(body, "status") == "ok", $"/api/health antwortet {(int)health.StatusCode}: {body}");
            }

            using (var version = await http.GetAsync("api/version", timeout.Token))
            {
                var body = await version.Content.ReadAsStringAsync(timeout.Token);
                var shown = StringProperty(body, "version");
                Check(version.StatusCode == HttpStatusCode.OK && !string.IsNullOrWhiteSpace(shown), $"/api/version antwortet {(int)version.StatusCode}: {shown}");
            }

            using (var anonymous = await http.GetAsync("api/auth/me", timeout.Token))
            {
                Check(anonymous.StatusCode == HttpStatusCode.Unauthorized, $"/api/auth/me ohne Cookie: {(int)anonymous.StatusCode} (erwartet 401)");
            }

            using (var wrong = await Get(http, "api/auth/me", $"{AuthConstants.DesktopCookie}={new string('0', 64)}", timeout.Token))
            {
                Check(wrong.StatusCode == HttpStatusCode.Unauthorized, $"/api/auth/me mit falschem Cookie: {(int)wrong.StatusCode} (erwartet 401)");
            }

            using (var owner = await Get(http, "api/auth/me", $"{AuthConstants.DesktopCookie}={server.Token}", timeout.Token))
            {
                Check(owner.StatusCode == HttpStatusCode.OK, $"/api/auth/me mit dem Programm-Cookie: {(int)owner.StatusCode} (erwartet 200)");
            }

            var webRoot = Path.Combine(AppContext.BaseDirectory, "wwwroot", "index.html");
            if (File.Exists(webRoot))
            {
                using var ui = await http.GetAsync("", timeout.Token);
                var type = ui.Content.Headers.ContentType?.MediaType;
                Check(ui.StatusCode == HttpStatusCode.OK && type == "text/html", $"Oberfläche wird ausgeliefert: {(int)ui.StatusCode} {type}");
            }
            else
            {
                Console.WriteLine("HINWEIS  Keine gebaute Oberfläche im Programmordner (wwwroot) - die Auslieferung wurde nicht geprüft.");
            }

            try
            {
                Console.WriteLine($"INFO     WebView2 Runtime {CoreWebView2Environment.GetAvailableBrowserVersionString()}");
            }
            catch (WebView2RuntimeNotFoundException)
            {
                Console.WriteLine("HINWEIS  Die WebView2 Runtime ist auf diesem PC nicht installiert (das Fenster würde das melden).");
            }

            await server.StopAsync();
            server = null;
            Check(true, "Server sauber beendet");
        }
        catch (Exception ex)
        {
            Check(false, $"Smoke-Test abgebrochen: {ex.GetType().Name}: {ex.Message}");
            if (server is not null)
            {
                try { await server.StopAsync(); }
                catch (Exception stopEx) { Console.WriteLine($"HINWEIS  Beenden danach: {stopEx.Message}"); }
            }
        }
        finally
        {
            TryDelete(dataDirectory);
        }

        Console.WriteLine(failures == 0 ? "Smoke-Test bestanden." : $"Smoke-Test FEHLGESCHLAGEN ({failures} Fehler).");
        return failures == 0 ? 0 : 1;
    }

    private static Task<HttpResponseMessage> Get(HttpClient http, string path, string cookie, CancellationToken ct)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Add("Cookie", cookie);
        return http.SendAsync(request, ct);
    }

    private static string? StringProperty(string json, string name)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static void TryDelete(string directory)
    {
        // The database may still be released a moment after the server stopped
        for (var attempt = 0; attempt < 5; attempt++)
        {
            try
            {
                if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true);
                return;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                Thread.Sleep(300);
            }
        }
        Console.WriteLine($"HINWEIS  Der temporäre Ordner konnte nicht gelöscht werden: {directory}");
    }
}
