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

public sealed record AttachmentDto(
    Guid Id,
    string Title,
    string FileName,
    string? Category,
    string ContentType,
    long SizeBytes,
    int SortOrder,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static AttachmentDto From(Attachment a) =>
        new(a.Id, a.Title, a.FileName, a.Category, a.ContentType, a.SizeBytes, a.SortOrder, a.CreatedAt, a.UpdatedAt);
}

public sealed record UpdateAttachmentRequest(
    string? Title,
    string? Category,
    int? SortOrder);

[ApiController]
[Route("api/attachments")]
[Authorize]
public sealed class AttachmentsController(
    AppDbContext db,
    ServerSettings settings,
    TimeProvider time) : ControllerBase
{
    private const int MaxAttachmentBytes = 20 * 1024 * 1024; // 20 MB
    private static readonly byte[] PdfMagic = [0x25, 0x50, 0x44, 0x46]; // %PDF
    private static readonly byte[] JpegMagic = [0xFF, 0xD8, 0xFF];
    private static readonly byte[] PngMagic = [0x89, 0x50, 0x4E, 0x47];

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AttachmentDto>>> List(CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var attachments = await db.Attachments
            .Where(a => a.UserId == userId)
            .OrderBy(a => a.SortOrder)
            .ThenByDescending(a => a.CreatedAt)
            .ToListAsync(ct);

        return Ok(attachments.Select(AttachmentDto.From).ToList());
    }

    [HttpPost]
    [RequestSizeLimit(MaxAttachmentBytes)]
    public async Task<ActionResult<AttachmentDto>> Upload(
        [FromForm] IFormFile? file,
        [FromForm] string? title,
        [FromForm] string? category,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            throw ApiException.BadRequest("file.required", "A file is required.");
        }

        if (file.Length > MaxAttachmentBytes)
        {
            throw ApiException.BadRequest("file.too_large", "The file exceeds the 20 MB limit.");
        }

        using var memory = new MemoryStream();
        await file.CopyToAsync(memory, ct);
        var bytes = memory.ToArray();

        string ext;
        string contentType;

        if (bytes.Length >= 4 && bytes.AsSpan(0, 4).SequenceEqual(PdfMagic))
        {
            ext = ".pdf";
            contentType = "application/pdf";
        }
        else if (bytes.Length >= 3 && bytes[0] == JpegMagic[0] && bytes[1] == JpegMagic[1] && bytes[2] == JpegMagic[2])
        {
            ext = ".jpg";
            contentType = "image/jpeg";
        }
        else if (bytes.Length >= 4 && bytes.AsSpan(0, 4).SequenceEqual(PngMagic))
        {
            ext = ".png";
            contentType = "image/png";
        }
        else if (bytes.Length >= 12 && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                 && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P')
        {
            ext = ".webp";
            contentType = "image/webp";
        }
        else
        {
            throw ApiException.BadRequest("file.invalid_format", "Only PDF, PNG, JPEG, and WebP files are supported.");
        }

        var userId = User.RequiredUserId();
        var id = Guid.NewGuid();
        var userAttachmentsDir = Path.Combine(settings.DataDirectory, "attachments", userId.ToString("N"));
        Directory.CreateDirectory(userAttachmentsDir);

        var diskFileName = $"{id:N}{ext}";
        var fullPath = Path.Combine(userAttachmentsDir, diskFileName);
        await System.IO.File.WriteAllBytesAsync(fullPath, bytes, ct);

        var relativePath = Path.Combine("attachments", userId.ToString("N"), diskFileName).Replace('\\', '/');
        var now = time.GetUtcNow().UtcDateTime;

        int currentCount = await db.Attachments.CountAsync(a => a.UserId == userId, ct);

        var attachment = new Attachment
        {
            Id = id,
            UserId = userId,
            Title = !string.IsNullOrWhiteSpace(title) ? title.Trim() : Path.GetFileNameWithoutExtension(file.FileName),
            FileName = Path.GetFileName(file.FileName),
            Category = category?.Trim(),
            ContentType = contentType,
            SizeBytes = file.Length,
            StoragePath = relativePath,
            SortOrder = currentCount,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Attachments.Add(attachment);
        await db.SaveChangesAsync(ct);

        return Created($"/api/attachments/{attachment.Id}", AttachmentDto.From(attachment));
    }

    [HttpGet("{id:guid}/file")]
    public async Task<IActionResult> DownloadFile(Guid id, CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var attachment = await db.Attachments.FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId, ct);
        if (attachment is null) return NotFound();

        var fullPath = Path.Combine(settings.DataDirectory, attachment.StoragePath);
        if (!System.IO.File.Exists(fullPath)) return NotFound();

        var bytes = await System.IO.File.ReadAllBytesAsync(fullPath, ct);
        return File(bytes, attachment.ContentType, attachment.FileName);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AttachmentDto>> Update(
        Guid id,
        [FromBody] UpdateAttachmentRequest body,
        CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var attachment = await db.Attachments.FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId, ct);
        if (attachment is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(body.Title)) attachment.Title = body.Title.Trim();
        if (body.Category is not null) attachment.Category = string.IsNullOrWhiteSpace(body.Category) ? null : body.Category.Trim();
        if (body.SortOrder.HasValue) attachment.SortOrder = body.SortOrder.Value;
        attachment.UpdatedAt = time.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return Ok(AttachmentDto.From(attachment));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        var attachment = await db.Attachments.FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId, ct);
        if (attachment is null) return NotFound();

        var fullPath = Path.Combine(settings.DataDirectory, attachment.StoragePath);
        if (System.IO.File.Exists(fullPath))
        {
            try { System.IO.File.Delete(fullPath); } catch { /* best effort */ }
        }

        db.Attachments.Remove(attachment);
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPut("reorder")]
    public async Task<IActionResult> Reorder([FromBody] ReorderRequest body, CancellationToken ct)
    {
        var userId = User.RequiredUserId();
        if (body.Ids is not null)
        {
            var attachments = await db.Attachments.Where(a => a.UserId == userId).ToListAsync(ct);
            for (var i = 0; i < body.Ids.Count; i++)
            {
                var targetId = body.Ids[i];
                var match = attachments.FirstOrDefault(a => a.Id == targetId);
                if (match is not null) match.SortOrder = i;
            }
            await db.SaveChangesAsync(ct);
        }
        return Ok();
    }
}

