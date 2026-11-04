using Cv.Desktop.Ui;

namespace Cv.Desktop.Tests;

public sealed class WindowPlacementTests
{
    private static readonly Rectangle Primary = new(0, 0, 1920, 1040);
    private static readonly Rectangle Second = new(1920, 0, 1920, 1040);
    private static readonly Size DefaultSize = new(1296, 859);

    [Fact]
    public void First_start_is_centred_on_the_primary_screen()
    {
        var (bounds, maximized) = WindowPlacement.Resolve(null, [Primary], Primary, DefaultSize);

        Assert.False(maximized);
        Assert.Equal(DefaultSize, bounds.Size);
        Assert.Equal(new Point((1920 - 1296) / 2, (1040 - 859) / 2), bounds.Location);
    }

    [Fact]
    public void A_small_screen_limits_the_default_size()
    {
        var small = new Rectangle(0, 0, 1100, 700);

        var (bounds, _) = WindowPlacement.Resolve(null, [small], small, DefaultSize);

        Assert.Equal(new Size(1100, 700), bounds.Size);
        Assert.Equal(small, bounds);
    }

    [Fact]
    public void Stored_bounds_and_maximised_state_are_restored()
    {
        var stored = new StoredWindow(2100, 80, 1500, 900, Maximized: true);

        var (bounds, maximized) = WindowPlacement.Resolve(stored, [Primary, Second], Primary, DefaultSize);

        Assert.Equal(new Rectangle(2100, 80, 1500, 900), bounds);
        Assert.True(maximized);
    }

    [Fact]
    public void A_monitor_that_is_gone_brings_the_window_back_to_the_primary_screen()
    {
        var stored = new StoredWindow(2100, 80, 1500, 900, Maximized: true);

        var (bounds, maximized) = WindowPlacement.Resolve(stored, [Primary], Primary, DefaultSize);

        Assert.False(maximized);
        Assert.True(Primary.Contains(bounds));
    }

    [Theory]
    [InlineData(-32000, -32000, 1500, 900)] // Windows' parking place of minimised windows
    [InlineData(100, 100, 0, 0)]
    [InlineData(100, 5000, 1500, 900)]
    public void Unusable_stored_values_are_ignored(int x, int y, int width, int height)
    {
        var (bounds, maximized) = WindowPlacement.Resolve(new StoredWindow(x, y, width, height, true), [Primary], Primary, DefaultSize);

        Assert.False(maximized);
        Assert.Equal(DefaultSize, bounds.Size);
    }

    [Fact]
    public void The_stored_state_survives_a_round_trip_and_a_damaged_file_gives_nothing()
    {
        var file = Path.Combine(Path.GetTempPath(), "cv-window-" + Guid.NewGuid().ToString("N") + ".json");
        try
        {
            new StoredWindow(10, 20, 1300, 800, true).Save(file);
            Assert.Equal(new StoredWindow(10, 20, 1300, 800, true), StoredWindow.Load(file));

            File.WriteAllText(file, "{ not json");
            Assert.Null(StoredWindow.Load(file));
        }
        finally
        {
            File.Delete(file);
        }
    }
}
