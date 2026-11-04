using Cv.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Services;

/// <summary>The instance settings an admin changes in the UI (stored in the database, not in configuration files).</summary>
public sealed record InstanceSettings(bool RegistrationOpen, bool RequireTwoFactor);

/// <summary>
/// Reads and writes <see cref="InstanceSettings"/>. Cached in memory (every authenticated request needs <c>requireTwoFactor</c>);
/// one server process owns the database, so invalidating on write is enough.
/// </summary>
public sealed class SettingsService(IServiceScopeFactory scopes, TimeProvider time)
{
    public const string RegistrationOpenKey = "registrationOpen";
    public const string RequireTwoFactorKey = "requireTwoFactor";

    private readonly SemaphoreSlim _gate = new(1, 1);
    private InstanceSettings? _cached;

    public async Task<InstanceSettings> GetAsync(CancellationToken ct = default)
    {
        if (_cached is { } cached) return cached;
        await _gate.WaitAsync(ct);
        try
        {
            if (_cached is { } again) return again;
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var rows = await db.AppSettings.AsNoTracking().ToDictionaryAsync(s => s.Key, s => s.Value, ct);
            _cached = new InstanceSettings(Flag(rows, RegistrationOpenKey), Flag(rows, RequireTwoFactorKey));
            return _cached;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<InstanceSettings> SaveAsync(AppDbContext db, InstanceSettings value, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            var now = time.GetUtcNow().UtcDateTime;
            await Upsert(db, RegistrationOpenKey, value.RegistrationOpen, now, ct);
            await Upsert(db, RequireTwoFactorKey, value.RequireTwoFactor, now, ct);
            await db.SaveChangesAsync(ct);
            _cached = value;
            return value;
        }
        finally
        {
            _gate.Release();
        }
    }

    /// <summary>After a restore the database holds other values.</summary>
    public void Invalidate() => _cached = null;

    private static async Task Upsert(AppDbContext db, string key, bool value, DateTime now, CancellationToken ct)
    {
        var text = value ? "true" : "false";
        var row = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == key, ct);
        if (row is null) db.AppSettings.Add(new AppSetting { Key = key, Value = text, UpdatedAt = now });
        else if (row.Value != text)
        {
            row.Value = text;
            row.UpdatedAt = now;
        }
    }

    private static bool Flag(Dictionary<string, string> rows, string key) =>
        rows.TryGetValue(key, out var value) && string.Equals(value, "true", StringComparison.OrdinalIgnoreCase);
}
