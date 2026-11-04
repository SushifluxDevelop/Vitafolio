using Cv.Server.Backups;
using Cv.Server.Errors;

namespace Cv.Server.Tests;

public sealed class BackupScheduleTests
{
    private static readonly TimeZoneInfo Utc = TimeZoneInfo.Utc;

    // 2026-11-04 is a Wednesday
    private static readonly DateTime Now = new(2026, 11, 4, 7, 30, 0, DateTimeKind.Utc);

    private static BackupSettings Interval(int hours) => new() { Schedule = new BackupScheduleSettings { Kind = "interval", IntervalHours = hours } };

    private static BackupSettings Times(string[] times, int[] weekdays) =>
        new() { Schedule = new BackupScheduleSettings { Kind = "times", Times = times, Weekdays = weekdays } };

    [Fact]
    public void Interval_runs_are_aligned_to_midnight()
    {
        var runs = BackupSchedule.NextRuns(Interval(6), Now, Utc, TimeSpan.FromDays(7));
        Assert.Equal(new DateTime(2026, 11, 4, 12, 0, 0, DateTimeKind.Utc), runs[0]);
        Assert.Equal(new DateTime(2026, 11, 4, 18, 0, 0, DateTimeKind.Utc), runs[1]);
        Assert.Equal(28, runs.Count);
        Assert.All(runs.Zip(runs.Skip(1)), pair => Assert.Equal(TimeSpan.FromHours(6), pair.Second - pair.First));
    }

    [Fact]
    public void Weekly_interval_runs_on_monday_midnight()
    {
        var next = BackupSchedule.Next(Interval(168).Schedule, Now, Utc);
        Assert.Equal(new DateTime(2026, 11, 9, 0, 0, 0, DateTimeKind.Utc), next);
        Assert.Equal(DayOfWeek.Monday, next!.Value.DayOfWeek);
    }

    [Fact]
    public void Fixed_times_on_chosen_weekdays()
    {
        var now = new DateTime(2026, 11, 4, 10, 0, 0, DateTimeKind.Utc);
        var runs = BackupSchedule.NextRuns(Times(["14:30", "02:00"], [1, 3]), now, Utc, TimeSpan.FromDays(7));
        Assert.Equal(
        [
            new DateTime(2026, 11, 4, 14, 30, 0, DateTimeKind.Utc),
            new DateTime(2026, 11, 9, 2, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 11, 9, 14, 30, 0, DateTimeKind.Utc),
            new DateTime(2026, 11, 11, 2, 0, 0, DateTimeKind.Utc),
        ], runs);
    }

    [Fact]
    public void Fixed_times_are_local_times_of_the_zone()
    {
        var plusOne = TimeZoneInfo.CreateCustomTimeZone("Test+1", TimeSpan.FromHours(1), "Test+1", "Test+1");
        var next = BackupSchedule.Next(Times(["02:00"], [1, 2, 3, 4, 5, 6, 7]).Schedule, Now, plusOne);
        Assert.Equal(new DateTime(2026, 11, 5, 1, 0, 0, DateTimeKind.Utc), next);
    }

    [Fact]
    public void Missed_runs_are_caught_up_only_when_wanted()
    {
        var at = new DateTime(2026, 11, 4, 13, 0, 0, DateTimeKind.Utc);
        var settings = Interval(6);
        var lastBeforeDowntime = new DateTime(2026, 11, 4, 6, 0, 0, DateTimeKind.Utc);
        Assert.Equal(new DateTime(2026, 11, 4, 12, 0, 0, DateTimeKind.Utc), BackupSchedule.MissedRun(settings, lastBeforeDowntime, at, Utc));
        Assert.Null(BackupSchedule.MissedRun(settings, new DateTime(2026, 11, 4, 12, 0, 0, DateTimeKind.Utc), at, Utc));
        Assert.Null(BackupSchedule.MissedRun(settings, null, at, Utc));
        Assert.Null(BackupSchedule.MissedRun(settings with { CatchUpMissed = false }, lastBeforeDowntime, at, Utc));
        Assert.Null(BackupSchedule.MissedRun(settings with { AutomaticEnabled = false }, lastBeforeDowntime, at, Utc));

        // Fixed times: Monday 02:00 was missed when the server was off from Sunday to Wednesday
        var weekly = Times(["02:00"], [1]);
        Assert.Equal(new DateTime(2026, 11, 2, 2, 0, 0, DateTimeKind.Utc),
            BackupSchedule.MissedRun(weekly, new DateTime(2026, 11, 1, 20, 0, 0, DateTimeKind.Utc), at, Utc));
    }

    [Fact]
    public void Master_switch_and_kind_off_plan_nothing()
    {
        Assert.Empty(BackupSchedule.NextRuns(Interval(6) with { AutomaticEnabled = false }, Now, Utc, TimeSpan.FromDays(7)));
        Assert.Empty(BackupSchedule.NextRuns(new BackupSettings { Schedule = new BackupScheduleSettings { Kind = "off" } }, Now, Utc, TimeSpan.FromDays(7)));
    }

    [Fact]
    public void Validation_reports_every_wrong_field()
    {
        var bad = new BackupSettings
        {
            KeepRecent = 2,
            KeepDailyDays = -1,
            Schedule = new BackupScheduleSettings { Kind = "times", IntervalHours = 0, Times = ["25:00", "2:00"], Weekdays = [0] },
        };
        var ex = Assert.Throws<ApiException>(() => BackupSettings.Validate(bad));
        Assert.Equal("validation.failed", ex.Code);
        Assert.Equal(
            ["keepRecent", "keepDailyDays", "schedule.intervalHours", "schedule.times[0]", "schedule.times[1]", "schedule.weekdays"],
            ex.Errors!.Keys);
        BackupSettings.Validate(new BackupSettings());
    }
}
