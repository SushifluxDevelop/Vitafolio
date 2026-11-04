using System.Runtime.InteropServices;

namespace Cv.Desktop.Hosting;

/// <summary>The few Windows calls the program needs besides WinForms.</summary>
internal static partial class Native
{
    private const uint AttachParentProcess = 0xFFFFFFFF;

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool AllowSetForegroundWindow(int processId);

    [LibraryImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool SetForegroundWindow(nint hwnd);

    [LibraryImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static partial bool AttachConsole(uint processId);

    [LibraryImport("uxtheme.dll", StringMarshalling = StringMarshalling.Utf16)]
    internal static partial int SetWindowTheme(nint hwnd, string subAppName, string? subIdList);

    [LibraryImport("dwmapi.dll")]
    internal static partial int DwmSetWindowAttribute(nint hwnd, int attribute, ref int value, int size);

    /// <summary>
    /// The program is a windowed exe without a console. A command-line run (<c>--smoke</c>) attaches to the console it was started from so its
    /// result is readable there; when the output is redirected (CI, <c>Start-Process -RedirectStandardOutput</c>) nothing needs to be done.
    /// </summary>
    internal static void AttachToParentConsole()
    {
        if (Console.IsOutputRedirected || !AttachConsole(AttachParentProcess)) return;
        try
        {
            // A windowed exe starts without standard handles: write to the attached console's output device explicitly
            Console.SetOut(new StreamWriter(new FileStream("CONOUT$", FileMode.Open, FileAccess.Write, FileShare.ReadWrite)) { AutoFlush = true });
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            // No console to write to: the exit code still tells the result
        }
    }
}
