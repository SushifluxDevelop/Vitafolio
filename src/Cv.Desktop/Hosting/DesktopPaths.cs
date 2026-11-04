using Cv.Server.Configuration;

namespace Cv.Desktop.Hosting;

/// <summary>
/// Where the program keeps its files: the data folder (database, keys, backups - the server's own layout inside it), the WebView2 profile
/// and the window state next to them. Normal use: <c>%LOCALAPPDATA%\&lt;Company&gt;\&lt;Product&gt;</c> (both from branding.json; the
/// environment variable <c>DATA_DIR</c> overrides it). Never <c>%LOCALAPPDATA%\&lt;Product&gt;</c>: the installer (Velopack, package id =
/// product) installs the program there, and an uninstall or reinstall deletes that folder with everything in it.
/// Development run: <c>.data/desktop</c> in the repository, so a test run never touches the data of an installed program.
/// </summary>
internal sealed class DesktopPaths(string dataDirectory, string? legacyDirectory = null)
{
    /// <summary>The files and folders of the data folder (everything else in the old location belongs to the installer).</summary>
    internal static readonly string[] DataEntries =
        ["app.db", "app.db-wal", "app.db-shm", "keys", "backups", "webview", "logs", "window.json"];

    public string DataDirectory { get; } = dataDirectory;

    /// <summary>The data location of earlier builds (inside the installer's folder); null when not relevant (DATA_DIR, development).</summary>
    public string? LegacyDirectory { get; } = legacyDirectory;

    /// <summary>The WebView2 user data folder (cookies, cache) - the program's own profile, never the browser's.</summary>
    public string WebViewDirectory => Path.Combine(DataDirectory, "webview");

    public string WindowStateFile => Path.Combine(DataDirectory, "window.json");

    public string LogDirectory => Path.Combine(DataDirectory, "logs");

    public static DesktopPaths Resolve(DesktopOptions options)
    {
        var fromEnvironment = Environment.GetEnvironmentVariable("DATA_DIR");
        if (!string.IsNullOrWhiteSpace(fromEnvironment)) return new DesktopPaths(Path.GetFullPath(fromEnvironment.Trim()));

        if (options.Dev && FindRepositoryRoot() is { } root) return new DesktopPaths(Path.Combine(root, ".data", "desktop"));

        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        return new DesktopPaths(Branding.DesktopDataDirectory(local), Branding.LegacyDesktopDataDirectory(local));
    }

    /// <summary>
    /// Moves the data of an earlier build out of the installer's folder - once, only when the new data folder does not exist yet and the
    /// old place really holds data (a database or keys). Only the data entries are moved; the installer's own files stay. Returns a German
    /// line for the log, or null when there was nothing to do.
    /// </summary>
    public static string? MigrateLegacy(string? legacy, string target)
    {
        if (legacy is null || Directory.Exists(target) || !Directory.Exists(legacy)) return null;
        if (string.Equals(Path.GetFullPath(legacy), Path.GetFullPath(target), StringComparison.OrdinalIgnoreCase)) return null;
        if (!File.Exists(Path.Combine(legacy, "app.db")) && !Directory.Exists(Path.Combine(legacy, "keys"))) return null;

        Directory.CreateDirectory(target);
        var moved = new List<string>();
        foreach (var name in DataEntries)
        {
            var from = Path.Combine(legacy, name);
            var to = Path.Combine(target, name);
            if (Directory.Exists(from))
            {
                Directory.Move(from, to);
                moved.Add(name);
            }
            else if (File.Exists(from))
            {
                File.Move(from, to);
                moved.Add(name);
            }
        }
        return $"Daten aus dem alten Ort {legacy} nach {target} verschoben ({string.Join(", ", moved)}); der alte Ort war der Programmordner des Installers, den eine Neuinstallation löscht.";
    }

    /// <summary>The folder with Cv.slnx above the program, when it runs from a source checkout; null otherwise.</summary>
    public static string? FindRepositoryRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            if (File.Exists(Path.Combine(dir.FullName, "Cv.slnx"))) return dir.FullName;
        }
        return null;
    }
}
