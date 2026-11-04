namespace Cv.Server.Configuration;

/// <summary>The running version in all forms the API returns.</summary>
public sealed record VersionInfo(string Version, string Short, string? BuildId, string Channel);

/// <summary>
/// Reads version.txt (written by the pre-commit hook) fresh on every call, so a new commit shows without a restart. A missing or empty
/// file counts as <c>v0.0.0</c> without counters (before the first commit).
/// </summary>
public sealed class AppVersion(ServerSettings settings)
{
    public const string Fallback = "v0.0.0";

    public VersionInfo Current
    {
        get
        {
            var (shortVersion, buildId) = Read(settings.VersionFilePath);
            return new VersionInfo(VersionFormat.Display(shortVersion, buildId, settings.Channel), shortVersion, buildId, settings.Channel);
        }
    }

    internal static (string Short, string? BuildId) Read(string? path)
    {
        try
        {
            if (path is not null && File.Exists(path))
            {
                var lines = File.ReadAllText(path)
                    .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (lines.Length > 0) return (lines[0], lines.Length > 1 ? lines[1] : null);
            }
        }
        catch (IOException)
        {
            // Being rewritten by the hook at this very moment: the fallback for this one request
        }
        catch (UnauthorizedAccessException)
        {
        }
        return (Fallback, null);
    }
}
