using System.Text.Json;
using Cv.Server.Auth;
using Cv.Server.Data;
using Cv.Server.Errors;
using Cv.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Controllers;

/// <summary>Instance settings and activity log (admins only); backups are in <see cref="AdminBackupsController"/>.</summary>
[ApiController]
[Route("api/admin")]
[Authorize(Policy = AuthConstants.AdminPolicy)]
public sealed class AdminController(AppDbContext db, ActivityLogger activity, SettingsService instanceSettings) : ControllerBase
{
    public const int MaxPageSize = 200;

    [HttpGet("settings")]
    public async Task<InstanceSettings> GetSettings(CancellationToken ct) => await instanceSettings.GetAsync(ct);

    [HttpPut("settings")]
    public async Task<InstanceSettings> PutSettings([FromBody] SettingsRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        if (body.RegistrationOpen is null) errors.Add("registrationOpen", "validation.required");
        if (body.RequireTwoFactor is null) errors.Add("requireTwoFactor", "validation.required");
        errors.ThrowIfAny();

        var before = await instanceSettings.GetAsync(ct);
        var after = new InstanceSettings(body.RegistrationOpen!.Value, body.RequireTwoFactor!.Value);
        if (before != after)
        {
            activity.Record(HttpContext, "settings.changed", null, new { before, after });
        }
        return await instanceSettings.SaveAsync(db, after, ct);
    }

    [HttpGet("activity")]
    [ServerModeOnly]
    public async Task<IActionResult> Activity([FromQuery] int? page, [FromQuery] int? pageSize, [FromQuery] string? action,
        [FromQuery] Guid? userId, CancellationToken ct)
    {
        var errors = new FieldErrors();
        if (page is < 1) errors.Add("page", "validation.min_value", new() { ["min"] = 1 });
        if (pageSize is < 1 or > MaxPageSize) errors.Add("pageSize", "validation.range", new() { ["min"] = 1, ["max"] = MaxPageSize });
        if (action is { Length: > 64 }) errors.Add("action", "validation.max_length", new() { ["max"] = 64, ["actual"] = action.Length });
        errors.ThrowIfAny();

        var size = pageSize ?? 50;
        var number = page ?? 1;
        var query = db.ActivityLog.AsNoTracking();
        if (!string.IsNullOrEmpty(action)) query = query.Where(e => e.Action == action);
        if (userId is { } uid) query = query.Where(e => e.ActorId == uid);
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(e => e.At).ThenByDescending(e => e.Id)
            .Skip((number - 1) * size).Take(size).ToListAsync(ct);
        var items = rows.Select(e => new
        {
            id = e.Id,
            at = e.At,
            actorId = e.ActorId,
            actorName = e.ActorName,
            action = e.Action,
            target = e.Target,
            ip = e.Ip,
            details = ParseDetails(e.Details),
        });
        return Ok(new { items, total });
    }

    private static JsonElement? ParseDetails(string? json)
    {
        if (string.IsNullOrEmpty(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
