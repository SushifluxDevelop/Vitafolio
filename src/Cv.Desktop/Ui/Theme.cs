using System.Reflection;
using Cv.Desktop.Hosting;
using Microsoft.Win32;

namespace Cv.Desktop.Ui;

/// <summary>
/// The colours of the program's own surfaces (loading view, dialogs) - the app's brand navy, gold and cream, in a dark and a light variant
/// that follows the Windows app mode. Contrast: text on page 14:1 (dark) / 14:1 (light), muted text above 6:1, the gold and navy buttons
/// carry their label at 7.8:1 / 14:1, borders above 3:1.
/// </summary>
internal sealed record Palette(Color Page, Color PageTop, Color Surface, Color Text, Color Muted, Color Accent, Color AccentText, Color Border, bool IsDark)
{
    public static readonly Palette Dark = new(
        Page: Color.FromArgb(0x14, 0x21, 0x3D),
        PageTop: Color.FromArgb(0x1D, 0x2F, 0x57),
        Surface: Color.FromArgb(0x1B, 0x2B, 0x4D),
        Text: Color.FromArgb(0xF3, 0xEE, 0xE2),
        Muted: Color.FromArgb(0xB4, 0xBB, 0xCB),
        Accent: Color.FromArgb(0xD9, 0xAE, 0x57),
        AccentText: Color.FromArgb(0x14, 0x21, 0x3D),
        Border: Color.FromArgb(0x6F, 0x7F, 0xA3),
        IsDark: true);

    public static readonly Palette Light = new(
        Page: Color.FromArgb(0xF3, 0xEE, 0xE2),
        PageTop: Color.FromArgb(0xFA, 0xF7, 0xEF),
        Surface: Color.FromArgb(0xFF, 0xFF, 0xFF),
        Text: Color.FromArgb(0x14, 0x21, 0x3D),
        Muted: Color.FromArgb(0x4A, 0x55, 0x68),
        Accent: Color.FromArgb(0x14, 0x21, 0x3D),
        AccentText: Color.FromArgb(0xF3, 0xEE, 0xE2),
        Border: Color.FromArgb(0x8A, 0x84, 0x73),
        IsDark: false);

    /// <summary>Windows' app mode right now ("Choose your default app mode"): dark unless the user chose light.</summary>
    public static Palette Current => WindowsUsesDarkApps() ? Dark : Light;

    public static bool WindowsUsesDarkApps()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
            return key?.GetValue("AppsUseLightTheme") is int light && light == 0;
        }
        catch (Exception ex) when (ex is System.Security.SecurityException or UnauthorizedAccessException or IOException)
        {
            return false;
        }
    }
}

/// <summary>Window chrome and icon helpers.</summary>
internal static class Chrome
{
    private const int UseImmersiveDarkMode = 20;
    private const int UseImmersiveDarkModeBeforeWin10_2004 = 19;

    /// <summary>Dark or light title bar (Windows 10 2004 and newer, Windows 11); older systems keep the light one.</summary>
    public static void UseDarkTitleBar(IntPtr handle, bool dark)
    {
        var value = dark ? 1 : 0;
        if (Native.DwmSetWindowAttribute(handle, UseImmersiveDarkMode, ref value, sizeof(int)) != 0)
        {
            Native.DwmSetWindowAttribute(handle, UseImmersiveDarkModeBeforeWin10_2004, ref value, sizeof(int));
        }
    }

    /// <summary>The program's icon (the .ico embedded in the exe) in the sizes Windows asks for.</summary>
    public static Icon WindowIcon { get; } = Load(0, 0);

    /// <summary>The icon's largest image as a bitmap at <paramref name="size"/> pixels (the 256 px image scaled down).</summary>
    public static Bitmap LogoBitmap(int size)
    {
        using var icon = Load(256, 256);
        using var source = icon.ToBitmap();
        var bitmap = new Bitmap(size, size);
        using var g = Graphics.FromImage(bitmap);
        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
        g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
        g.DrawImage(source, 0, 0, size, size);
        return bitmap;
    }

    private static Icon Load(int width, int height)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("app.ico")
                           ?? throw new InvalidOperationException("The embedded app icon is missing.");
        return width == 0 ? new Icon(stream) : new Icon(stream, width, height);
    }
}
