// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using Cv.Server.Data;

namespace Cv.Server.Controllers;

public sealed record ApplicationRequest(
    string? JobTitle,
    string? Company,
    string? Location,
    string? ContactPerson,
    string? ContactEmail,
    string? ContactPhone,
    string? JobPostingUrl,
    string? JobDescription,
    string? SalaryExpectation,
    string? Status,
    DateTime? AppliedAt,
    DateTime? FollowUpAt,
    Guid? CoverLetterId,
    string? CvDesign,
    string? CvAccentColor,
    string? CvFont,
    string? CvLanguage,
    bool? CvShowPhoto,
    string? CvPhotoShape,
    bool? IncludeCoverSheet,
    IReadOnlyList<Guid>? AttachmentIds,
    string? Notes);

public sealed record ApplicationStatusUpdateRequest(
    string? Status,
    DateTime? Date,
    string? Note);

public sealed record ApplicationEventRequest(
    DateTime? Date,
    string? Status,
    string? Title,
    string? Note);

public sealed record ApplicationEventDto(
    Guid Id,
    Guid ApplicationId,
    string Status,
    DateTime Date,
    string? Title,
    string? Note,
    DateTime CreatedAt)
{
    public static ApplicationEventDto From(ApplicationEvent ev) =>
        new(ev.Id, ev.ApplicationId, ev.Status, ev.Date, ev.Title, ev.Note, ev.CreatedAt);
}

public sealed record ApplicationListItemDto(
    Guid Id,
    string JobTitle,
    string Company,
    string? Location,
    string Status,
    DateTime? AppliedAt,
    DateTime? FollowUpAt,
    bool IsFollowUpDue,
    string? CoverLetterTitle,
    bool HasArchivedPdf,
    DateTime UpdatedAt)
{
    public static ApplicationListItemDto From(JobApplication a, DateTime utcNow)
    {
        var isDue = a.Status == ApplicationStatuses.Applied
            && ((a.FollowUpAt.HasValue && a.FollowUpAt.Value <= utcNow)
                || (!a.FollowUpAt.HasValue && a.AppliedAt.HasValue && a.AppliedAt.Value.AddDays(14) <= utcNow));

        return new(
            a.Id,
            a.JobTitle,
            a.Company,
            a.Location,
            a.Status,
            a.AppliedAt,
            a.FollowUpAt,
            isDue,
            a.CoverLetter?.Title,
            !string.IsNullOrEmpty(a.ArchivedPdfPath),
            a.UpdatedAt);
    }
}

public sealed record ApplicationDto(
    Guid Id,
    string JobTitle,
    string Company,
    string? Location,
    string? ContactPerson,
    string? ContactEmail,
    string? ContactPhone,
    string? JobPostingUrl,
    string? JobDescription,
    string? SalaryExpectation,
    string Status,
    DateTime? AppliedAt,
    DateTime? FollowUpAt,
    bool IsFollowUpDue,
    Guid? CoverLetterId,
    string? CoverLetterTitle,
    string CvDesign,
    string? CvAccentColor,
    string? CvFont,
    string CvLanguage,
    bool CvShowPhoto,
    string CvPhotoShape,
    bool IncludeCoverSheet,
    IReadOnlyList<Guid> AttachmentIds,
    bool HasArchivedPdf,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<ApplicationEventDto> Events)
{
    public static ApplicationDto From(JobApplication a, DateTime utcNow)
    {
        var isDue = a.Status == ApplicationStatuses.Applied
            && ((a.FollowUpAt.HasValue && a.FollowUpAt.Value <= utcNow)
                || (!a.FollowUpAt.HasValue && a.AppliedAt.HasValue && a.AppliedAt.Value.AddDays(14) <= utcNow));

        var attachmentGuids = string.IsNullOrWhiteSpace(a.AttachmentIds)
            ? []
            : a.AttachmentIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => Guid.TryParse(s, out var g) ? g : Guid.Empty)
                .Where(g => g != Guid.Empty)
                .ToList();

        return new(
            a.Id,
            a.JobTitle,
            a.Company,
            a.Location,
            a.ContactPerson,
            a.ContactEmail,
            a.ContactPhone,
            a.JobPostingUrl,
            a.JobDescription,
            a.SalaryExpectation,
            a.Status,
            a.AppliedAt,
            a.FollowUpAt,
            isDue,
            a.CoverLetterId,
            a.CoverLetter?.Title,
            a.CvDesign,
            a.CvAccentColor,
            a.CvFont,
            a.CvLanguage,
            a.CvShowPhoto,
            a.CvPhotoShape,
            a.IncludeCoverSheet,
            attachmentGuids,
            !string.IsNullOrEmpty(a.ArchivedPdfPath),
            a.Notes,
            a.CreatedAt,
            a.UpdatedAt,
            a.Events.OrderByDescending(e => e.Date).ThenByDescending(e => e.CreatedAt).Select(ApplicationEventDto.From).ToList());
    }
}

public sealed record ApplicationStatsDto(
    int Total,
    int Draft,
    int Applied,
    int Acknowledged,
    int Interview,
    int Offer,
    int Rejected,
    int Withdrawn,
    int FollowUpsDue);

