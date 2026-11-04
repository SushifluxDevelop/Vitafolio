using Cv.Server.Configuration;

namespace Cv.Desktop.Hosting;

/// <summary>
/// The version shown in error reports and logs, in the readable form (<c>v2026.11.12 (13.557)</c>, beta with the beta sign, dev with
/// <c>-dev</c>). Taken from version.txt next to the program (or the repository's, in a source checkout) and the channel - formatted by the
/// server's one <see cref="VersionFormat"/> helper. The channel: <c>dev</c> for a development run, otherwise the text in
/// release-channel.txt next to the program (written by the packaging script), otherwise <c>release</c>.
/// </summary>
internal static class DesktopVersion
{
    public static string Channel(DesktopOptions options)
    {
        if (options.Dev) return "dev";
        try
        {
            var file = Path.Combine(AppContext.BaseDirectory, "release-channel.txt");
            if (File.Exists(file))
            {
                var value = File.ReadAllText(file).Trim().ToLowerInvariant();
                if (value is "beta" or "dev" or "release") return value;
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // Unreadable: the plain release form
        }
        return "release";
    }

    public static string Readable(string channel)
    {
        var (shortVersion, buildId) = Read();
        return VersionFormat.Display(shortVersion, buildId, channel);
    }

    private static (string Short, string? BuildId) Read()
    {
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "version.txt");
            if (!File.Exists(path) && DesktopPaths.FindRepositoryRoot() is { } root) path = Path.Combine(root, "version.txt");
            if (File.Exists(path))
            {
                var lines = File.ReadAllText(path).Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (lines.Length > 0) return (lines[0], lines.Length > 1 ? lines[1] : null);
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // Being rewritten by the commit hook right now: the fallback
        }
        return (AppVersion.Fallback, null);
    }
}
