using System.Text.Json;
using Cv.Server.Auth;
using Cv.Server.Data;

namespace Cv.Server.Services;

/// <summary>
/// Writes the append-only activity log. <see cref="Record"/> adds the entry to the current unit of work (saved together with the change
/// it describes); <see cref="RecordNowAsync"/> saves at once (e.g. a failed sign-in, where nothing else is saved).
/// Details are a small JSON object - never passwords, codes, tokens or other secrets.
/// </summary>
public sealed class ActivityLogger(AppDbContext db, TimeProvider time)
{
    public void Record(HttpContext context, string action, string? target, object? details = null, Guid? actorId = null, string? actorName = null)
    {
        db.ActivityLog.Add(new ActivityEntry
        {
            At = time.GetUtcNow().UtcDateTime,
            ActorId = actorId ?? context.User.UserId(),
            ActorName = Truncate(actorName ?? context.User.Username(), 64),
            Action = action,
            Target = Truncate(target, 256),
            Ip = ClientInfo.Ip(context),
            Details = details is null ? null : JsonSerializer.Serialize(details, JsonSerializerOptions.Web),
        });
    }

    public async Task RecordNowAsync(HttpContext context, string action, string? target, object? details = null,
        Guid? actorId = null, string? actorName = null, CancellationToken ct = default)
    {
        Record(context, action, target, details, actorId, actorName);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Background work without a request (backups).</summary>
    public async Task RecordSystemAsync(string action, string? target, object? details, CancellationToken ct)
    {
        db.ActivityLog.Add(new ActivityEntry
        {
            At = time.GetUtcNow().UtcDateTime,
            Action = action,
            Target = Truncate(target, 256),
            Details = details is null ? null : JsonSerializer.Serialize(details, JsonSerializerOptions.Web),
        });
        await db.SaveChangesAsync(ct);
    }

    private static string? Truncate(string? value, int max) => value is null || value.Length <= max ? value : value[..max];
}
