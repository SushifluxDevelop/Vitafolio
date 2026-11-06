// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using Cv.Server.Data;

namespace Cv.Server.Controllers;

public sealed record CoverLetterRequest(
    string? Title,
    string? SenderName,
    string? SenderStreet,
    string? SenderPostalCode,
    string? SenderCity,
    string? SenderPhone,
    string? SenderEmail,
    string? RecipientCompany,
    string? RecipientDepartment,
    string? RecipientContactPerson,
    string? RecipientStreet,
    string? RecipientPostalCode,
    string? RecipientCity,
    string? RecipientCountry,
    string? Place,
    string? Date,
    string? Subject,
    string? Salutation,
    string? Body,
    string? Closing,
    string? SignatureName,
    string? AttachmentsNote,
    string? Language,
    string? Font,
    string? AccentColor);

public sealed record CoverLetterDto(
    Guid Id,
    string Title,
    string? SenderName,
    string? SenderStreet,
    string? SenderPostalCode,
    string? SenderCity,
    string? SenderPhone,
    string? SenderEmail,
    string RecipientCompany,
    string? RecipientDepartment,
    string? RecipientContactPerson,
    string? RecipientStreet,
    string? RecipientPostalCode,
    string RecipientCity,
    string? RecipientCountry,
    string? Place,
    string? Date,
    string Subject,
    string Salutation,
    string Body,
    string Closing,
    string? SignatureName,
    bool HasSignature,
    string? AttachmentsNote,
    string Language,
    string? Font,
    string? AccentColor,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static CoverLetterDto From(CoverLetter c) =>
        new(
            c.Id,
            c.Title,
            c.SenderName,
            c.SenderStreet,
            c.SenderPostalCode,
            c.SenderCity,
            c.SenderPhone,
            c.SenderEmail,
            c.RecipientCompany,
            c.RecipientDepartment,
            c.RecipientContactPerson,
            c.RecipientStreet,
            c.RecipientPostalCode,
            c.RecipientCity,
            c.RecipientCountry,
            c.Place,
            c.Date,
            c.Subject,
            c.Salutation,
            c.Body,
            c.Closing,
            c.SignatureName,
            !string.IsNullOrEmpty(c.SignaturePath),
            c.AttachmentsNote,
            c.Language,
            c.Font,
            c.AccentColor,
            c.CreatedAt,
            c.UpdatedAt);
}

public sealed record CoverLetterListItemDto(
    Guid Id,
    string Title,
    string RecipientCompany,
    string Subject,
    string? Date,
    DateTime UpdatedAt)
{
    public static CoverLetterListItemDto From(CoverLetter c) =>
        new(c.Id, c.Title, c.RecipientCompany, c.Subject, c.Date, c.UpdatedAt);
}

public sealed record CoverLetterRenderOptions(
    string? Font,
    string? AccentColor,
    string? Language,
    bool? IncludeFoldMarks)
{
    public string NormalizedFont => Font?.Trim() switch
    {
        "Roboto" => "Roboto",
        "Open Sans" => "Open Sans",
        "Merriweather" => "Merriweather",
        "Lora" => "Lora",
        "DejaVu Serif" => "DejaVu Serif",
        _ => "Liberation Sans"
    };

    public string NormalizedAccentColor =>
        !string.IsNullOrEmpty(AccentColor) && AccentColor.StartsWith('#') && (AccentColor.Length == 7 || AccentColor.Length == 9)
            ? AccentColor
            : "#14213D";

    public string NormalizedLanguage => Language?.ToLowerInvariant() switch
    {
        "en" => "en",
        _ => "de"
    };

    public bool NormalizedIncludeFoldMarks => IncludeFoldMarks ?? true;
}

