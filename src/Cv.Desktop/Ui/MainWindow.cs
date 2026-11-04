using Cv.Desktop.Hosting;
using Cv.Server.Auth;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Win32;

namespace Cv.Desktop.Ui;

/// <summary>
/// The program window: the branded loading view first, then the app in WebView2. It starts the in-process server, waits until
/// <c>/api/health</c> answers (in development also the Vite dev server), sets the per-run desktop cookie in the WebView before the first
/// navigation and shows the UI. The window only ever navigates inside its own origin (<see cref="NavigationPolicy"/>). Closing stops the
/// server gracefully (its shutdown work, e.g. the final backup, runs) while the loading view says so; size, position and the maximised
/// state are remembered in window.json.
/// </summary>
internal sealed class MainWindow : Form
{
    private const string DownloadPage = "https://developer.microsoft.com/microsoft-edge/webview2/";

    /// <summary>The names of WebView2's context-menu entries that stay (editing only); everything browser-like is removed.</summary>
    private static readonly HashSet<string> EditMenuItems = new(StringComparer.Ordinal)
    {
        "cut", "copy", "paste", "pasteAsPlainText", "selectAll", "undo", "redo", "delete",
    };

    private readonly DesktopOptions _options;
    private readonly DesktopPaths _paths;
    private readonly string _channel;
    private readonly Palette _palette = Palette.Current;
    private readonly LoadingView _loading;
    private readonly CancellationTokenSource _cts = new();
    private WebView2? _web;
    private DesktopServer? _server;
    private Task? _startTask;
    private Uri? _ownOrigin;
    private bool _shutdownStarted;
    private bool _canClose;
    private bool _wasMaximized;

    public MainWindow(DesktopOptions options, DesktopPaths paths, string channel)
    {
        _options = options;
        _paths = paths;
        _channel = channel;

        AutoScaleDimensions = new SizeF(96f, 96f);
        AutoScaleMode = AutoScaleMode.Dpi;
        Text = options.Dev ? $"{Texts.Product} (Dev)" : Texts.Product;
        Icon = Chrome.WindowIcon;
        BackColor = _palette.Page;
        StartPosition = FormStartPosition.Manual;
        Name = "mainWindow";

        _loading = new LoadingView(_palette);
        Controls.Add(_loading);

        ApplyMinimumSize();
        var screens = Screen.AllScreens;
        var primary = Screen.PrimaryScreen ?? screens[0];
        var scale = DeviceDpi / 96f;
        var defaultSize = SizeFromClientSize(new Size((int)Math.Round(WindowPlacement.DefaultClient.Width * scale), (int)Math.Round(WindowPlacement.DefaultClient.Height * scale)));
        if (DevMonitor.WorkingArea() is { } devArea)
        {
            // Development/test run on a chosen monitor: centred there, never maximised, nothing remembered or restored
            Bounds = WindowPlacement.Resolve(null, [devArea], devArea, defaultSize).Bounds;
        }
        else
        {
            var (bounds, maximized) = WindowPlacement.Resolve(StoredWindow.Load(paths.WindowStateFile), [.. screens.Select(s => s.WorkingArea)], primary.WorkingArea, defaultSize);
            Bounds = bounds;
            if (maximized) WindowState = FormWindowState.Maximized;
            _wasMaximized = maximized;
        }

        SystemEvents.UserPreferenceChanged += OnUserPreferenceChanged;
    }

    /// <summary>0 = closed normally, 1 = the program could not start.</summary>
    public int ExitCode { get; private set; }

    /// <summary>Brings the window to the front (a second start of the program asked for it); restores it when minimised.</summary>
    public void ShowAndActivate()
    {
        if (IsDisposed || _shutdownStarted) return;
        if (!Visible) Show();
        if (WindowState == FormWindowState.Minimized) WindowState = _wasMaximized ? FormWindowState.Maximized : FormWindowState.Normal;
        // A development/test run on a chosen monitor never takes the focus
        if (DevMonitor.Active) return;
        Activate();
        Native.SetForegroundWindow(Handle);
    }

    /// <summary>With <c>CV_DEV_MONITOR</c> set the window opens without taking the focus.</summary>
    protected override bool ShowWithoutActivation => DevMonitor.Active;

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        Chrome.UseDarkTitleBar(Handle, _palette.IsDark);
    }

    protected override void OnDpiChanged(DpiChangedEventArgs e)
    {
        base.OnDpiChanged(e);
        ApplyMinimumSize();
    }

    /// <summary>The smallest client area is 1024 x 700 CSS pixels: scaled with the monitor, so the web layout never gets narrower than that.</summary>
    private void ApplyMinimumSize()
    {
        var scale = DeviceDpi / 96f;
        MinimumSize = SizeFromClientSize(new Size((int)Math.Round(WindowPlacement.MinimumClient.Width * scale), (int)Math.Round(WindowPlacement.MinimumClient.Height * scale)));
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        if (WindowState != FormWindowState.Minimized) _wasMaximized = WindowState == FormWindowState.Maximized;
    }

    private void OnUserPreferenceChanged(object? sender, UserPreferenceChangedEventArgs e)
    {
        // The title bar follows Windows' app mode live (the surfaces below keep the palette they were created with)
        if (e.Category is UserPreferenceCategory.General or UserPreferenceCategory.Color && IsHandleCreated)
        {
            BeginInvoke(() => Chrome.UseDarkTitleBar(Handle, Palette.WindowsUsesDarkApps()));
        }
    }

    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        // The window's DPI is known now (it follows the monitor it opened on): fit it onto the chosen monitor
        if (DevMonitor.Active) DevMonitor.Center(this);
        _startTask = RunStartAsync();
    }

    // ---- start ----------------------------------------------------------------------------------------------------------------

    private async Task RunStartAsync()
    {
        var serverPhase = true;
        try
        {
            if (!EnsureWebViewRuntime()) return;

            _loading.Status = Texts.StartingServer;
            _server = await DesktopServer.StartAsync(
                new DesktopServerOptions(_paths.DataDirectory, _channel, _options.Dev, _options.Dev ? DesktopOptions.DevServerPort : null), _cts.Token);

            _server.StoppedUnexpectedly += OnServerStoppedUnexpectedly;

            var health = await Readiness.WaitForOkAsync(new Uri(_server.BaseUri, "api/health"), TimeSpan.FromSeconds(30), _cts.Token);
            if (health is not null) throw new InvalidOperationException(Texts.ServerNotAnswering(health));

            var origin = _server.BaseUri;
            if (_options.Dev)
            {
                // The window shows the Vite dev server, which proxies /api to the server above
                _loading.Status = Texts.WaitingForDevServer;
                var vite = new Uri($"http://127.0.0.1:{DesktopOptions.DevVitePort}/");
                var proxied = await Readiness.WaitForOkAsync(new Uri(vite, "api/health"), TimeSpan.FromSeconds(60), _cts.Token);
                if (proxied is not null)
                {
                    throw new InvalidOperationException(Texts.DevServerMissing(DesktopOptions.DevVitePort, DesktopOptions.DevServerPort, proxied));
                }
                origin = vite;
            }

            serverPhase = false;
            _loading.Status = Texts.LoadingUi;
            await OpenWebViewAsync(origin);
        }
        catch (OperationCanceledException) when (_cts.IsCancellationRequested)
        {
            // The window was closed while starting
        }
        catch (Exception ex)
        {
            ExitCode = 1;
            var title = serverPhase ? Texts.StartFailedTitle : Texts.WindowFailedTitle;
            var message = (serverPhase ? Texts.StartFailed : Texts.WindowFailed) + Environment.NewLine + Environment.NewLine + ex.Message;
            var details = ex.ToString() + (DesktopLog.File is { } log ? Environment.NewLine + Environment.NewLine + Texts.LogFile(log) : string.Empty);
            Dialogs.ShowError(this, title, message, details, closeText: Texts.Quit);
            RequestClose();
        }
    }

    private void OnServerStoppedUnexpectedly()
    {
        if (IsDisposed || _shutdownStarted || !IsHandleCreated) return;
        BeginInvoke(() =>
        {
            if (_shutdownStarted) return;
            ExitCode = 1;
            var log = DesktopLog.File is { } file ? Texts.LogFile(file) : null;
            Dialogs.ShowError(this, Texts.ServerStoppedTitle, Texts.ServerStopped, log, closeText: Texts.Quit);
            RequestClose();
        });
    }

    /// <summary>The window needs Microsoft's WebView2 Runtime; without it the user is told what to do (never a system message box).</summary>
    private bool EnsureWebViewRuntime()
    {
        try
        {
            DesktopLog.Info($"WebView2 Runtime {CoreWebView2Environment.GetAvailableBrowserVersionString()}.");
            return true;
        }
        catch (WebView2RuntimeNotFoundException ex)
        {
            ExitCode = 1;
            Dialogs.ShowError(this, Texts.WebViewMissingTitle, Texts.WebViewMissing, ex.Message,
                new DialogAction(Texts.OpenDownloadPage, () => Dialogs.OpenInBrowser(DownloadPage)), Texts.Quit);
            RequestClose();
            return false;
        }
    }

    private async Task OpenWebViewAsync(Uri origin)
    {
        _ownOrigin = origin;
        var environment = await CoreWebView2Environment.CreateAsync(null, _paths.WebViewDirectory);
        _web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = _palette.Page, Visible = false, Name = "web" };
        Controls.Add(_web);
        await _web.EnsureCoreWebView2Async(environment);
        var core = _web.CoreWebView2;
        Configure(core);

        // The per-run secret as a cookie, before the very first request: the server answers the API only with it
        var cookie = core.CookieManager.CreateCookie(AuthConstants.DesktopCookie, _server!.Token, "127.0.0.1", "/");
        cookie.IsHttpOnly = true;
        cookie.IsSecure = false;
        cookie.SameSite = CoreWebView2CookieSameSiteKind.Strict;
        core.CookieManager.AddOrUpdateCookie(cookie);

        var loaded = new TaskCompletionSource<CoreWebView2NavigationCompletedEventArgs>(TaskCreationOptions.RunContinuationsAsynchronously);
        void OnCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e) => loaded.TrySetResult(e);
        core.NavigationCompleted += OnCompleted;
        core.Navigate(origin.AbsoluteUri);
        var finished = await Task.WhenAny(loaded.Task, Task.Delay(TimeSpan.FromSeconds(30), _cts.Token));
        core.NavigationCompleted -= OnCompleted;
        _cts.Token.ThrowIfCancellationRequested();
        if (finished != loaded.Task) throw new TimeoutException($"{origin.AbsoluteUri} wurde nicht innerhalb von 30 Sekunden geladen.");
        var result = await loaded.Task;
        if (!result.IsSuccess) throw new InvalidOperationException($"{origin.AbsoluteUri} konnte nicht geladen werden ({result.WebErrorStatus}).");
        if (result.HttpStatusCode >= 400)
        {
            throw new InvalidOperationException(Texts.UiNotFound(origin.AbsoluteUri, result.HttpStatusCode));
        }

        _web.Visible = true;
        _loading.Visible = false;
        DesktopLog.Info($"Oberfläche geladen ({origin.AbsoluteUri}, WebView2 {environment.BrowserVersionString}).");
    }

    private void Configure(CoreWebView2 core)
    {
        var settings = core.Settings;
        // Dev tools, F12 and the browser's shortcuts only in a development run
        settings.AreDevToolsEnabled = _options.Dev;
        settings.AreBrowserAcceleratorKeysEnabled = _options.Dev;
        settings.IsStatusBarEnabled = false;
        settings.IsPasswordAutosaveEnabled = false;
        settings.IsGeneralAutofillEnabled = false;
        settings.IsSwipeNavigationEnabled = false;
        // The page has no business talking to the host; the app uses its own dialogs, never script dialogs
        settings.IsWebMessageEnabled = false;
        settings.AreHostObjectsAllowed = false;
        settings.AreDefaultScriptDialogsEnabled = false;
        // Zoom (Ctrl + wheel / Ctrl + plus) stays available on purpose: readability matters more than a fixed scale

        core.NavigationStarting += (_, e) =>
        {
            if (_ownOrigin is null) return;
            switch (NavigationPolicy.Decide(e.Uri, _ownOrigin))
            {
                case NavigationDecision.Allow:
                    return;
                case NavigationDecision.OpenExternally:
                    e.Cancel = true;
                    Dialogs.OpenInBrowser(e.Uri);
                    return;
                default:
                    e.Cancel = true;
                    DesktopLog.Warn($"Navigation blockiert: {e.Uri}");
                    return;
            }
        };
        core.FrameNavigationStarting += (_, e) =>
        {
            if (_ownOrigin is not null && NavigationPolicy.Decide(e.Uri, _ownOrigin) != NavigationDecision.Allow)
            {
                e.Cancel = true;
                DesktopLog.Warn($"Frame-Navigation blockiert: {e.Uri}");
            }
        };
        core.NewWindowRequested += (_, e) =>
        {
            // Never a second window: external web links go to the default browser, everything else is dropped
            e.Handled = true;
            if (_ownOrigin is not null && NavigationPolicy.Decide(e.Uri, _ownOrigin, newWindow: true) == NavigationDecision.OpenExternally)
            {
                Dialogs.OpenInBrowser(e.Uri);
            }
        };
        // mailto:, ms-settings: and other app protocols never start another program from the page
        core.LaunchingExternalUriScheme += (_, e) => e.Cancel = true;
        // No camera, microphone, location, notifications ...: the app needs none of them
        core.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;

        core.ProcessFailed += (_, e) =>
        {
            DesktopLog.Error($"WebView2-Prozess {e.ProcessFailedKind} ({e.Reason}) beendet.");
            if (e.ProcessFailedKind is CoreWebView2ProcessFailedKind.RenderProcessExited or CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
            {
                // Only the page's process died: a reload brings it back
                BeginInvoke(() => core.Reload());
                return;
            }
            BeginInvoke(() =>
            {
                ExitCode = 1;
                Dialogs.ShowError(this, Texts.WebViewProcessFailedTitle, Texts.WebViewProcessFailed(e.ProcessFailedKind.ToString(), e.Reason.ToString()), closeText: Texts.Quit);
                RequestClose();
            });
        };

        if (!_options.Dev)
        {
            // The browser's own menu (back, reload, save as, print ...) makes no sense in a program: only the editing entries stay
            core.ContextMenuRequested += (_, e) =>
            {
                var items = e.MenuItems;
                for (var i = items.Count - 1; i >= 0; i--)
                {
                    if (items[i].Kind != CoreWebView2ContextMenuItemKind.Separator && !EditMenuItems.Contains(items[i].Name)) items.RemoveAt(i);
                }
                for (var i = items.Count - 1; i >= 0; i--)
                {
                    var isSeparator = items[i].Kind == CoreWebView2ContextMenuItemKind.Separator;
                    if (isSeparator && (i == 0 || i == items.Count - 1 || items[i - 1].Kind == CoreWebView2ContextMenuItemKind.Separator)) items.RemoveAt(i);
                }
                if (items.Count == 0) e.Handled = true;
            };
        }
    }

    // ---- close ----------------------------------------------------------------------------------------------------------------

    /// <summary>Closes the window the normal way (so the server is stopped first) - callable from anywhere on the UI thread.</summary>
    private void RequestClose() => BeginInvoke(Close);

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (_canClose)
        {
            base.OnFormClosing(e);
            return;
        }
        SaveWindowState();
        if (ClosePolicy.BoundedWait(e.CloseReason) is { } limit)
        {
            // Windows is shutting down or the task manager ends the program: no holding the window open, only a short bounded wait
            _shutdownStarted = true;
            _cts.Cancel();
            StopServerWithin(limit);
            _canClose = true;
            base.OnFormClosing(e);
            return;
        }
        // The server has to stop first (its final backup): hold the window open, show that, close when it is done
        e.Cancel = true;
        if (_shutdownStarted) return;
        _shutdownStarted = true;
        _ = ShutdownAsync();
    }

    private void StopServerWithin(TimeSpan limit)
    {
        if (_server is null) return;
        try
        {
            // Task.Run: the stop must not need the UI thread, which is blocked here
            var server = _server;
            if (!Task.Run(() => server.StopAsync()).Wait(limit)) DesktopLog.Warn($"Server beim Herunterfahren von Windows nicht innerhalb von {limit.TotalSeconds} Sekunden beendet.");
        }
        catch (AggregateException ex)
        {
            DesktopLog.Error($"Server konnte beim Herunterfahren nicht sauber beendet werden: {ex.InnerException?.Message ?? ex.Message}");
        }
    }

    private async Task ShutdownAsync()
    {
        try
        {
            _loading.Status = Texts.Stopping;
            _loading.Visible = true;
            _loading.BringToFront();
            if (_web is not null) _web.Visible = false;

            _cts.Cancel();
            if (_startTask is not null)
            {
                try { await _startTask; }
                catch (Exception ex) { DesktopLog.Warn($"Start wurde beim Beenden abgebrochen: {ex.Message}"); }
            }
            if (_server is not null)
            {
                try { await _server.StopAsync(); }
                catch (Exception ex) { DesktopLog.Error($"Server konnte nicht sauber beendet werden: {ex}"); }
            }
            _web?.Dispose();
        }
        finally
        {
            _canClose = true;
            Close();
        }
    }

    private void SaveWindowState()
    {
        // A run on a chosen development monitor must not overwrite the position the user really works with
        if (DevMonitor.Active) return;
        SaveWindowStateCore();
    }

    private void SaveWindowStateCore()
    {
        try
        {
            var normal = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
            if (normal.Width <= 0 || normal.Height <= 0) return;
            new StoredWindow(normal.X, normal.Y, normal.Width, normal.Height, _wasMaximized).Save(_paths.WindowStateFile);
        }
        catch (Exception ex) when (ex is InvalidOperationException or ArgumentException)
        {
            DesktopLog.Warn($"Fensterposition nicht gespeichert: {ex.Message}");
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            SystemEvents.UserPreferenceChanged -= OnUserPreferenceChanged;
            _cts.Dispose();
        }
        base.Dispose(disposing);
    }
}
