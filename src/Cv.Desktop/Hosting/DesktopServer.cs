using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using Cv.Server;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Hosting;

namespace Cv.Desktop.Hosting;

/// <summary>What the host passes when it starts the in-process server.</summary>
internal sealed record DesktopServerOptions(string DataDirectory, string Channel, bool Development, int? FixedPort = null);

/// <summary>
/// The server of the Windows program: <see cref="ServerApp.Build"/> in desktop mode, running inside this process and listening only on
/// <c>127.0.0.1</c>. Every run has its own random 256-bit token (the cookie the window sets) and, in normal use, a free local port. Stopping
/// it lets the server's hosted services run their shutdown work (the before-shutdown backup).
/// </summary>
internal sealed class DesktopServer : IAsyncDisposable
{
    private readonly WebApplication _app;
    private bool _stopped;

    private DesktopServer(WebApplication app, int port, string token)
    {
        _app = app;
        Port = port;
        Token = token;
        // A stop the window did not ask for (e.g. a background service failed): the window must say so instead of showing a dead UI
        app.Lifetime.ApplicationStopping.Register(() =>
        {
            if (_stopped) return;
            DesktopLog.Error("Der interne Server wurde unerwartet beendet.");
            StoppedUnexpectedly?.Invoke();
        });
    }

    /// <summary>Raised (on a background thread) when the server stops without <see cref="StopAsync"/> having been called.</summary>
    public event Action? StoppedUnexpectedly;

    public int Port { get; }

    /// <summary>The per-run secret the server expects in cookie <c>cv_desktop</c>.</summary>
    public string Token { get; }

    public Uri BaseUri => new($"http://127.0.0.1:{Port}/");

    /// <summary>The Host header the server accepts in desktop mode.</summary>
    public string Host => $"127.0.0.1:{Port}";

    /// <summary>Builds (database check, migrations) and starts the server. Throws the real exception when that fails.</summary>
    public static async Task<DesktopServer> StartAsync(DesktopServerOptions options, CancellationToken ct = default)
    {
        const int attempts = 5;
        for (var attempt = 1; ; attempt++)
        {
            var port = options.FixedPort ?? FreeLoopbackPort();
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            var serverOptions = new ServerAppOptions
            {
                Mode = HostMode.Desktop,
                Urls = [$"http://127.0.0.1:{port}"],
                DataDirectory = options.DataDirectory,
                DesktopToken = token,
                Channel = options.Channel,
            };
            // The framework's per-request chatter is not wanted in the log of a program that has no console
            string[] args = options.Development
                ? ["--environment", "Development"]
                : ["--Logging:LogLevel:Microsoft.AspNetCore=Warning"];

            WebApplication? app = null;
            try
            {
                // Build checks and migrates the database: not on the UI thread
                app = await Task.Run(() => ServerApp.Build(serverOptions, args), ct);
                await app.StartAsync(ct);
                DesktopLog.Info($"Server läuft auf http://127.0.0.1:{port} (Datenordner {options.DataDirectory}).");
                return new DesktopServer(app, port, token);
            }
            catch (Exception ex) when (options.FixedPort is null && attempt < attempts && IsAddressInUse(ex))
            {
                // Someone took the free port between the check and the bind: pick another one
                DesktopLog.Warn($"Port {port} wurde in der Zwischenzeit belegt, neuer Versuch ({attempt}/{attempts}).");
                if (app is not null) await app.DisposeAsync();
            }
            catch
            {
                if (app is not null) await app.DisposeAsync();
                throw;
            }
        }
    }

    /// <summary>Stops the server gracefully: its hosted services finish (the final backup is made), then it is disposed.</summary>
    public async Task StopAsync()
    {
        if (_stopped) return;
        _stopped = true;
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(60));
        try
        {
            await _app.StopAsync(timeout.Token);
            DesktopLog.Info("Server beendet.");
        }
        catch (OperationCanceledException)
        {
            DesktopLog.Warn("Der Server hat sich nicht innerhalb von 60 Sekunden beendet.");
        }
        finally
        {
            await _app.DisposeAsync();
        }
    }

    public async ValueTask DisposeAsync() => await StopAsync();

    /// <summary>Asks the host to stop as if something inside it failed (tests of the unexpected-stop path).</summary>
    internal void SimulateUnexpectedStop() => _app.Lifetime.StopApplication();

    /// <summary>A free port on 127.0.0.1 (the OS hands out an unused one from its dynamic range).</summary>
    internal static int FreeLoopbackPort()
    {
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        try
        {
            return ((IPEndPoint)listener.LocalEndpoint).Port;
        }
        finally
        {
            listener.Stop();
        }
    }

    private static bool IsAddressInUse(Exception ex)
    {
        for (var e = ex; e is not null; e = e.InnerException!)
        {
            if (e is SocketException { SocketErrorCode: SocketError.AddressAlreadyInUse }) return true;
            if (e.InnerException is null) break;
        }
        return false;
    }
}
