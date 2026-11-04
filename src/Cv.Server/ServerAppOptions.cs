namespace Cv.Server;

/// <summary>How the server is hosted.</summary>
public enum HostMode
{
    /// <summary>Docker / development: accounts, sign-in, sessions.</summary>
    Server,

    /// <summary>Windows program: one local owner, no sign-in, loopback only, authenticated by the host's per-run cookie.</summary>
    Desktop,
}

/// <summary>
/// What a host passes to <see cref="ServerApp.Build"/>. Every value left null is taken from configuration (environment variables
/// <c>DATA_DIR</c>, <c>BACKUP_DIR</c>, <c>APP_CHANNEL</c>, <c>TRUSTED_PROXIES</c>, <c>WEB_ROOT</c>) or from the defaults.
/// </summary>
public sealed class ServerAppOptions
{
    public HostMode Mode { get; init; } = HostMode.Server;

    /// <summary>Addresses to listen on. Desktop: exactly one, <c>http://127.0.0.1:&lt;port&gt;</c>. Empty: ASP.NET Core's own configuration (ASPNETCORE_URLS).</summary>
    public string[] Urls { get; init; } = [];

    public string? DataDirectory { get; init; }

    public string? BackupDirectory { get; init; }

    /// <summary>Folder of the built frontend (index.html + assets). Null: API only (development with the Vite dev server).</summary>
    public string? WebRootPath { get; init; }

    /// <summary>Desktop mode: the per-run secret the host sets as cookie <c>cv_desktop</c> in its WebView.</summary>
    public string? DesktopToken { get; init; }

    public string? VersionFilePath { get; init; }

    /// <summary><c>dev</c> | <c>beta</c> | <c>release</c>.</summary>
    public string? Channel { get; init; }
}
