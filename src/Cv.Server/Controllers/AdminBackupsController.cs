using System.Globalization;
using System.Text;
using Cv.Server.Auth;
using Cv.Server.Backups;
using Cv.Server.Configuration;
using Cv.Server.Errors;
using Cv.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Cv.Server.Controllers;

/// <summary>
/// Backups for admins (desktop: the local owner): settings with schedule, list, backup now, download, upload and restore.
/// Download, upload and restore contain everyone's data, so in server mode they need the step-up check (password + 2FA code).
/// </summary>
[ApiController]
[Route("api/admin/backups")]
[Authorize(Policy = AuthConstants.AdminPolicy)]
public sealed class AdminBackupsController(
    BackupService backups,
    BackupSettingsStore store,
    ActivityLogger activity,
    ServerSettings settings,
    TimeProvider time,
    ILogger<AdminBackupsController> logger) : ControllerBase
{
    public const long MaxUploadBytes = 512L * 1024 * 1024;

    /// <summary>At most this many uploaded backups are kept (uploads are never pruned automatically; delete old ones first).</summary>
    public const int MaxUploadedBackups = 10;

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings(CancellationToken ct) => Ok(Describe(await store.GetAsync(ct)));

    [HttpPut("settings")]
    public async Task<IActionResult> PutSettings([FromBody] BackupSettings? body, CancellationToken ct)
    {
        BackupSettings.Validate(body);
        var before = await store.GetAsync(ct);
        var after = await store.SaveAsync(body!, ct);
        if (!BackupSettingsStore.SameSettings(before, after)) await activity.RecordNowAsync(HttpContext, "backup.settings_changed", null, new { before, after }, ct: ct);
        return Ok(Describe(after));
    }

    [HttpGet]
    public IReadOnlyList<BackupEntry> List() => backups.List();

    [HttpPost]
    public async Task<IActionResult> BackupNow(CancellationToken ct)
    {
        var result = await backups.RunAsync(BackupKinds.Manual, force: false, ct);
        if (result.Outcome == BackupOutcome.Unchanged)
        {
            throw ApiException.Conflict("backup.unchanged", "Nothing has changed since the last backup, so no new backup was made.");
        }
        var entry = Created(result);
        await activity.RecordNowAsync(HttpContext, "backup.created", entry.File, new { kind = entry.Kind, sizeBytes = entry.SizeBytes }, ct: ct);
        return StatusCode(StatusCodes.Status201Created, entry);
    }

    [HttpPost("current/download")]
    [EnableRateLimiting(RateLimitPolicies.StepUp)]
    public async Task<IActionResult> DownloadCurrent([FromBody] StepUpRequest? body, [FromServices] StepUp stepUp, CancellationToken ct)
    {
        await stepUp.VerifyAsync(HttpContext, body?.Password, body?.Code, "backup.download", ct);
        var result = await backups.RunAsync(BackupKinds.Manual, force: false, ct);
        // Unchanged: the newest backup already holds exactly the current state
        var entry = result.Outcome == BackupOutcome.Unchanged ? backups.Latest() ?? Created(await backups.RunAsync(BackupKinds.Manual, true, ct)) : Created(result);
        return await FileAsync(entry, ct);
    }

    [HttpPost("{id}/download")]
    [EnableRateLimiting(RateLimitPolicies.StepUp)]
    public async Task<IActionResult> Download(string id, [FromBody] StepUpRequest? body, [FromServices] StepUp stepUp, CancellationToken ct)
    {
        var entry = backups.Find(id) ?? throw ApiException.NotFound("backup.not_found", "This backup does not exist.");
        await stepUp.VerifyAsync(HttpContext, body?.Password, body?.Code, "backup.download", ct);
        return await FileAsync(entry, ct);
    }

    [HttpPost("upload")]
    [EnableRateLimiting(RateLimitPolicies.StepUp)]
    [RequestSizeLimit(MaxUploadBytes + 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    public async Task<IActionResult> Upload(IFormFile? file, [FromForm] string? password, [FromForm] string? code,
        [FromServices] StepUp stepUp, CancellationToken ct)
    {
        await stepUp.VerifyAsync(HttpContext, password, code, "backup.upload", ct);
        if (backups.List().Count(e => e.Tier == BackupService.TierUploaded) >= MaxUploadedBackups)
        {
            throw new ApiException(StatusCodes.Status409Conflict, "backup.upload_limit",
                $"There are already {MaxUploadedBackups} uploaded backups. Delete one before uploading another.",
                new Dictionary<string, object?> { ["max"] = MaxUploadedBackups });
        }
        if (file is null || file.Length == 0) throw ApiException.Field("file", "validation.required", "Choose a backup file to upload.");
        if (file.Length > MaxUploadBytes)
        {
            throw ApiException.Field("file", "validation.file_too_large", "The file is larger than 512 MB.", StatusCodes.Status413PayloadTooLarge);
        }

        var incoming = Path.Combine(backups.Root, "incoming");
        Directory.CreateDirectory(incoming);
        var temp = Path.Combine(incoming, $"upload-{Guid.NewGuid():N}.db");
        try
        {
            await using (var target = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                await file.CopyToAsync(target, ct);
            }
            var (check, entry, detail) = await backups.StoreUploadAsync(temp, KnownMigrations.All, ct);
            RestoreService.ThrowIfUnusable(check, detail, logger);
            await activity.RecordNowAsync(HttpContext, "backup.uploaded", entry!.File,
                new { originalName = Truncate(file.FileName, 128), sizeBytes = entry.SizeBytes }, ct: ct);
            return StatusCode(StatusCodes.Status201Created, entry);
        }
        finally
        {
            BackupService.TryDelete(temp);
        }
    }

    /// <summary>Deletes one backup file (step-up like a restore). Refused while a backup or restore is running.</summary>
    [HttpDelete("{id}")]
    [EnableRateLimiting(RateLimitPolicies.StepUp)]
    public async Task<IActionResult> Delete(string id, [FromBody] StepUpRequest? body, [FromServices] StepUp stepUp, CancellationToken ct)
    {
        var entry = backups.Find(id) ?? throw ApiException.NotFound("backup.not_found", "This backup does not exist.");
        await stepUp.VerifyAsync(HttpContext, body?.Password, body?.Code, "backup.delete", ct);
        if (!await backups.TryDeleteAsync(entry))
        {
            throw ApiException.Conflict("backup.busy", "A backup or a restore is running right now. Please try again in a moment.");
        }
        await activity.RecordNowAsync(HttpContext, "backup.deleted", entry.File, new { backup = entry.Id, kind = entry.Kind, tier = entry.Tier }, ct: ct);
        return NoContent();
    }

    [HttpPost("{id}/restore")]
    [EnableRateLimiting(RateLimitPolicies.StepUp)]
    public async Task<IActionResult> Restore(string id, [FromBody] StepUpRequest? body, [FromServices] StepUp stepUp,
        [FromServices] RestoreService restore, CancellationToken ct)
    {
        var entry = backups.Find(id) ?? throw ApiException.NotFound("backup.not_found", "This backup does not exist.");
        await stepUp.VerifyAsync(HttpContext, body?.Password, body?.Code, "backup.restore", ct);
        await restore.RestoreAsync(entry, HttpContext, ct);
        if (!settings.IsDesktop) SessionService.ClearCookies(HttpContext);
        return Ok(new { restored = true });
    }

    private object Describe(BackupSettings value)
    {
        var now = time.GetUtcNow().UtcDateTime;
        var runs = BackupSchedule.NextRuns(value, now, time.LocalTimeZone, TimeSpan.FromDays(7));
        return new
        {
            value.AutomaticEnabled,
            value.OnStart,
            value.BeforeShutdown,
            value.Schedule,
            value.CatchUpMissed,
            value.KeepRecent,
            value.KeepDailyDays,
            nextRuns = runs,
            timeZone = time.LocalTimeZone.Id,
            directory = settings.BackupDirectory,
        };
    }

    private static BackupEntry Created(BackupResult result) =>
        result.Outcome == BackupOutcome.Created && result.Entry is not null
            ? result.Entry
            : throw new ApiException(StatusCodes.Status500InternalServerError, "backup.failed",
                "The backup could not be created. The server log has the details.");

    private async Task<IActionResult> FileAsync(BackupEntry entry, CancellationToken ct)
    {
        await activity.RecordNowAsync(HttpContext, "backup.downloaded", entry.File, new { backup = entry.Id }, ct: ct);
        var local = TimeZoneInfo.ConvertTimeFromUtc(entry.CreatedAt, time.LocalTimeZone);
        var name = $"{Slug(Branding.ProductName)}-backup-{local.ToString("yyyy-MM-dd-HHmm", CultureInfo.InvariantCulture)}.db";
        return PhysicalFile(entry.FullPath, "application/vnd.sqlite3", name);
    }

    private static string Slug(string name)
    {
        var builder = new StringBuilder();
        foreach (var c in name.ToLowerInvariant()) if (char.IsAsciiLetterOrDigit(c)) builder.Append(c);
        return builder.Length == 0 ? "app" : builder.ToString();
    }

    private static string? Truncate(string? value, int max) => value is null || value.Length <= max ? value : value[..max];
}
