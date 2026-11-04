using Cv.Desktop.Ui;

namespace Cv.Desktop.Tests;

public sealed class DevMonitorTests
{
    private static DevMonitor.ScreenInfo Screen(string name, bool primary, params string[] ids) =>
        new(name, ids, primary, new Rectangle(primary ? 0 : -2160, 0, 1920, 1040));

    private static readonly List<DevMonitor.ScreenInfo> Screens =
    [
        Screen("DISPLAY1", primary: true, "MONITOR/AAA0001/{4d36e96e}/0001"),
        Screen("DISPLAY2", primary: false, "MONITOR/ABC1234/{4d36e96e}/0002"),
        Screen("DISPLAY3", primary: false, "MONITOR/DEL4000/{4d36e96e}/0003"),
    ];

    [Theory]
    [InlineData("ABC1234", 1)]
    [InlineData("abc1234", 1)] // case-insensitive
    [InlineData("DEL4000", 2)]
    [InlineData("AAA0001", 0)] // a named monitor wins even when it is the primary one
    [InlineData("DISPLAY3", 2)] // device name as the second choice
    public void A_named_monitor_is_found_by_hardware_id_or_device_name(string pattern, int expected) =>
        Assert.Equal(expected, DevMonitor.Pick(Screens, pattern));

    [Fact]
    public void Hardware_id_beats_device_name()
    {
        // The pattern is part of one screen's device name and another screen's hardware id: the hardware id decides
        var screens = new List<DevMonitor.ScreenInfo>
        {
            Screen("DISPLAY2", primary: true, "MONITOR/AAA0001/1"),
            Screen("DISPLAY3", primary: false, "MONITOR/ZZZ0002/2", "MONITOR/DISPLAY2X/3"),
        };

        Assert.Equal(1, DevMonitor.Pick(screens, "DISPLAY2"));
    }

    [Fact]
    public void No_match_falls_back_to_the_first_non_primary_screen() =>
        Assert.Equal(1, DevMonitor.Pick(Screens, "NOPE9999"));

    [Fact]
    public void No_match_and_only_the_primary_screen_uses_the_primary_one() =>
        Assert.Equal(0, DevMonitor.Pick([Screen("DISPLAY1", primary: true, "MONITOR/AAA0001/1")], "NOPE9999"));
}
