using System.Globalization;
using System.Text.Json;
using Cv.Server.Data;
using Cv.Server.Errors;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Backups;

/// <summary>When automatic backups run. <see cref="Kind"/>: <c>off</c> | <c>interval</c> | <c>times</c>.</summary>
public sealed record BackupScheduleSettings
{
    public string Kind { get; init; } = "interval";

    /// <summary>1-168. Runs are aligned to local midnight of Monday 2000-01-03, see <see cref="BackupSchedule"/>.</summary>
    public int IntervalHours { get; init; } = 6;

    /// <summary>Local 24-hour times "HH:mm", at most 12, for kind <c>times</c>.</summary>
    public IReadOnlyList<string> Times { get; init; } = ["02:00"];

    /// <summary>ISO weekdays 1 (Monday) to 7 (Sunday) for kind <c>times</c>.</summary>
    public IReadOnlyList<int> Weekdays { get; init; } = [1, 2, 3, 4, 5, 6, 7];
}

/// <summary>The backup settings an admin (desktop: the owner) edits - stored in the database.</summary>
public sealed record BackupSettings
{
    /// <summary>Master switch: off = no automatic backup at all (start, shutdown, schedule, catch-up). Manual actions stay available.</summary>
    public bool AutomaticEnabled { get; init; } = true;

    public bool OnStart { get; init; } = true;

    public bool BeforeShutdown { get; init; } = true;

    public BackupScheduleSettings Schedule { get; init; } = new();

    /// <summary>A planned run missed while the server was not running is made right after the next start.</summary>
    public bool CatchUpMissed { get; init; } = true;

    public int KeepRecent { get; init; } = 20;

    /// <summary>0 = keep no daily copies.</summary>
    public int KeepDailyDays { get; init; } = 60;

    public const int KeepRecentMin = 5;
    public const int KeepRecentMax = 500;
    public const int KeepDailyMax = 3650;
    public const int IntervalMin = 1;
    public const int IntervalMax = 168;
    public const int TimesMax = 12;

    /// <summary>Checks every field; throws one <c>validation.failed</c> problem with all field errors (dotted field names).</summary>
    public static void Validate(BackupSettings? value)
    {
        var errors = new FieldErrors();
        if (value is null)
        {
            errors.Add("body", "validation.required");
            errors.ThrowIfAny();
            return;
        }
        if (value.KeepRecent is < KeepRecentMin or > KeepRecentMax)
        {
            errors.Add("keepRecent", "validation.range", new() { ["min"] = KeepRecentMin, ["max"] = KeepRecentMax });
        }
        if (value.KeepDailyDays is < 0 or > KeepDailyMax)
        {
            errors.Add("keepDailyDays", "validation.range", new() { ["min"] = 0, ["max"] = KeepDailyMax });
        }
        var schedule = value.Schedule;
        if (schedule is null)
        {
            errors.Add("schedule", "validation.required");
        }
        else
        {
            InputRules.OneOf(errors, "schedule.kind", schedule.Kind, "off", "interval", "times");
            if (schedule.IntervalHours is < IntervalMin or > IntervalMax)
            {
                errors.Add("schedule.intervalHours", "validation.range", new() { ["min"] = IntervalMin, ["max"] = IntervalMax });
            }
            var times = schedule.Times ?? [];
            if (times.Count > TimesMax) errors.Add("schedule.times", "validation.max_items", new() { ["max"] = TimesMax });
            for (var i = 0; i < times.Count; i++)
            {
                if (BackupSchedule.ParseTime(times[i]) is null) errors.Add($"schedule.times[{i}]", "validation.time_format");
            }
            if (times.Distinct(StringComparer.Ordinal).Count() != times.Count) errors.Add("schedule.times", "validation.duplicates");
            var weekdays = schedule.Weekdays ?? [];
            if (weekdays.Any(d => d is < 1 or > 7)) errors.Add("schedule.weekdays", "validation.range", new() { ["min"] = 1, ["max"] = 7 });
            if (schedule.Kind == "times" && times.Count == 0) errors.Add("schedule.times", "validation.required");
            if (schedule.Kind == "times" && weekdays.Count == 0) errors.Add("schedule.weekdays", "validation.required");
        }
        errors.ThrowIfAny();
    }

    /// <summary>Times sorted, weekdays sorted and unique - the stored form.</summary>
    public BackupSettings Normalized() => this with
    {
        Schedule = Schedule with
        {
            Times = (Schedule.Times ?? []).Order(StringComparer.Ordinal).ToList(),
            Weekdays = (Schedule.Weekdays ?? []).Distinct().Order().ToList(),
        },
    };
}

/// <summary>
/// The planned runs of a schedule - pure functions on a time zone, so they are unit-tested and the UI can compute the same preview.
/// <list type="bullet">
/// <item><c>interval</c>: every N hours on the local wall clock, counted from Monday 2000-01-03 00:00 local time (so N = 6 gives
/// 00:00, 06:00, 12:00, 18:00; N = 168 gives every Monday 00:00).</item>
/// <item><c>times</c>: each listed local time on each listed weekday.</item>
/// </list>
/// A wall-clock time that does not exist (the hour skipped when daylight saving starts) is moved one hour later; an ambiguous one (the
/// repeated hour in autumn) is taken in its first occurrence.
/// </summary>
public static class BackupSchedule
{
    private static readonly DateTime Epoch = new(2000, 1, 3, 0, 0, 0, DateTimeKind.Unspecified);

    public static TimeSpan? ParseTime(string? text) =>
        text is { Length: 5 } && TimeSpan.TryParseExact(text, "hh\\:mm", CultureInfo.InvariantCulture, out var t) && t < TimeSpan.FromDays(1) ? t : null;

    /// <summary>The planned runs in (now, now + horizon], UTC, ascending. Empty when automatic backups or the schedule are off.</summary>
    public static IReadOnlyList<DateTime> NextRuns(BackupSettings settings, DateTime nowUtc, TimeZoneInfo zone, TimeSpan horizon)
    {
        var result = new List<DateTime>();
        if (!settings.AutomaticEnabled) return result;
        var end = nowUtc + horizon;
        var cursor = nowUtc;
        while (Next(settings.Schedule, cursor, zone) is { } next && next <= end)
        {
            result.Add(next);
            cursor = next;
        }
        return result;
    }

    /// <summary>The first planned run strictly after <paramref name="afterUtc"/>, or null (schedule off).</summary>
    public static DateTime? Next(BackupScheduleSettings schedule, DateTime afterUtc, TimeZoneInfo zone)
    {
        var localAfter = TimeZoneInfo.ConvertTimeFromUtc(afterUtc, zone);
        switch (schedule.Kind)
        {
            case "interval":
            {
                var step = TimeSpan.FromHours(schedule.IntervalHours).Ticks;
                var index = FloorDiv((localAfter - Epoch).Ticks, step);
                // A few candidates: a skipped wall-clock hour can move one onto or before "after"
                for (var i = 0; i < 4; i++)
                {
                    var candidate = ToUtc(Epoch.AddTicks((index + i) * step), zone);
                    if (candidate > afterUtc) return candidate;
                }
                return null;
            }
            case "times":
            {
                var times = Times(schedule);
                if (times.Count == 0 || schedule.Weekdays.Count == 0) return null;
                for (var day = 0; day <= 8; day++)
                {
                    var date = localAfter.Date.AddDays(day);
                    if (!schedule.Weekdays.Contains(IsoWeekday(date))) continue;
                    foreach (var time in times)
                    {
                        var candidate = ToUtc(date + time, zone);
                        if (candidate > afterUtc) return candidate;
                    }
                }
                return null;
            }
            default:
                return null;
        }
    }

    /// <summary>The latest planned run at or before <paramref name="atUtc"/> within the last 8 days, or null.</summary>
    public static DateTime? Previous(BackupScheduleSettings schedule, DateTime atUtc, TimeZoneInfo zone)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(atUtc, zone);
        switch (schedule.Kind)
        {
            case "interval":
            {
                var step = TimeSpan.FromHours(schedule.IntervalHours).Ticks;
                var index = FloorDiv((local - Epoch).Ticks, step);
                for (var i = 0; i < 4; i++)
                {
                    var candidate = ToUtc(Epoch.AddTicks((index - i) * step), zone);
                    if (candidate <= atUtc) return candidate;
                }
                return null;
            }
            case "times":
            {
                var times = Times(schedule);
                if (times.Count == 0 || schedule.Weekdays.Count == 0) return null;
                for (var day = 0; day <= 8; day++)
                {
                    var date = local.Date.AddDays(-day);
                    if (!schedule.Weekdays.Contains(IsoWeekday(date))) continue;
                    foreach (var time in times.AsEnumerable().Reverse())
                    {
                        var candidate = ToUtc(date + time, zone);
                        if (candidate <= atUtc) return candidate;
                    }
                }
                return null;
            }
            default:
                return null;
        }
    }

    /// <summary>
    /// Catch-up after a start: the planned run that was missed since the last scheduled backup, or null. Nothing is caught up on the very
    /// first start (no earlier scheduled backup is known) or when the switch is off.
    /// </summary>
    public static DateTime? MissedRun(BackupSettings settings, DateTime? lastScheduledUtc, DateTime nowUtc, TimeZoneInfo zone)
    {
        if (!settings.AutomaticEnabled || !settings.CatchUpMissed || lastScheduledUtc is null) return null;
        var previous = Previous(settings.Schedule, nowUtc, zone);
        return previous is { } p && p > lastScheduledUtc ? p : null;
    }

    private static List<TimeSpan> Times(BackupScheduleSettings schedule) =>
        schedule.Times.Select(ParseTime).OfType<TimeSpan>().Order().ToList();

    private static long FloorDiv(long value, long divisor) => value >= 0 ? value / divisor : -((-value + divisor - 1) / divisor);

    private static int IsoWeekday(DateTime date) => date.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)date.DayOfWeek;

    private static DateTime ToUtc(DateTime local, TimeZoneInfo zone)
    {
        var wall = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        if (zone.IsInvalidTime(wall)) wall = wall.AddHours(1);
        if (zone.IsAmbiguousTime(wall))
        {
            // First occurrence = the larger (daylight) offset
            var offset = zone.GetAmbiguousTimeOffsets(wall).Max();
            return DateTime.SpecifyKind(wall - offset, DateTimeKind.Utc);
        }
        return TimeZoneInfo.ConvertTimeToUtc(wall, zone);
    }
}

/// <summary>
/// Reads and writes <see cref="BackupSettings"/> (JSON in app_settings). The time of the last scheduled backup is kept in a small file in the
/// backup folder (<c>.last-scheduled</c>), not in the database: writing it there would itself count as a change of the content.
/// </summary>
public sealed class BackupSettingsStore(IServiceScopeFactory scopes, TimeProvider time, Configuration.ServerSettings settings)
{
    public const string SettingsKey = "backups";

    private string LastScheduledFile => Path.Combine(settings.BackupDirectory, ".last-scheduled");

    private BackupSettings? _cached;

    /// <summary>Raised after the settings changed (the scheduler re-plans).</summary>
    public event Action? Changed;

    public async Task<BackupSettings> GetAsync(CancellationToken ct = default)
    {
        if (_cached is { } cached) return cached;
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var row = await db.AppSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Key == SettingsKey, ct);
        BackupSettings value;
        try
        {
            value = row is null ? new BackupSettings() : JsonSerializer.Deserialize<BackupSettings>(row.Value, JsonSerializerOptions.Web) ?? new BackupSettings();
        }
        catch (JsonException)
        {
            value = new BackupSettings();
        }
        _cached = value;
        return value;
    }

    public async Task<BackupSettings> SaveAsync(BackupSettings value, CancellationToken ct)
    {
        value = value.Normalized();
        await WriteAsync(SettingsKey, JsonSerializer.Serialize(value, JsonSerializerOptions.Web), ct);
        _cached = value;
        Changed?.Invoke();
        return value;
    }

    public async Task<DateTime?> LastScheduledAsync(CancellationToken ct)
    {
        if (!File.Exists(LastScheduledFile)) return null;
        var text = (await File.ReadAllTextAsync(LastScheduledFile, ct)).Trim();
        return DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var at)
            ? at : null;
    }

    public async Task SetLastScheduledAsync(DateTime atUtc, CancellationToken ct)
    {
        Directory.CreateDirectory(settings.BackupDirectory);
        await File.WriteAllTextAsync(LastScheduledFile, atUtc.ToString("O", CultureInfo.InvariantCulture), ct);
    }

    /// <summary>Value comparison (the record's own equality compares the lists by reference).</summary>
    public static bool SameSettings(BackupSettings a, BackupSettings b) =>
        JsonSerializer.Serialize(a.Normalized(), JsonSerializerOptions.Web) == JsonSerializer.Serialize(b.Normalized(), JsonSerializerOptions.Web);

    /// <summary>After a restore the database holds other values.</summary>
    public void Invalidate()
    {
        _cached = null;
        Changed?.Invoke();
    }

    private async Task WriteAsync(string key, string value, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = time.GetUtcNow().UtcDateTime;
        var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == key, ct);
        if (row is null) db.AppSettings.Add(new AppSetting { Key = key, Value = value, UpdatedAt = now });
        else
        {
            row.Value = value;
            row.UpdatedAt = now;
        }
        await db.SaveChangesAsync(ct);
    }
}
