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
/// Cover letters (Anschreiben) adhering to DIN 5008 standards.
/// Scoped to the authenticated user. Supports live Typst PDF preview, export, and signature image management.
/// </summary>
[ApiController]
[Route("api/cover-letters")]
[Authorize]
public sealed class CoverLetterController(
    AppDbContext db,
    ServerSettings settings,
    TimeProvider time,
    Documents.TypstRenderer renderer,
    Documents.DocxRenderer docxRenderer) : ControllerBase
{
    private static readonly byte[] JpegMagic = [0xFF, 0xD8, 0xFF];
    private static readonly byte[] PngMagic = [0x89, 0x50, 0x4E, 0x47];
    private const int MaxSignatureBytes = 2 * 1024 * 1024; // 2 MB

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CoverLetterListItemDto>>> List(CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var letters = await db.CoverLetters
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.UpdatedAt)
            .Select(c => CoverLetterListItemDto.From(c))
            .ToListAsync(ct);

        return Ok(letters);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CoverLetterDto>> Get(Guid id, CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var letter = await db.CoverLetters.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
        if (letter is null) return NotFound();

        return Ok(CoverLetterDto.From(letter));
    }

    [HttpPost]
    public async Task<ActionResult<CoverLetterDto>> Create([FromBody] CoverLetterRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        ValidateRequest(errors, body);
        errors.ThrowIfAny();

        var userId = User.RequiredUserId();
        var now = time.GetUtcNow().UtcDateTime;

        // If sender data was omitted, seed from user's master profile where available
        var profile = await db.Profiles.FirstOrDefaultAsync(p => p.UserId == userId, ct);

        var senderName = !string.IsNullOrWhiteSpace(body.SenderName)
            ? body.SenderName.Trim()
            : (profile is not null ? $"{profile.FirstName} {profile.LastName}".Trim() : "");

        var senderStreet = !string.IsNullOrWhiteSpace(body.SenderStreet)
            ? body.SenderStreet.Trim()
            : profile?.Street;

        var senderPostal = !string.IsNullOrWhiteSpace(body.SenderPostalCode)
            ? body.SenderPostalCode.Trim()
            : profile?.PostalCode;

        var senderCity = !string.IsNullOrWhiteSpace(body.SenderCity)
            ? body.SenderCity.Trim()
            : profile?.City;

        var senderPhone = !string.IsNullOrWhiteSpace(body.SenderPhone)
            ? body.SenderPhone.Trim()
            : profile?.Phone;

        var senderEmail = !string.IsNullOrWhiteSpace(body.SenderEmail)
            ? body.SenderEmail.Trim()
            : profile?.Email;

        var letter = new CoverLetter
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = body.Title!.Trim(),
            SenderName = senderName,
            SenderStreet = senderStreet,
            SenderPostalCode = senderPostal,
            SenderCity = senderCity,
            SenderPhone = senderPhone,
            SenderEmail = senderEmail,
            RecipientCompany = body.RecipientCompany!.Trim(),
            RecipientDepartment = body.RecipientDepartment?.Trim(),
            RecipientContactPerson = body.RecipientContactPerson?.Trim(),
            RecipientStreet = body.RecipientStreet?.Trim(),
            RecipientPostalCode = body.RecipientPostalCode?.Trim(),
            RecipientCity = body.RecipientCity!.Trim(),
            RecipientCountry = body.RecipientCountry?.Trim(),
            Place = body.Place?.Trim(),
            Date = body.Date?.Trim(),
            Subject = body.Subject!.Trim(),
            Salutation = body.Salutation!.Trim(),
            Body = body.Body!.Trim(),
            Closing = string.IsNullOrWhiteSpace(body.Closing) ? "Mit freundlichen Grüßen" : body.Closing.Trim(),
            SignatureName = !string.IsNullOrWhiteSpace(body.SignatureName) ? body.SignatureName.Trim() : senderName,
            AttachmentsNote = body.AttachmentsNote?.Trim(),
            Language = body.Language?.Trim().ToLowerInvariant() == "en" ? "en" : "de",
            Font = body.Font?.Trim(),
            AccentColor = body.AccentColor?.Trim(),
            CreatedAt = now,
            UpdatedAt = now
        };

        db.CoverLetters.Add(letter);
        await db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(Get), new { id = letter.Id }, CoverLetterDto.From(letter));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CoverLetterDto>> Update(Guid id, [FromBody] CoverLetterRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        ValidateRequest(errors, body);
        errors.ThrowIfAny();

        var userId = User.RequiredUserId();
        var letter = await db.CoverLetters.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
        if (letter is null) return NotFound();

        letter.Title = body.Title!.Trim();
        letter.SenderName = body.SenderName?.Trim();
        letter.SenderStreet = body.SenderStreet?.Trim();
        letter.SenderPostalCode = body.SenderPostalCode?.Trim();
        letter.SenderCity = body.SenderCity?.Trim();
        letter.SenderPhone = body.SenderPhone?.Trim();
        letter.SenderEmail = body.SenderEmail?.Trim();
        letter.RecipientCompany = body.RecipientCompany!.Trim();
        letter.RecipientDepartment = body.RecipientDepartment?.Trim();
        letter.RecipientContactPerson = body.RecipientContactPerson?.Trim();
        letter.RecipientStreet = body.RecipientStreet?.Trim();
        letter.RecipientPostalCode = body.RecipientPostalCode?.Trim();
        letter.RecipientCity = body.RecipientCity!.Trim();
        letter.RecipientCountry = body.RecipientCountry?.Trim();
        letter.Place = body.Place?.Trim();
        letter.Date = body.Date?.Trim();
        letter.Subject = body.Subject!.Trim();
        letter.Salutation = body.Salutation!.Trim();
        letter.Body = body.Body!.Trim();
        letter.Closing = string.IsNullOrWhiteSpace(body.Closing) ? "Mit freundlichen Grüßen" : body.Closing.Trim();
        letter.SignatureName = body.SignatureName?.Trim();
        letter.AttachmentsNote = body.AttachmentsNote?.Trim();
        letter.Language = body.Language?.Trim().ToLowerInvariant() == "en" ? "en" : "de";
        letter.Font = body.Font?.Trim();
        letter.AccentColor = body.AccentColor?.Trim();
        letter.UpdatedAt = time.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return Ok(CoverLetterDto.From(letter));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var letter = await db.CoverLetters.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
        if (letter is null) return NotFound();

        if (!string.IsNullOrEmpty(letter.SignaturePath) && System.IO.File.Exists(letter.SignaturePath))
        {
            try { System.IO.File.Delete(letter.SignaturePath); } catch { /* best effort */ }
        }

        db.CoverLetters.Remove(letter);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/signature")]
    [RequestSizeLimit(MaxSignatureBytes)]
    public async Task<ActionResult<CoverLetterDto>> UploadSignature(Guid id, IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            throw new ApiException(StatusCodes.Status400BadRequest, "file.missing", "No file uploaded.");
        }

        if (file.Length > MaxSignatureBytes)
        {
            throw new ApiException(StatusCodes.Status400BadRequest, "file.too_large", "Signature file exceeds 2 MB.");
        }

        using var memory = new MemoryStream();
        await file.CopyToAsync(memory, ct);
        var bytes = memory.ToArray();

        var isJpeg = bytes.Length >= 3 && bytes[0] == JpegMagic[0] && bytes[1] == JpegMagic[1] && bytes[2] == JpegMagic[2];
        var isPng = bytes.Length >= 4 && bytes[0] == PngMagic[0] && bytes[1] == PngMagic[1] && bytes[2] == PngMagic[2] && bytes[3] == PngMagic[3];

        if (!isJpeg && !isPng)
        {
            throw new ApiException(StatusCodes.Status400BadRequest, "file.invalid_type", "Only PNG and JPEG images are allowed.");
        }

        var userId = User.RequiredUserId();
        var letter = await db.CoverLetters.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
        if (letter is null) return NotFound();

        var ext = isPng ? ".png" : ".jpg";
        var dir = Path.Combine(settings.DataDirectory, "signatures");
        Directory.CreateDirectory(dir);

        var path = Path.Combine(dir, $"{userId}_{id}{ext}");
        await System.IO.File.WriteAllBytesAsync(path, bytes, ct);

        letter.SignaturePath = path;
        letter.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return Ok(CoverLetterDto.From(letter));
    }

    [HttpDelete("{id:guid}/signature")]
    public async Task<ActionResult<CoverLetterDto>> DeleteSignature(Guid id, CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var letter = await db.CoverLetters.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
        if (letter is null) return NotFound();

        if (!string.IsNullOrEmpty(letter.SignaturePath) && System.IO.File.Exists(letter.SignaturePath))
        {
            try { System.IO.File.Delete(letter.SignaturePath); } catch { /* best effort */ }
        }

        letter.SignaturePath = null;
        letter.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return Ok(CoverLetterDto.From(letter));
    }

    [HttpPost("{id:guid}/preview/pdf")]
    public async Task<IActionResult> PreviewPdf(Guid id, [FromBody] CoverLetterRenderOptions? options, CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var letter = await db.CoverLetters.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
        if (letter is null) return NotFound();

        var dto = CoverLetterDto.From(letter);
        var effectiveOptions = options ?? new CoverLetterRenderOptions(letter.Font, letter.AccentColor, letter.Language, true);

        byte[] pdfBytes = renderer.RenderCoverLetterPdf(dto, effectiveOptions, letter.SignaturePath);
        return File(pdfBytes, "application/pdf");
    }

    [HttpPost("{id:guid}/export/pdf")]
    public async Task<IActionResult> ExportPdf(Guid id, [FromBody] CoverLetterRenderOptions? options, CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var letter = await db.CoverLetters.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
        if (letter is null) return NotFound();

        var dto = CoverLetterDto.From(letter);
        var effectiveOptions = options ?? new CoverLetterRenderOptions(letter.Font, letter.AccentColor, letter.Language, true);

        byte[] pdfBytes = renderer.RenderCoverLetterPdf(dto, effectiveOptions, letter.SignaturePath);

        var safeCompany = SanitizeFileNamePart(letter.RecipientCompany);
        var safeSender = SanitizeFileNamePart(letter.SenderName ?? "Bewerbung");
        var prefix = effectiveOptions.NormalizedLanguage == "en" ? "Cover_Letter" : "Anschreiben";
        var fileName = $"{prefix}_{safeCompany}_{safeSender}.pdf";

        return File(pdfBytes, "application/pdf", fileName);
    }

    [HttpPost("{id:guid}/export/docx")]
    public async Task<IActionResult> ExportDocx(Guid id, [FromBody] CoverLetterRenderOptions? options, CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var letter = await db.CoverLetters.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct);
        if (letter is null) return NotFound();

        var dto = CoverLetterDto.From(letter);
        var effectiveOptions = options ?? new CoverLetterRenderOptions(letter.Font, letter.AccentColor, letter.Language, true);

        byte[] docxBytes = docxRenderer.RenderCoverLetterDocx(dto, effectiveOptions);

        var safeCompany = SanitizeFileNamePart(letter.RecipientCompany);
        var safeSender = SanitizeFileNamePart(letter.SenderName ?? "Bewerbung");
        var prefix = effectiveOptions.NormalizedLanguage == "en" ? "Cover_Letter" : "Anschreiben";
        var fileName = $"{prefix}_{safeCompany}_{safeSender}.docx";

        return File(docxBytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileName);
    }

    private static void ValidateRequest(FieldErrors errors, CoverLetterRequest body)
    {
        InputRules.Required(errors, "title", body.Title, 128);
        InputRules.Optional(errors, "senderName", body.SenderName, 128);
        InputRules.Optional(errors, "senderStreet", body.SenderStreet, 128);
        InputRules.Optional(errors, "senderPostalCode", body.SenderPostalCode, 32);
        InputRules.Optional(errors, "senderCity", body.SenderCity, 128);
        InputRules.Optional(errors, "senderPhone", body.SenderPhone, 64);
        InputRules.Optional(errors, "senderEmail", body.SenderEmail, 128);

        InputRules.Required(errors, "recipientCompany", body.RecipientCompany, 128);
        InputRules.Optional(errors, "recipientDepartment", body.RecipientDepartment, 128);
        InputRules.Optional(errors, "recipientContactPerson", body.RecipientContactPerson, 128);
        InputRules.Optional(errors, "recipientStreet", body.RecipientStreet, 128);
        InputRules.Optional(errors, "recipientPostalCode", body.RecipientPostalCode, 32);
        InputRules.Required(errors, "recipientCity", body.RecipientCity, 128);
        InputRules.Optional(errors, "recipientCountry", body.RecipientCountry, 64);

        InputRules.Optional(errors, "place", body.Place, 64);
        InputRules.Optional(errors, "date", body.Date, 64);
        InputRules.Required(errors, "subject", body.Subject, 256);
        InputRules.Required(errors, "salutation", body.Salutation, 128);
        InputRules.Required(errors, "body", body.Body, 16384);
        InputRules.Optional(errors, "closing", body.Closing, 128);
        InputRules.Optional(errors, "signatureName", body.SignatureName, 128);
        InputRules.Optional(errors, "attachmentsNote", body.AttachmentsNote, 512);
        InputRules.Optional(errors, "font", body.Font, 64);
        InputRules.Optional(errors, "accentColor", body.AccentColor, 32);
    }

    private static string SanitizeFileNamePart(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return "Dokument";
        var safe = new string(input.Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_').ToArray());
        return string.IsNullOrWhiteSpace(safe) ? "Dokument" : safe.Trim();
    }
}
