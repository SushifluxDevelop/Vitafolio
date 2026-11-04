using System.Text.Json;
using Cv.Desktop.Hosting;

namespace Cv.Desktop.Ui;

/// <summary>What window.json remembers: the normal (not maximised) bounds in device pixels and whether the window was maximised.</summary>
internal sealed record StoredWindow(int X, int Y, int Width, int Height, bool Maximized)
{
    public static StoredWindow? Load(string file)
    {
        try
        {
            if (!File.Exists(file)) return null;
            return JsonSerializer.Deserialize<StoredWindow>(File.ReadAllText(file), Options);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            // A damaged file is no reason to fail: the window opens at its default place
            DesktopLog.Warn($"window.json nicht lesbar ({ex.Message}) - Standardposition.");
            return null;
        }
    }

    public void Save(string file)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(file)!);
            var temp = file + ".tmp";
            File.WriteAllText(temp, JsonSerializer.Serialize(this, Options));
            File.Move(temp, file, overwrite: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            DesktopLog.Warn($"Fensterposition konnte nicht gespeichert werden: {ex.Message}");
        }
    }

    private static readonly JsonSerializerOptions Options = new() { WriteIndented = true };
}

/// <summary>Where the window opens - pure, so the cases are unit-tested without a window.</summary>
internal static class WindowPlacement
{
    /// <summary>Smallest client area in design pixels (96 dpi): the narrowest width the web UI supports.</summary>
    public static readonly Size MinimumClient = new(1024, 700);

    /// <summary>Default client size of a first start in design pixels.</summary>
    public static readonly Size DefaultClient = new(1280, 820);

    /// <summary>Of the stored title bar area at least this much must lie on a screen, otherwise the window could not be grabbed.</summary>
    private const int ReachableWidth = 120;

    private const int ReachableHeight = 40;

    /// <summary>
    /// The bounds to open with. Stored bounds are used when their top edge is still reachable on some monitor (a monitor that is gone
    /// or a resolution change must never leave the window out of reach); otherwise - and on the first start - the default size centred on
    /// the primary working area (smaller if the screen is). <paramref name="defaultSize"/> is the outer window size for the default client
    /// area at the primary monitor's scale (the window knows its frame, this class does not).
    /// </summary>
    public static (Rectangle Bounds, bool Maximized) Resolve(StoredWindow? stored, IReadOnlyList<Rectangle> workingAreas, Rectangle primaryArea, Size defaultSize)
    {
        if (stored is { Width: > 0, Height: > 0 })
        {
            var rect = new Rectangle(stored.X, stored.Y, stored.Width, stored.Height);
            var title = new Rectangle(rect.X, rect.Y, rect.Width, ReachableHeight);
            foreach (var area in workingAreas)
            {
                var overlap = Rectangle.Intersect(title, area);
                if (overlap.Width >= ReachableWidth && overlap.Height >= ReachableHeight) return (rect, stored.Maximized);
            }
        }

        var width = Math.Min(defaultSize.Width, primaryArea.Width);
        var height = Math.Min(defaultSize.Height, primaryArea.Height);
        var centred = new Rectangle(primaryArea.Left + (primaryArea.Width - width) / 2, primaryArea.Top + (primaryArea.Height - height) / 2, width, height);
        return (centred, false);
    }
}
