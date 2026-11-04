namespace Cv.Desktop.Hosting;

/// <summary>
/// The command line of the program. <c>--dev</c>: development run (fixed server port, the window shows the Vite dev server, dev tools on,
/// data in the repository's <c>.data</c> folder). <c>--smoke</c>: start the server in desktop mode with a temporary data folder, check it,
/// print the result and exit - no window (for CI). Unknown arguments are ignored (the installer's hooks pass their own and are handled
/// by Velopack before this code runs).
/// </summary>
internal sealed record DesktopOptions(bool Dev, bool Smoke)
{
    /// <summary>Fixed ports of the desktop development setup: the server, and the Vite dev server that proxies /api to it.</summary>
    public const int DevServerPort = 5243;

    public const int DevVitePort = 5244;

    public static DesktopOptions Parse(IReadOnlyList<string> args)
    {
        var dev = false;
        var smoke = false;
        foreach (var arg in args)
        {
            if (string.Equals(arg, "--dev", StringComparison.OrdinalIgnoreCase)) dev = true;
            else if (string.Equals(arg, "--smoke", StringComparison.OrdinalIgnoreCase)) smoke = true;
        }
        return new DesktopOptions(dev, smoke);
    }
}
