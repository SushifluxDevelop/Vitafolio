using System.Runtime.InteropServices;

namespace Cv.Desktop.Ui;

/// <summary>
/// Development and test runs: when the environment variable <c>CV_DEV_MONITOR</c> is set, the program's windows and dialogs open on the
/// monitor it names, centred, and never take the focus or come to the front - so a test run does not disturb whatever is in use on the
/// main screen. The value is matched (case-insensitive substring) against the monitor's hardware id (e.g. <c>MONITOR\XYZ1234\...</c>,
/// stable even when Windows renumbers its displays) and then against the screen's device name (<c>\\.\DISPLAY1</c>). Set but no match:
/// the first non-primary screen. Not set: normal behaviour (remembered position, normal activation).
/// </summary>
internal static class DevMonitor
{
    public const string Variable = "CV_DEV_MONITOR";

    /// <summary>One screen as the matching sees it.</summary>
    internal sealed record ScreenInfo(string DeviceName, IReadOnlyList<string> HardwareIds, bool Primary, Rectangle WorkingArea);

    public static string? Pattern => Environment.GetEnvironmentVariable(Variable) is { } value && !string.IsNullOrWhiteSpace(value) ? value.Trim() : null;

    public static bool Active => Pattern is not null;

    /// <summary>The index of the screen to use: hardware id match, then device name match, then the first non-primary screen, then the primary one.</summary>
    internal static int Pick(IReadOnlyList<ScreenInfo> screens, string pattern)
    {
        if (screens.Count == 0) return -1;
        for (var i = 0; i < screens.Count; i++)
        {
            if (screens[i].HardwareIds.Any(id => id.Contains(pattern, StringComparison.OrdinalIgnoreCase))) return i;
        }
        for (var i = 0; i < screens.Count; i++)
        {
            if (screens[i].DeviceName.Contains(pattern, StringComparison.OrdinalIgnoreCase)) return i;
        }
        for (var i = 0; i < screens.Count; i++)
        {
            if (!screens[i].Primary) return i;
        }
        return Math.Max(0, screens.ToList().FindIndex(s => s.Primary));
    }

    /// <summary>The working area of the chosen monitor, or null when the mode is off.</summary>
    public static Rectangle? WorkingArea()
    {
        if (Pattern is not { } pattern) return null;
        var screens = Screen.AllScreens.Select(s => new ScreenInfo(s.DeviceName, HardwareIds(s.DeviceName), s.Primary, s.WorkingArea)).ToList();
        var index = Pick(screens, pattern);
        return index < 0 ? null : screens[index].WorkingArea;
    }

    /// <summary>Centres the form on the chosen monitor (shrinking it to fit if needed). Does nothing when the mode is off. Never activates the form.</summary>
    public static void Center(Form form)
    {
        if (WorkingArea() is not { } area) return;
        var width = Math.Min(form.Width, area.Width);
        var height = Math.Min(form.Height, area.Height);
        form.Bounds = new Rectangle(area.Left + (area.Width - width) / 2, area.Top + (area.Height - height) / 2, width, height);
    }

    private static List<string> HardwareIds(string deviceName)
    {
        var ids = new List<string>();
        for (uint i = 0; i < 8; i++)
        {
            var device = new DisplayDevice { Size = Marshal.SizeOf<DisplayDevice>() };
            if (!EnumDisplayDevices(deviceName, i, ref device, 0)) break;
            if (!string.IsNullOrEmpty(device.DeviceId)) ids.Add(device.DeviceId);
        }
        return ids;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DisplayDevice
    {
        public int Size;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string DeviceName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceString;
        public int StateFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceId;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string DeviceKey;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumDisplayDevices(string? device, uint index, ref DisplayDevice displayDevice, uint flags);
}
