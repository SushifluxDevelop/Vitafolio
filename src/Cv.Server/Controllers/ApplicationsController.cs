// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using Cv.Server.Auth;
using Cv.Server.Configuration;
using Cv.Server.Data;
using Cv.Server.Errors;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Controllers;

/// <summary>
/// Job application tracking and portfolio dossier management.
/// Scoped to the authenticated user.
/// </summary>
[ApiController]
[Route("api/applications")]
[Authorize]
public sealed class ApplicationsController(
    AppDbContext db,
    ServerSettings settings,
    TimeProvider time,
    Documents.TypstRenderer renderer) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ApplicationListItemDto>>> List(
        [FromQuery] string? status,
        [FromQuery] string? search,
        CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var now = time.GetUtcNow().UtcDateTime;

        var query = db.Applications
            .Include(a => a.CoverLetter)
            .Where(a => a.UserId == userId);

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();
            query = query.Where(a => a.Status == normalizedStatus);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(a =>
                a.JobTitle.Contains(term) ||
                a.Company.Contains(term) ||
                (a.Location != null && a.Location.Contains(term)));
        }

        var apps = await query
            .OrderByDescending(a => a.UpdatedAt)
            .ToListAsync(ct);

        return Ok(apps.Select(a => ApplicationListItemDto.From(a, now)).ToList());
    }

    [HttpGet("stats")]
    public async Task<ActionResult<ApplicationStatsDto>> GetStats(CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var now = time.GetUtcNow().UtcDateTime;

        var apps = await db.Applications
            .Where(a => a.UserId == userId)
            .Select(a => new { a.Status, a.AppliedAt, a.FollowUpAt })
            .ToListAsync(ct);

        int total = apps.Count;
        int draft = apps.Count(a => a.Status == ApplicationStatuses.Draft);
        int applied = apps.Count(a => a.Status == ApplicationStatuses.Applied);
        int acknowledged = apps.Count(a => a.Status == ApplicationStatuses.Acknowledged);
        int interview = apps.Count(a => a.Status == ApplicationStatuses.Interview);
        int offer = apps.Count(a => a.Status == ApplicationStatuses.Offer);
        int rejected = apps.Count(a => a.Status == ApplicationStatuses.Rejected);
        int withdrawn = apps.Count(a => a.Status == ApplicationStatuses.Withdrawn);

        int due = apps.Count(a => a.Status == ApplicationStatuses.Applied &&
            ((a.FollowUpAt.HasValue && a.FollowUpAt.Value <= now)
             || (!a.FollowUpAt.HasValue && a.AppliedAt.HasValue && a.AppliedAt.Value.AddDays(14) <= now)));

        return Ok(new ApplicationStatsDto(
            total,
            draft,
            applied,
            acknowledged,
            interview,
            offer,
            rejected,
            withdrawn,
            due));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApplicationDto>> Get(Guid id, CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var now = time.GetUtcNow().UtcDateTime;

        var app = await db.Applications
            .Include(a => a.CoverLetter)
            .Include(a => a.Events)
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId, ct);

        if (app is null) return NotFound();

        return Ok(ApplicationDto.From(app, now));
    }

    [HttpPost]
    public async Task<ActionResult<ApplicationDto>> Create([FromBody] ApplicationRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        ValidateApplicationBody(errors, body);
        errors.ThrowIfAny();

        var userId = User.RequiredUserId();
        var now = time.GetUtcNow().UtcDateTime;

        if (body.CoverLetterId.HasValue)
        {
            var letterExists = await db.CoverLetters.AnyAsync(c => c.Id == body.CoverLetterId.Value && c.UserId == userId, ct);
            if (!letterExists)
            {
                throw new ApiException(StatusCodes.Status400BadRequest, "coverLetter.not_found", "The specified cover letter does not exist.");
            }
        }

        var status = !string.IsNullOrWhiteSpace(body.Status) && ApplicationStatuses.All.Contains(body.Status.Trim().ToLowerInvariant())
            ? body.Status.Trim().ToLowerInvariant()
            : ApplicationStatuses.Draft;

        DateTime? appliedAt = body.AppliedAt;
        if (status == ApplicationStatuses.Applied && !appliedAt.HasValue)
        {
            appliedAt = now;
        }

        var app = new JobApplication
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            JobTitle = body.JobTitle!.Trim(),
            Company = body.Company!.Trim(),
            Location = body.Location?.Trim(),
            ContactPerson = body.ContactPerson?.Trim(),
            ContactEmail = body.ContactEmail?.Trim(),
            ContactPhone = body.ContactPhone?.Trim(),
            JobPostingUrl = body.JobPostingUrl?.Trim(),
            JobDescription = body.JobDescription?.Trim(),
            SalaryExpectation = body.SalaryExpectation?.Trim(),
            Status = status,
            AppliedAt = appliedAt,
            FollowUpAt = body.FollowUpAt,
            CoverLetterId = body.CoverLetterId,
            CvDesign = body.CvDesign?.Trim().ToLowerInvariant() ?? "classic",
            CvAccentColor = body.CvAccentColor?.Trim() ?? "#14213D",
            CvFont = body.CvFont?.Trim() ?? "Liberation Sans",
            CvLanguage = body.CvLanguage?.Trim().ToLowerInvariant() ?? "de",
            CvShowPhoto = body.CvShowPhoto ?? true,
            CvPhotoShape = body.CvPhotoShape?.Trim().ToLowerInvariant() ?? "rounded",
            IncludeCoverSheet = body.IncludeCoverSheet ?? true,
            AttachmentIds = body.AttachmentIds != null && body.AttachmentIds.Count > 0 ? string.Join(",", body.AttachmentIds) : null,
            Notes = body.Notes?.Trim(),
            CreatedAt = now,
            UpdatedAt = now
        };

        var initialEvent = new ApplicationEvent
        {
            Id = Guid.NewGuid(),
            ApplicationId = app.Id,
            Status = status,
            Date = appliedAt ?? now,
            Title = status == ApplicationStatuses.Applied ? "Bewerbung eingereicht" : "Bewerbung angelegt",
            Note = null,
            CreatedAt = now
        };
        db.ApplicationEvents.Add(initialEvent);

        db.Applications.Add(app);
        await db.SaveChangesAsync(ct);

        if (status == ApplicationStatuses.Applied)
        {
            await ArchiveDossierSnapshotAsync(app, userId, ct);
            await db.SaveChangesAsync(ct);
        }

        return CreatedAtAction(nameof(Get), new { id = app.Id }, ApplicationDto.From(app, now));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApplicationDto>> Update(Guid id, [FromBody] ApplicationRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        ValidateApplicationBody(errors, body);
        errors.ThrowIfAny();

        var userId = User.RequiredUserId();
        var now = time.GetUtcNow().UtcDateTime;

        var app = await db.Applications
            .Include(a => a.CoverLetter)
            .Include(a => a.Events)
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId, ct);

        if (app is null) return NotFound();

        if (body.CoverLetterId.HasValue && body.CoverLetterId.Value != app.CoverLetterId)
        {
            var letterExists = await db.CoverLetters.AnyAsync(c => c.Id == body.CoverLetterId.Value && c.UserId == userId, ct);
            if (!letterExists)
            {
                throw new ApiException(StatusCodes.Status400BadRequest, "coverLetter.not_found", "The specified cover letter does not exist.");
            }
        }

        var oldStatus = app.Status;
        var newStatus = !string.IsNullOrWhiteSpace(body.Status) && ApplicationStatuses.All.Contains(body.Status.Trim().ToLowerInvariant())
            ? body.Status.Trim().ToLowerInvariant()
            : app.Status;

        app.JobTitle = body.JobTitle!.Trim();
        app.Company = body.Company!.Trim();
        app.Location = body.Location?.Trim();
        app.ContactPerson = body.ContactPerson?.Trim();
        app.ContactEmail = body.ContactEmail?.Trim();
        app.ContactPhone = body.ContactPhone?.Trim();
        app.JobPostingUrl = body.JobPostingUrl?.Trim();
        app.JobDescription = body.JobDescription?.Trim();
        app.SalaryExpectation = body.SalaryExpectation?.Trim();
        app.FollowUpAt = body.FollowUpAt;
        app.CoverLetterId = body.CoverLetterId;
        app.CvDesign = body.CvDesign?.Trim().ToLowerInvariant() ?? app.CvDesign;
        app.CvAccentColor = body.CvAccentColor?.Trim() ?? app.CvAccentColor;
        app.CvFont = body.CvFont?.Trim() ?? app.CvFont;
        app.CvLanguage = body.CvLanguage?.Trim().ToLowerInvariant() ?? app.CvLanguage;
        app.CvShowPhoto = body.CvShowPhoto ?? app.CvShowPhoto;
        app.CvPhotoShape = body.CvPhotoShape?.Trim().ToLowerInvariant() ?? app.CvPhotoShape;
        app.IncludeCoverSheet = body.IncludeCoverSheet ?? app.IncludeCoverSheet;
        if (body.AttachmentIds is not null)
        {
            app.AttachmentIds = body.AttachmentIds.Count > 0 ? string.Join(",", body.AttachmentIds) : null;
        }
        app.Notes = body.Notes?.Trim();
        app.UpdatedAt = now;

        if (body.AppliedAt.HasValue)
        {
            app.AppliedAt = body.AppliedAt.Value;
        }

        if (newStatus != oldStatus)
        {
            app.Status = newStatus;
            if (newStatus == ApplicationStatuses.Applied && !app.AppliedAt.HasValue)
            {
                app.AppliedAt = now;
            }

            var statusEvent = new ApplicationEvent
            {
                Id = Guid.NewGuid(),
                ApplicationId = app.Id,
                Status = newStatus,
                Date = now,
                Title = GetDefaultEventTitle(newStatus),
                Note = null,
                CreatedAt = now
            };
            db.ApplicationEvents.Add(statusEvent);

            if (newStatus == ApplicationStatuses.Applied && string.IsNullOrEmpty(app.ArchivedPdfPath))
            {
                await ArchiveDossierSnapshotAsync(app, userId, ct);
            }
        }

        await db.SaveChangesAsync(ct);
        return Ok(ApplicationDto.From(app, now));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = User.RequiredUserId();

        var app = await db.Applications
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId, ct);

        if (app is null) return NotFound();

        if (!string.IsNullOrEmpty(app.ArchivedPdfPath))
        {
            var fullPath = Path.Combine(settings.DataDirectory, app.ArchivedPdfPath);
            if (System.IO.File.Exists(fullPath))
            {
                try { System.IO.File.Delete(fullPath); } catch { /* best effort */ }
            }
        }

        db.Applications.Remove(app);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPost("{id:guid}/status")]
    public async Task<ActionResult<ApplicationDto>> UpdateStatus(
        Guid id,
        [FromBody] ApplicationStatusUpdateRequest body,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(body.Status) || !ApplicationStatuses.All.Contains(body.Status.Trim().ToLowerInvariant()))
        {
            throw new ApiException(StatusCodes.Status400BadRequest, "status.invalid", "Invalid application status.");
        }

        var userId = User.RequiredUserId();
        var now = time.GetUtcNow().UtcDateTime;

        var app = await db.Applications
            .Include(a => a.CoverLetter)
            .Include(a => a.Events)
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId, ct);

        if (app is null) return NotFound();

        var newStatus = body.Status.Trim().ToLowerInvariant();
        var eventDate = body.Date ?? now;

        app.Status = newStatus;
        app.UpdatedAt = now;

        if (newStatus == ApplicationStatuses.Applied && !app.AppliedAt.HasValue)
        {
            app.AppliedAt = eventDate;
        }

        var ev = new ApplicationEvent
        {
            Id = Guid.NewGuid(),
            ApplicationId = app.Id,
            Status = newStatus,
            Date = eventDate,
            Title = GetDefaultEventTitle(newStatus),
            Note = body.Note?.Trim(),
            CreatedAt = now
        };
        db.ApplicationEvents.Add(ev);

        if (newStatus == ApplicationStatuses.Applied && string.IsNullOrEmpty(app.ArchivedPdfPath))
        {
            await ArchiveDossierSnapshotAsync(app, userId, ct);
        }

        await db.SaveChangesAsync(ct);
        return Ok(ApplicationDto.From(app, now));
    }

    [HttpPost("{id:guid}/events")]
    public async Task<ActionResult<ApplicationEventDto>> AddEvent(
        Guid id,
        [FromBody] ApplicationEventRequest body,
        CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "title", body.Title, 128);
        InputRules.Optional(errors, "note", body.Note, 2048);
        InputRules.Optional(errors, "status", body.Status, 32);
        errors.ThrowIfAny();

        var userId = User.RequiredUserId();
        var now = time.GetUtcNow().UtcDateTime;

        var app = await db.Applications
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId, ct);

        if (app is null) return NotFound();

        var status = !string.IsNullOrWhiteSpace(body.Status) && ApplicationStatuses.All.Contains(body.Status.Trim().ToLowerInvariant())
            ? body.Status.Trim().ToLowerInvariant()
            : app.Status;

        var ev = new ApplicationEvent
        {
            Id = Guid.NewGuid(),
            ApplicationId = app.Id,
            Status = status,
            Date = body.Date ?? now,
            Title = body.Title!.Trim(),
            Note = body.Note?.Trim(),
            CreatedAt = now
        };

        db.ApplicationEvents.Add(ev);
        app.UpdatedAt = now;
        await db.SaveChangesAsync(ct);

        return Ok(ApplicationEventDto.From(ev));
    }

    [HttpDelete("{id:guid}/events/{eventId:guid}")]
    public async Task<IActionResult> DeleteEvent(Guid id, Guid eventId, CancellationToken ct)
    {
        var userId = User.RequiredUserId();

        var ev = await db.ApplicationEvents
            .Include(e => e.Application)
            .FirstOrDefaultAsync(e => e.Id == eventId && e.ApplicationId == id && e.Application != null && e.Application.UserId == userId, ct);

        if (ev is null) return NotFound();

        db.ApplicationEvents.Remove(ev);
        if (ev.Application != null)
        {
            ev.Application.UpdatedAt = time.GetUtcNow().UtcDateTime;
        }
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpGet("{id:guid}/dossier/preview")]
    public async Task<IActionResult> PreviewDossier(Guid id, CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var app = await db.Applications
            .Include(a => a.CoverLetter)
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId, ct);

        if (app is null) return NotFound();

        var pdfBytes = await RenderDossierBytesAsync(app, userId, ct);
        return File(pdfBytes, "application/pdf");
    }

    [HttpGet("{id:guid}/dossier/download")]
    public async Task<IActionResult> DownloadDossier(Guid id, CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var app = await db.Applications
            .Include(a => a.CoverLetter)
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId, ct);

        if (app is null) return NotFound();

        byte[] pdfBytes;
        if (!string.IsNullOrEmpty(app.ArchivedPdfPath))
        {
            var fullPath = Path.Combine(settings.DataDirectory, app.ArchivedPdfPath);
            if (System.IO.File.Exists(fullPath))
            {
                pdfBytes = await System.IO.File.ReadAllBytesAsync(fullPath, ct);
            }
            else
            {
                pdfBytes = await RenderDossierBytesAsync(app, userId, ct);
            }
        }
        else
        {
            pdfBytes = await RenderDossierBytesAsync(app, userId, ct);
        }

        var company = SanitizeFilename(app.Company);
        var job = SanitizeFilename(app.JobTitle);
        var prefix = app.CvLanguage == "en" ? "Application" : "Bewerbung";
        var filename = (!string.IsNullOrEmpty(company) || !string.IsNullOrEmpty(job))
            ? $"{prefix}_{company}_{job}.pdf"
            : $"{prefix}.pdf";

        return File(pdfBytes, "application/pdf", filename);
    }

    [HttpPost("{id:guid}/dossier/archive")]
    public async Task<ActionResult<ApplicationDto>> ArchiveDossierSnapshot(Guid id, CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var now = time.GetUtcNow().UtcDateTime;

        var app = await db.Applications
            .Include(a => a.CoverLetter)
            .Include(a => a.Events)
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId, ct);

        if (app is null) return NotFound();

        await ArchiveDossierSnapshotAsync(app, userId, ct);
        app.UpdatedAt = now;
        await db.SaveChangesAsync(ct);

        return Ok(ApplicationDto.From(app, now));
    }

    private async Task<string?> ArchiveDossierSnapshotAsync(JobApplication app, Guid userId, CancellationToken ct)
    {
        try
        {
            var pdfBytes = await RenderDossierBytesAsync(app, userId, ct);

            var appsDir = Path.Combine(settings.DataDirectory, "applications");
            Directory.CreateDirectory(appsDir);

            var fileName = $"{userId}_{app.Id}.pdf";
            var fullPath = Path.Combine(appsDir, fileName);
            await System.IO.File.WriteAllBytesAsync(fullPath, pdfBytes, ct);

            var relativePath = Path.Combine("applications", fileName).Replace('\\', '/');
            app.ArchivedPdfPath = relativePath;
            return relativePath;
        }
        catch (Exception)
        {
            // Dossier snapshot archiving is best-effort and non-blocking
            return null;
        }
    }

    private async Task<byte[]> RenderDossierBytesAsync(JobApplication app, Guid userId, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(userId, ct);

        CoverLetter? coverLetter = null;
        if (app.CoverLetterId.HasValue)
        {
            coverLetter = await db.CoverLetters
                .FirstOrDefaultAsync(c => c.Id == app.CoverLetterId.Value && c.UserId == userId, ct);
        }

        var photoPath = !string.IsNullOrEmpty(profile.PhotoPath)
            ? Path.Combine(settings.DataDirectory, profile.PhotoPath)
            : null;

        var sigPath = coverLetter?.SignaturePath;

        List<Documents.DossierAttachmentItem>? attachmentItems = null;
        if (!string.IsNullOrWhiteSpace(app.AttachmentIds))
        {
            var requestedGuids = app.AttachmentIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => Guid.TryParse(s, out var g) ? g : Guid.Empty)
                .Where(g => g != Guid.Empty)
                .ToList();

            if (requestedGuids.Count > 0)
            {
                var attachments = await db.Attachments
                    .Where(a => a.UserId == userId && requestedGuids.Contains(a.Id))
                    .ToListAsync(ct);

                var ordered = requestedGuids
                    .Select(gid => attachments.FirstOrDefault(a => a.Id == gid))
                    .Where(a => a != null)
                    .Cast<Attachment>()
                    .ToList();

                attachmentItems = ordered.Select(a => new Documents.DossierAttachmentItem(
                    Title: a.Title,
                    FilePath: a.StoragePath,
                    ContentType: a.ContentType)).ToList();
            }
        }

        var options = new Documents.DossierRenderOptions(
            Design: app.CvDesign,
            AccentColor: app.CvAccentColor,
            Font: app.CvFont,
            ShowPhoto: app.CvShowPhoto,
            PhotoShape: app.CvPhotoShape,
            Language: app.CvLanguage,
            IncludeCoverSheet: app.IncludeCoverSheet,
            TargetJob: app.JobTitle,
            TargetCompany: app.Company,
            Contents: null,
            Attachments: attachmentItems);

        return renderer.RenderDossierPdf(
            ProfileResponse.From(profile),
            coverLetter != null ? CoverLetterDto.From(coverLetter) : null,
            options,
            photoPath,
            sigPath,
            dataDirectory: settings.DataDirectory);
    }

    private async Task<UserProfile> GetOrCreateProfileAsync(Guid userId, CancellationToken ct)
    {
        var profile = await db.Profiles
            .Include(p => p.Experiences)
            .Include(p => p.Educations)
            .Include(p => p.Skills)
            .Include(p => p.Languages)
            .Include(p => p.Certificates)
            .Include(p => p.Interests)
            .Include(p => p.CustomSections)
                .ThenInclude(cs => cs.Items)
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);

        if (profile is not null) return profile;

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new ApiException(StatusCodes.Status401Unauthorized, "auth.invalid", "The account no longer exists.");

        var words = user.DisplayName.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
        var firstName = words.Length > 0 ? words[0] : "";
        var lastName = words.Length > 1 ? string.Join(" ", words.Skip(1)) : "";

        return new UserProfile
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            FirstName = firstName,
            LastName = lastName,
            CreatedAt = time.GetUtcNow().UtcDateTime,
            UpdatedAt = time.GetUtcNow().UtcDateTime
        };
    }

    private static void ValidateApplicationBody(FieldErrors errors, ApplicationRequest body)
    {
        InputRules.Required(errors, "jobTitle", body.JobTitle, 128);
        InputRules.Required(errors, "company", body.Company, 128);
        InputRules.Optional(errors, "location", body.Location, 128);
        InputRules.Optional(errors, "contactPerson", body.ContactPerson, 128);
        InputRules.Optional(errors, "contactEmail", body.ContactEmail, 128);
        InputRules.Optional(errors, "contactPhone", body.ContactPhone, 64);
        InputRules.Optional(errors, "jobPostingUrl", body.JobPostingUrl, 1024);
        InputRules.Optional(errors, "salaryExpectation", body.SalaryExpectation, 64);
        InputRules.Optional(errors, "status", body.Status, 32);
        InputRules.Optional(errors, "cvDesign", body.CvDesign, 32);
        InputRules.Optional(errors, "cvAccentColor", body.CvAccentColor, 32);
        InputRules.Optional(errors, "cvFont", body.CvFont, 64);
        InputRules.Optional(errors, "cvLanguage", body.CvLanguage, 16);
        InputRules.Optional(errors, "cvPhotoShape", body.CvPhotoShape, 32);
        InputRules.Optional(errors, "notes", body.Notes, 16384);
    }

    private static string GetDefaultEventTitle(string status) => status switch
    {
        ApplicationStatuses.Draft => "Entwurf gespeichert",
        ApplicationStatuses.Applied => "Bewerbung eingereicht",
        ApplicationStatuses.Acknowledged => "Eingangsbestätigung erhalten",
        ApplicationStatuses.Interview => "Vorstellungsgespräch",
        ApplicationStatuses.Offer => "Angebot erhalten",
        ApplicationStatuses.Rejected => "Absage erhalten",
        ApplicationStatuses.Withdrawn => "Bewerbung zurückgezogen",
        _ => "Status geändert"
    };

    private static string SanitizeFilename(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var safe = new string(input.Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_').ToArray());
        return safe.Trim();
    }
}
