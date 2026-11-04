using System.Net;

namespace Cv.Desktop.Hosting;

/// <summary>Waits until a local address answers (the server's <c>/api/health</c>, in development also through the Vite dev server).</summary>
internal static class Readiness
{
    private static readonly HttpClient Http = new(new SocketsHttpHandler { UseProxy = false, ConnectTimeout = TimeSpan.FromSeconds(2) })
    {
        Timeout = TimeSpan.FromSeconds(5),
    };

    /// <summary>Polls <paramref name="url"/> until it answers 200 or the time is up. Returns null on success, otherwise a description of the last failure.</summary>
    public static async Task<string?> WaitForOkAsync(Uri url, TimeSpan timeout, CancellationToken ct)
    {
        var until = DateTime.UtcNow + timeout;
        string last = "keine Antwort";
        while (true)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                using var response = await Http.GetAsync(url, ct);
                if (response.StatusCode == HttpStatusCode.OK) return null;
                last = $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}";
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                last = ex.InnerException?.Message ?? ex.Message;
            }
            if (DateTime.UtcNow >= until) return last;
            await Task.Delay(250, ct);
        }
    }
}
