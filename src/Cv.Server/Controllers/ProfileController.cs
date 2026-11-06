using Cv.Server.Auth;
using Cv.Server.Configuration;
using Cv.Server.Data;
using Cv.Server.Errors;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Controllers;

/// <summary>
/// Master profile and resume building blocks: personal details, experiences, educations, skills, languages,
/// certificates, interests, and custom sections. Strictly scoped to the authenticated user.
/// </summary>
[ApiController]
[Route("api/profile")]
[Authorize]
public sealed class ProfileController(
    AppDbContext db,
    ServerSettings settings,
    TimeProvider time,
    Documents.TypstRenderer renderer,
    Documents.DocxRenderer docxRenderer) : ControllerBase
{
    private static readonly byte[] JpegMagic = [0xFF, 0xD8, 0xFF];
    private static readonly byte[] PngMagic = [0x89, 0x50, 0x4E, 0x47];
    private const int MaxPhotoBytes = 5 * 1024 * 1024; // 5 MB

    // -----------------------------------------------------------------------------------------------------------------
    // Master Profile (Personal Data)
    // -----------------------------------------------------------------------------------------------------------------

    [HttpGet]
    public async Task<ActionResult<ProfileResponse>> GetProfile(CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        return ProfileResponse.From(profile);
    }

    [HttpPut]
    public async Task<ActionResult<ProfileResponse>> UpdateProfile([FromBody] PersonalDataRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "firstName", body.FirstName, 64);
        InputRules.Required(errors, "lastName", body.LastName, 64);
        InputRules.Optional(errors, "academicTitle", body.AcademicTitle, 32);
        InputRules.Optional(errors, "professionalTitle", body.ProfessionalTitle, 128);
        InputRules.Optional(errors, "email", body.Email, 128);
        InputRules.Optional(errors, "phone", body.Phone, 64);
        InputRules.Optional(errors, "street", body.Street, 128);
        InputRules.Optional(errors, "postalCode", body.PostalCode, 32);
        InputRules.Optional(errors, "city", body.City, 128);
        InputRules.Optional(errors, "country", body.Country, 64);
        InputRules.Optional(errors, "dateOfBirth", body.DateOfBirth, 32);
        InputRules.Optional(errors, "placeOfBirth", body.PlaceOfBirth, 128);
        InputRules.Optional(errors, "nationality", body.Nationality, 64);
        InputRules.Optional(errors, "maritalStatus", body.MaritalStatus, 64);
        InputRules.Optional(errors, "website", body.Website, 256);
        InputRules.Optional(errors, "linkedIn", body.LinkedIn, 256);
        InputRules.Optional(errors, "gitHub", body.GitHub, 256);
        InputRules.Optional(errors, "xing", body.Xing, 256);
        InputRules.Optional(errors, "bio", body.Bio, 4096);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        profile.FirstName = body.FirstName!.Trim();
        profile.LastName = body.LastName!.Trim();
        profile.AcademicTitle = body.AcademicTitle?.Trim();
        profile.ProfessionalTitle = body.ProfessionalTitle?.Trim();
        profile.Email = body.Email?.Trim();
        profile.Phone = body.Phone?.Trim();
        profile.Street = body.Street?.Trim();
        profile.PostalCode = body.PostalCode?.Trim();
        profile.City = body.City?.Trim();
        profile.Country = body.Country?.Trim();
        profile.DateOfBirth = body.DateOfBirth?.Trim();
        profile.PlaceOfBirth = body.PlaceOfBirth?.Trim();
        profile.Nationality = body.Nationality?.Trim();
        profile.MaritalStatus = body.MaritalStatus?.Trim();
        profile.Website = body.Website?.Trim();
        profile.LinkedIn = body.LinkedIn?.Trim();
        profile.GitHub = body.GitHub?.Trim();
        profile.Xing = body.Xing?.Trim();
        profile.Bio = body.Bio?.Trim();
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return ProfileResponse.From(profile);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Profile Photo
    // -----------------------------------------------------------------------------------------------------------------

    [HttpGet("photo")]
    public async Task<IActionResult> GetPhoto(CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        if (string.IsNullOrEmpty(profile.PhotoPath))
        {
            return NotFound();
        }

        var fullPath = Path.Combine(settings.DataDirectory, profile.PhotoPath);
        if (!System.IO.File.Exists(fullPath))
        {
            return NotFound();
        }

        var ext = Path.GetExtension(fullPath).ToLowerInvariant();
        var contentType = ext switch
        {
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "image/jpeg",
        };

        return PhysicalFile(fullPath, contentType, enableRangeProcessing: false);
    }

    [HttpPost("photo")]
    [RequestSizeLimit(MaxPhotoBytes)]
    public async Task<ActionResult<ProfileResponse>> UploadPhoto([FromForm] IFormFile? photo, CancellationToken ct)
    {
        if (photo is null || photo.Length == 0)
        {
            throw ApiException.BadRequest("photo.required", "A photo file is required.");
        }

        if (photo.Length > MaxPhotoBytes)
        {
            throw ApiException.BadRequest("photo.too_large", "The photo file exceeds the 5 MB limit.");
        }

        using var memory = new MemoryStream();
        await photo.CopyToAsync(memory, ct);
        var bytes = memory.ToArray();

        string ext;
        if (bytes.Length >= 3 && bytes[0] == JpegMagic[0] && bytes[1] == JpegMagic[1] && bytes[2] == JpegMagic[2])
        {
            ext = ".jpg";
        }
        else if (bytes.Length >= 4 && bytes.AsSpan(0, 4).SequenceEqual(PngMagic))
        {
            ext = ".png";
        }
        else if (bytes.Length >= 12 && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                 && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P')
        {
            ext = ".webp";
        }
        else
        {
            throw ApiException.BadRequest("photo.invalid_format", "Only JPEG, PNG, and WebP images are accepted.");
        }

        var profile = await GetOrCreateProfileAsync(ct);
        var photosDir = Path.Combine(settings.DataDirectory, "photos");
        Directory.CreateDirectory(photosDir);

        // Delete older photo if extension changed
        if (!string.IsNullOrEmpty(profile.PhotoPath))
        {
            var oldPath = Path.Combine(settings.DataDirectory, profile.PhotoPath);
            if (System.IO.File.Exists(oldPath))
            {
                try { System.IO.File.Delete(oldPath); } catch { /* best effort */ }
            }
        }

        var relativePath = Path.Combine("photos", $"{profile.UserId}{ext}");
        var destination = Path.Combine(settings.DataDirectory, relativePath);
        await System.IO.File.WriteAllBytesAsync(destination, bytes, ct);

        profile.PhotoPath = relativePath.Replace('\\', '/');
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return ProfileResponse.From(profile);
    }

    [HttpDelete("photo")]
    public async Task<IActionResult> DeletePhoto(CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        if (!string.IsNullOrEmpty(profile.PhotoPath))
        {
            var fullPath = Path.Combine(settings.DataDirectory, profile.PhotoPath);
            if (System.IO.File.Exists(fullPath))
            {
                try { System.IO.File.Delete(fullPath); } catch { /* best effort */ }
            }
            profile.PhotoPath = null;
            profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
        }

        return NoContent();
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Experiences
    // -----------------------------------------------------------------------------------------------------------------

    [HttpPost("experiences")]
    public async Task<ActionResult<ExperienceDto>> AddExperience([FromBody] ExperienceRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "jobTitle", body.JobTitle, 128);
        InputRules.Required(errors, "employer", body.Employer, 128);
        InputRules.Required(errors, "startDate", body.StartDate, 32);
        InputRules.Optional(errors, "employmentType", body.EmploymentType, 64);
        InputRules.Optional(errors, "city", body.City, 128);
        InputRules.Optional(errors, "country", body.Country, 64);
        InputRules.Optional(errors, "endDate", body.EndDate, 32);
        InputRules.Optional(errors, "description", body.Description, 4096);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var experience = new Experience
        {
            Id = Guid.NewGuid(),
            ProfileId = profile.Id,
            JobTitle = body.JobTitle!.Trim(),
            Employer = body.Employer!.Trim(),
            EmploymentType = body.EmploymentType?.Trim(),
            City = body.City?.Trim(),
            Country = body.Country?.Trim(),
            StartDate = body.StartDate!.Trim(),
            EndDate = body.IsCurrent ? null : body.EndDate?.Trim(),
            IsCurrent = body.IsCurrent,
            Description = body.Description?.Trim(),
            SortOrder = body.SortOrder,
            CreatedAt = time.GetUtcNow().UtcDateTime,
            UpdatedAt = time.GetUtcNow().UtcDateTime,
        };

        db.Experiences.Add(experience);
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return Created($"/api/profile/experiences/{experience.Id}", ExperienceDto.From(experience));
    }

    [HttpPut("experiences/{id:guid}")]
    public async Task<ActionResult<ExperienceDto>> UpdateExperience(Guid id, [FromBody] ExperienceRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "jobTitle", body.JobTitle, 128);
        InputRules.Required(errors, "employer", body.Employer, 128);
        InputRules.Required(errors, "startDate", body.StartDate, 32);
        InputRules.Optional(errors, "employmentType", body.EmploymentType, 64);
        InputRules.Optional(errors, "city", body.City, 128);
        InputRules.Optional(errors, "country", body.Country, 64);
        InputRules.Optional(errors, "endDate", body.EndDate, 32);
        InputRules.Optional(errors, "description", body.Description, 4096);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var experience = await db.Experiences.FirstOrDefaultAsync(e => e.Id == id && e.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("experience.not_found", "The specified experience entry was not found.");

        experience.JobTitle = body.JobTitle!.Trim();
        experience.Employer = body.Employer!.Trim();
        experience.EmploymentType = body.EmploymentType?.Trim();
        experience.City = body.City?.Trim();
        experience.Country = body.Country?.Trim();
        experience.StartDate = body.StartDate!.Trim();
        experience.EndDate = body.IsCurrent ? null : body.EndDate?.Trim();
        experience.IsCurrent = body.IsCurrent;
        experience.Description = body.Description?.Trim();
        experience.SortOrder = body.SortOrder;
        experience.UpdatedAt = time.GetUtcNow().UtcDateTime;
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return ExperienceDto.From(experience);
    }

    [HttpDelete("experiences/{id:guid}")]
    public async Task<IActionResult> DeleteExperience(Guid id, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        var experience = await db.Experiences.FirstOrDefaultAsync(e => e.Id == id && e.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("experience.not_found", "The specified experience entry was not found.");

        db.Experiences.Remove(experience);
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPut("experiences/reorder")]
    public async Task<IActionResult> ReorderExperiences([FromBody] ReorderRequest body, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        if (body.Ids is not null)
        {
            var items = await db.Experiences.Where(e => e.ProfileId == profile.Id).ToListAsync(ct);
            for (var i = 0; i < body.Ids.Count; i++)
            {
                var targetId = body.Ids[i];
                var match = items.FirstOrDefault(item => item.Id == targetId);
                if (match is not null) match.SortOrder = i;
            }
            profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
        }
        return Ok();
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Educations
    // -----------------------------------------------------------------------------------------------------------------

    [HttpPost("educations")]
    public async Task<ActionResult<EducationDto>> AddEducation([FromBody] EducationRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "degree", body.Degree, 128);
        InputRules.Required(errors, "institution", body.Institution, 128);
        InputRules.Required(errors, "startDate", body.StartDate, 32);
        InputRules.Optional(errors, "fieldOfStudy", body.FieldOfStudy, 128);
        InputRules.Optional(errors, "city", body.City, 128);
        InputRules.Optional(errors, "country", body.Country, 64);
        InputRules.Optional(errors, "endDate", body.EndDate, 32);
        InputRules.Optional(errors, "grade", body.Grade, 32);
        InputRules.Optional(errors, "description", body.Description, 4096);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var education = new Education
        {
            Id = Guid.NewGuid(),
            ProfileId = profile.Id,
            Degree = body.Degree!.Trim(),
            FieldOfStudy = body.FieldOfStudy?.Trim(),
            Institution = body.Institution!.Trim(),
            City = body.City?.Trim(),
            Country = body.Country?.Trim(),
            StartDate = body.StartDate!.Trim(),
            EndDate = body.IsCurrent ? null : body.EndDate?.Trim(),
            IsCurrent = body.IsCurrent,
            Grade = body.Grade?.Trim(),
            Description = body.Description?.Trim(),
            SortOrder = body.SortOrder,
            CreatedAt = time.GetUtcNow().UtcDateTime,
            UpdatedAt = time.GetUtcNow().UtcDateTime,
        };

        db.Educations.Add(education);
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return Created($"/api/profile/educations/{education.Id}", EducationDto.From(education));
    }

    [HttpPut("educations/{id:guid}")]
    public async Task<ActionResult<EducationDto>> UpdateEducation(Guid id, [FromBody] EducationRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "degree", body.Degree, 128);
        InputRules.Required(errors, "institution", body.Institution, 128);
        InputRules.Required(errors, "startDate", body.StartDate, 32);
        InputRules.Optional(errors, "fieldOfStudy", body.FieldOfStudy, 128);
        InputRules.Optional(errors, "city", body.City, 128);
        InputRules.Optional(errors, "country", body.Country, 64);
        InputRules.Optional(errors, "endDate", body.EndDate, 32);
        InputRules.Optional(errors, "grade", body.Grade, 32);
        InputRules.Optional(errors, "description", body.Description, 4096);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var education = await db.Educations.FirstOrDefaultAsync(e => e.Id == id && e.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("education.not_found", "The specified education entry was not found.");

        education.Degree = body.Degree!.Trim();
        education.FieldOfStudy = body.FieldOfStudy?.Trim();
        education.Institution = body.Institution!.Trim();
        education.City = body.City?.Trim();
        education.Country = body.Country?.Trim();
        education.StartDate = body.StartDate!.Trim();
        education.EndDate = body.IsCurrent ? null : body.EndDate?.Trim();
        education.IsCurrent = body.IsCurrent;
        education.Grade = body.Grade?.Trim();
        education.Description = body.Description?.Trim();
        education.SortOrder = body.SortOrder;
        education.UpdatedAt = time.GetUtcNow().UtcDateTime;
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return EducationDto.From(education);
    }

    [HttpDelete("educations/{id:guid}")]
    public async Task<IActionResult> DeleteEducation(Guid id, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        var education = await db.Educations.FirstOrDefaultAsync(e => e.Id == id && e.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("education.not_found", "The specified education entry was not found.");

        db.Educations.Remove(education);
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPut("educations/reorder")]
    public async Task<IActionResult> ReorderEducations([FromBody] ReorderRequest body, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        if (body.Ids is not null)
        {
            var items = await db.Educations.Where(e => e.ProfileId == profile.Id).ToListAsync(ct);
            for (var i = 0; i < body.Ids.Count; i++)
            {
                var targetId = body.Ids[i];
                var match = items.FirstOrDefault(item => item.Id == targetId);
                if (match is not null) match.SortOrder = i;
            }
            profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
        }
        return Ok();
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Skills
    // -----------------------------------------------------------------------------------------------------------------

    [HttpPost("skills")]
    public async Task<ActionResult<SkillDto>> AddSkill([FromBody] SkillRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "name", body.Name, 128);
        InputRules.Optional(errors, "category", body.Category, 64);
        InputRules.Range(errors, "level", body.Level, 0, 5);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var skill = new Skill
        {
            Id = Guid.NewGuid(),
            ProfileId = profile.Id,
            Name = body.Name!.Trim(),
            Category = body.Category?.Trim(),
            Level = body.Level,
            SortOrder = body.SortOrder,
            CreatedAt = time.GetUtcNow().UtcDateTime,
            UpdatedAt = time.GetUtcNow().UtcDateTime,
        };

        db.Skills.Add(skill);
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return Created($"/api/profile/skills/{skill.Id}", SkillDto.From(skill));
    }

    [HttpPut("skills/{id:guid}")]
    public async Task<ActionResult<SkillDto>> UpdateSkill(Guid id, [FromBody] SkillRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "name", body.Name, 128);
        InputRules.Optional(errors, "category", body.Category, 64);
        InputRules.Range(errors, "level", body.Level, 0, 5);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var skill = await db.Skills.FirstOrDefaultAsync(s => s.Id == id && s.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("skill.not_found", "The specified skill entry was not found.");

        skill.Name = body.Name!.Trim();
        skill.Category = body.Category?.Trim();
        skill.Level = body.Level;
        skill.SortOrder = body.SortOrder;
        skill.UpdatedAt = time.GetUtcNow().UtcDateTime;
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return SkillDto.From(skill);
    }

    [HttpDelete("skills/{id:guid}")]
    public async Task<IActionResult> DeleteSkill(Guid id, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        var skill = await db.Skills.FirstOrDefaultAsync(s => s.Id == id && s.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("skill.not_found", "The specified skill entry was not found.");

        db.Skills.Remove(skill);
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPut("skills/reorder")]
    public async Task<IActionResult> ReorderSkills([FromBody] ReorderRequest body, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        if (body.Ids is not null)
        {
            var items = await db.Skills.Where(s => s.ProfileId == profile.Id).ToListAsync(ct);
            for (var i = 0; i < body.Ids.Count; i++)
            {
                var targetId = body.Ids[i];
                var match = items.FirstOrDefault(item => item.Id == targetId);
                if (match is not null) match.SortOrder = i;
            }
            profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
        }
        return Ok();
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Languages
    // -----------------------------------------------------------------------------------------------------------------

    [HttpPost("languages")]
    public async Task<ActionResult<LanguageDto>> AddLanguage([FromBody] LanguageRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "language", body.Language, 64);
        InputRules.Required(errors, "level", body.Level, 32);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var lang = new LanguageSkill
        {
            Id = Guid.NewGuid(),
            ProfileId = profile.Id,
            Language = body.Language!.Trim(),
            Level = body.Level!.Trim(),
            SortOrder = body.SortOrder,
            CreatedAt = time.GetUtcNow().UtcDateTime,
            UpdatedAt = time.GetUtcNow().UtcDateTime,
        };

        db.Languages.Add(lang);
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return Created($"/api/profile/languages/{lang.Id}", LanguageDto.From(lang));
    }

    [HttpPut("languages/{id:guid}")]
    public async Task<ActionResult<LanguageDto>> UpdateLanguage(Guid id, [FromBody] LanguageRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "language", body.Language, 64);
        InputRules.Required(errors, "level", body.Level, 32);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var lang = await db.Languages.FirstOrDefaultAsync(l => l.Id == id && l.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("language.not_found", "The specified language entry was not found.");

        lang.Language = body.Language!.Trim();
        lang.Level = body.Level!.Trim();
        lang.SortOrder = body.SortOrder;
        lang.UpdatedAt = time.GetUtcNow().UtcDateTime;
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return LanguageDto.From(lang);
    }

    [HttpDelete("languages/{id:guid}")]
    public async Task<IActionResult> DeleteLanguage(Guid id, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        var lang = await db.Languages.FirstOrDefaultAsync(l => l.Id == id && l.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("language.not_found", "The specified language entry was not found.");

        db.Languages.Remove(lang);
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPut("languages/reorder")]
    public async Task<IActionResult> ReorderLanguages([FromBody] ReorderRequest body, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        if (body.Ids is not null)
        {
            var items = await db.Languages.Where(l => l.ProfileId == profile.Id).ToListAsync(ct);
            for (var i = 0; i < body.Ids.Count; i++)
            {
                var targetId = body.Ids[i];
                var match = items.FirstOrDefault(item => item.Id == targetId);
                if (match is not null) match.SortOrder = i;
            }
            profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
        }
        return Ok();
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Certificates
    // -----------------------------------------------------------------------------------------------------------------

    [HttpPost("certificates")]
    public async Task<ActionResult<CertificateDto>> AddCertificate([FromBody] CertificateRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "title", body.Title, 128);
        InputRules.Optional(errors, "issuer", body.Issuer, 128);
        InputRules.Optional(errors, "issueDate", body.IssueDate, 32);
        InputRules.Optional(errors, "expiryDate", body.ExpiryDate, 32);
        InputRules.Optional(errors, "credentialUrl", body.CredentialUrl, 256);
        InputRules.Optional(errors, "credentialId", body.CredentialId, 128);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var cert = new Certificate
        {
            Id = Guid.NewGuid(),
            ProfileId = profile.Id,
            Title = body.Title!.Trim(),
            Issuer = body.Issuer?.Trim(),
            IssueDate = body.IssueDate?.Trim(),
            ExpiryDate = body.ExpiryDate?.Trim(),
            CredentialUrl = body.CredentialUrl?.Trim(),
            CredentialId = body.CredentialId?.Trim(),
            SortOrder = body.SortOrder,
            CreatedAt = time.GetUtcNow().UtcDateTime,
            UpdatedAt = time.GetUtcNow().UtcDateTime,
        };

        db.Certificates.Add(cert);
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return Created($"/api/profile/certificates/{cert.Id}", CertificateDto.From(cert));
    }

    [HttpPut("certificates/{id:guid}")]
    public async Task<ActionResult<CertificateDto>> UpdateCertificate(Guid id, [FromBody] CertificateRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "title", body.Title, 128);
        InputRules.Optional(errors, "issuer", body.Issuer, 128);
        InputRules.Optional(errors, "issueDate", body.IssueDate, 32);
        InputRules.Optional(errors, "expiryDate", body.ExpiryDate, 32);
        InputRules.Optional(errors, "credentialUrl", body.CredentialUrl, 256);
        InputRules.Optional(errors, "credentialId", body.CredentialId, 128);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var cert = await db.Certificates.FirstOrDefaultAsync(c => c.Id == id && c.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("certificate.not_found", "The specified certificate entry was not found.");

        cert.Title = body.Title!.Trim();
        cert.Issuer = body.Issuer?.Trim();
        cert.IssueDate = body.IssueDate?.Trim();
        cert.ExpiryDate = body.ExpiryDate?.Trim();
        cert.CredentialUrl = body.CredentialUrl?.Trim();
        cert.CredentialId = body.CredentialId?.Trim();
        cert.SortOrder = body.SortOrder;
        cert.UpdatedAt = time.GetUtcNow().UtcDateTime;
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return CertificateDto.From(cert);
    }

    [HttpDelete("certificates/{id:guid}")]
    public async Task<IActionResult> DeleteCertificate(Guid id, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        var cert = await db.Certificates.FirstOrDefaultAsync(c => c.Id == id && c.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("certificate.not_found", "The specified certificate entry was not found.");

        db.Certificates.Remove(cert);
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPut("certificates/reorder")]
    public async Task<IActionResult> ReorderCertificates([FromBody] ReorderRequest body, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        if (body.Ids is not null)
        {
            var items = await db.Certificates.Where(c => c.ProfileId == profile.Id).ToListAsync(ct);
            for (var i = 0; i < body.Ids.Count; i++)
            {
                var targetId = body.Ids[i];
                var match = items.FirstOrDefault(item => item.Id == targetId);
                if (match is not null) match.SortOrder = i;
            }
            profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
        }
        return Ok();
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Interests & Activities
    // -----------------------------------------------------------------------------------------------------------------

    [HttpPost("interests")]
    public async Task<ActionResult<InterestDto>> AddInterest([FromBody] InterestRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "name", body.Name, 128);
        InputRules.Optional(errors, "category", body.Category, 64);
        InputRules.Optional(errors, "description", body.Description, 1024);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var interest = new Interest
        {
            Id = Guid.NewGuid(),
            ProfileId = profile.Id,
            Name = body.Name!.Trim(),
            Category = body.Category?.Trim(),
            Description = body.Description?.Trim(),
            SortOrder = body.SortOrder,
            CreatedAt = time.GetUtcNow().UtcDateTime,
            UpdatedAt = time.GetUtcNow().UtcDateTime,
        };

        db.Interests.Add(interest);
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return Created($"/api/profile/interests/{interest.Id}", InterestDto.From(interest));
    }

    [HttpPut("interests/{id:guid}")]
    public async Task<ActionResult<InterestDto>> UpdateInterest(Guid id, [FromBody] InterestRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "name", body.Name, 128);
        InputRules.Optional(errors, "category", body.Category, 64);
        InputRules.Optional(errors, "description", body.Description, 1024);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var interest = await db.Interests.FirstOrDefaultAsync(i => i.Id == id && i.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("interest.not_found", "The specified interest entry was not found.");

        interest.Name = body.Name!.Trim();
        interest.Category = body.Category?.Trim();
        interest.Description = body.Description?.Trim();
        interest.SortOrder = body.SortOrder;
        interest.UpdatedAt = time.GetUtcNow().UtcDateTime;
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return InterestDto.From(interest);
    }

    [HttpDelete("interests/{id:guid}")]
    public async Task<IActionResult> DeleteInterest(Guid id, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        var interest = await db.Interests.FirstOrDefaultAsync(i => i.Id == id && i.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("interest.not_found", "The specified interest entry was not found.");

        db.Interests.Remove(interest);
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPut("interests/reorder")]
    public async Task<IActionResult> ReorderInterests([FromBody] ReorderRequest body, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        if (body.Ids is not null)
        {
            var items = await db.Interests.Where(i => i.ProfileId == profile.Id).ToListAsync(ct);
            for (var i = 0; i < body.Ids.Count; i++)
            {
                var targetId = body.Ids[i];
                var match = items.FirstOrDefault(item => item.Id == targetId);
                if (match is not null) match.SortOrder = i;
            }
            profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
        }
        return Ok();
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Custom Sections
    // -----------------------------------------------------------------------------------------------------------------

    [HttpPost("custom-sections")]
    public async Task<ActionResult<CustomSectionDto>> AddCustomSection([FromBody] CustomSectionRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "title", body.Title, 128);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var section = new CustomSection
        {
            Id = Guid.NewGuid(),
            ProfileId = profile.Id,
            Title = body.Title!.Trim(),
            SortOrder = body.SortOrder,
            CreatedAt = time.GetUtcNow().UtcDateTime,
            UpdatedAt = time.GetUtcNow().UtcDateTime,
        };

        db.CustomSections.Add(section);
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return Created($"/api/profile/custom-sections/{section.Id}", CustomSectionDto.From(section));
    }

    [HttpPut("custom-sections/{id:guid}")]
    public async Task<ActionResult<CustomSectionDto>> UpdateCustomSection(Guid id, [FromBody] CustomSectionRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "title", body.Title, 128);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var section = await db.CustomSections.Include(s => s.Items).FirstOrDefaultAsync(s => s.Id == id && s.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("custom_section.not_found", "The specified custom section was not found.");

        section.Title = body.Title!.Trim();
        section.SortOrder = body.SortOrder;
        section.UpdatedAt = time.GetUtcNow().UtcDateTime;
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return CustomSectionDto.From(section);
    }

    [HttpDelete("custom-sections/{id:guid}")]
    public async Task<IActionResult> DeleteCustomSection(Guid id, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        var section = await db.CustomSections.FirstOrDefaultAsync(s => s.Id == id && s.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("custom_section.not_found", "The specified custom section was not found.");

        db.CustomSections.Remove(section);
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPut("custom-sections/reorder")]
    public async Task<IActionResult> ReorderCustomSections([FromBody] ReorderRequest body, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        if (body.Ids is not null)
        {
            var items = await db.CustomSections.Where(s => s.ProfileId == profile.Id).ToListAsync(ct);
            for (var i = 0; i < body.Ids.Count; i++)
            {
                var targetId = body.Ids[i];
                var match = items.FirstOrDefault(item => item.Id == targetId);
                if (match is not null) match.SortOrder = i;
            }
            profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
        }
        return Ok();
    }

    [HttpPost("custom-sections/{sectionId:guid}/items")]
    public async Task<ActionResult<CustomSectionItemDto>> AddCustomSectionItem(Guid sectionId, [FromBody] CustomSectionItemRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "title", body.Title, 128);
        InputRules.Optional(errors, "subtitle", body.Subtitle, 128);
        InputRules.Optional(errors, "dateRange", body.DateRange, 64);
        InputRules.Optional(errors, "description", body.Description, 4096);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var section = await db.CustomSections.FirstOrDefaultAsync(s => s.Id == sectionId && s.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("custom_section.not_found", "The specified custom section was not found.");

        var item = new CustomSectionItem
        {
            Id = Guid.NewGuid(),
            SectionId = section.Id,
            Title = body.Title!.Trim(),
            Subtitle = body.Subtitle?.Trim(),
            DateRange = body.DateRange?.Trim(),
            Description = body.Description?.Trim(),
            SortOrder = body.SortOrder,
            CreatedAt = time.GetUtcNow().UtcDateTime,
            UpdatedAt = time.GetUtcNow().UtcDateTime,
        };

        db.CustomSectionItems.Add(item);
        section.UpdatedAt = time.GetUtcNow().UtcDateTime;
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return Created($"/api/profile/custom-sections/{section.Id}/items/{item.Id}", CustomSectionItemDto.From(item));
    }

    [HttpPut("custom-sections/{sectionId:guid}/items/{id:guid}")]
    public async Task<ActionResult<CustomSectionItemDto>> UpdateCustomSectionItem(Guid sectionId, Guid id, [FromBody] CustomSectionItemRequest body, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Required(errors, "title", body.Title, 128);
        InputRules.Optional(errors, "subtitle", body.Subtitle, 128);
        InputRules.Optional(errors, "dateRange", body.DateRange, 64);
        InputRules.Optional(errors, "description", body.Description, 4096);
        errors.ThrowIfAny();

        var profile = await GetOrCreateProfileAsync(ct);
        var section = await db.CustomSections.FirstOrDefaultAsync(s => s.Id == sectionId && s.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("custom_section.not_found", "The specified custom section was not found.");

        var item = await db.CustomSectionItems.FirstOrDefaultAsync(i => i.Id == id && i.SectionId == section.Id, ct)
            ?? throw ApiException.NotFound("custom_section_item.not_found", "The specified custom section item was not found.");

        item.Title = body.Title!.Trim();
        item.Subtitle = body.Subtitle?.Trim();
        item.DateRange = body.DateRange?.Trim();
        item.Description = body.Description?.Trim();
        item.SortOrder = body.SortOrder;
        item.UpdatedAt = time.GetUtcNow().UtcDateTime;
        section.UpdatedAt = time.GetUtcNow().UtcDateTime;
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;

        await db.SaveChangesAsync(ct);
        return CustomSectionItemDto.From(item);
    }

    [HttpDelete("custom-sections/{sectionId:guid}/items/{id:guid}")]
    public async Task<IActionResult> DeleteCustomSectionItem(Guid sectionId, Guid id, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        var section = await db.CustomSections.FirstOrDefaultAsync(s => s.Id == sectionId && s.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("custom_section.not_found", "The specified custom section was not found.");

        var item = await db.CustomSectionItems.FirstOrDefaultAsync(i => i.Id == id && i.SectionId == section.Id, ct)
            ?? throw ApiException.NotFound("custom_section_item.not_found", "The specified custom section item was not found.");

        db.CustomSectionItems.Remove(item);
        section.UpdatedAt = time.GetUtcNow().UtcDateTime;
        profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);

        return NoContent();
    }

    [HttpPut("custom-sections/{sectionId:guid}/items/reorder")]
    public async Task<IActionResult> ReorderCustomSectionItems(Guid sectionId, [FromBody] ReorderRequest body, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        var section = await db.CustomSections.FirstOrDefaultAsync(s => s.Id == sectionId && s.ProfileId == profile.Id, ct)
            ?? throw ApiException.NotFound("custom_section.not_found", "The specified custom section was not found.");

        if (body.Ids is not null)
        {
            var items = await db.CustomSectionItems.Where(i => i.SectionId == section.Id).ToListAsync(ct);
            for (var i = 0; i < body.Ids.Count; i++)
            {
                var targetId = body.Ids[i];
                var match = items.FirstOrDefault(item => item.Id == targetId);
                if (match is not null) match.SortOrder = i;
            }
            section.UpdatedAt = time.GetUtcNow().UtcDateTime;
            profile.UpdatedAt = time.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
        }
        return Ok();
    }

    // -----------------------------------------------------------------------------------------------------------------
    // PDF Document Generation (Preview & Export)
    // -----------------------------------------------------------------------------------------------------------------

    [HttpPost("preview/pdf")]
    public async Task<IActionResult> PreviewPdf([FromBody] Documents.CvRenderOptions? options, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        var opts = options ?? new Documents.CvRenderOptions(null, null, null, null, null, null);
        var photoPath = !string.IsNullOrEmpty(profile.PhotoPath) ? Path.Combine(settings.DataDirectory, profile.PhotoPath) : null;
        var pdfBytes = renderer.RenderPdf(ProfileResponse.From(profile), opts, photoPath);
        return File(pdfBytes, "application/pdf");
    }

    [HttpPost("export/pdf")]
    public async Task<IActionResult> ExportPdf([FromBody] Documents.CvRenderOptions? options, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        var opts = options ?? new Documents.CvRenderOptions(null, null, null, null, null, null);
        var photoPath = !string.IsNullOrEmpty(profile.PhotoPath) ? Path.Combine(settings.DataDirectory, profile.PhotoPath) : null;
        var pdfBytes = renderer.RenderPdf(ProfileResponse.From(profile), opts, photoPath);

        var first = SanitizeFilename(profile.FirstName);
        var last = SanitizeFilename(profile.LastName);
        var prefix = opts.NormalizedLanguage == "en" ? "Resume" : "Lebenslauf";
        var filename = (!string.IsNullOrEmpty(first) || !string.IsNullOrEmpty(last))
            ? $"{prefix}_{first}_{last}.pdf"
            : $"{prefix}.pdf";

        return File(pdfBytes, "application/pdf", filename);
    }

    [HttpPost("export/docx")]
    public async Task<IActionResult> ExportDocx([FromBody] Documents.CvRenderOptions? options, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        var opts = options ?? new Documents.CvRenderOptions(null, null, null, null, null, null);
        var docxBytes = docxRenderer.RenderCvDocx(ProfileResponse.From(profile), opts);

        var first = SanitizeFilename(profile.FirstName);
        var last = SanitizeFilename(profile.LastName);
        var prefix = opts.NormalizedLanguage == "en" ? "Resume" : "Lebenslauf";
        var filename = (!string.IsNullOrEmpty(first) || !string.IsNullOrEmpty(last))
            ? $"{prefix}_{first}_{last}.docx"
            : $"{prefix}.docx";

        return File(docxBytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename);
    }

    [HttpPost("preview/cover-sheet/pdf")]
    public async Task<IActionResult> PreviewCoverSheetPdf([FromBody] Documents.CoverSheetOptions? options, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        var opts = options ?? new Documents.CoverSheetOptions(null, null, null, null, null, null, null, null);
        var photoPath = !string.IsNullOrEmpty(profile.PhotoPath) ? Path.Combine(settings.DataDirectory, profile.PhotoPath) : null;
        var pdfBytes = renderer.RenderCoverSheetPdf(ProfileResponse.From(profile), opts, photoPath);
        return File(pdfBytes, "application/pdf");
    }

    [HttpPost("export/cover-sheet/pdf")]
    public async Task<IActionResult> ExportCoverSheetPdf([FromBody] Documents.CoverSheetOptions? options, CancellationToken ct)
    {
        var profile = await GetOrCreateProfileAsync(ct);
        var opts = options ?? new Documents.CoverSheetOptions(null, null, null, null, null, null, null, null);
        var photoPath = !string.IsNullOrEmpty(profile.PhotoPath) ? Path.Combine(settings.DataDirectory, profile.PhotoPath) : null;
        var pdfBytes = renderer.RenderCoverSheetPdf(ProfileResponse.From(profile), opts, photoPath);

        var first = SanitizeFilename(profile.FirstName);
        var last = SanitizeFilename(profile.LastName);
        var prefix = opts.NormalizedLanguage == "en" ? "CoverSheet" : "Deckblatt";
        var filename = (!string.IsNullOrEmpty(first) || !string.IsNullOrEmpty(last))
            ? $"{prefix}_{first}_{last}.pdf"
            : $"{prefix}.pdf";

        return File(pdfBytes, "application/pdf", filename);
    }

    private static string SanitizeFilename(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return string.Empty;
        var safe = new string(input.Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_').ToArray());
        return safe.Trim();
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Helper: Load or initialize the master profile
    // -----------------------------------------------------------------------------------------------------------------

    private async Task<UserProfile> GetOrCreateProfileAsync(CancellationToken ct)
    {
        var userId = User.RequiredUserId();
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

        // Split DisplayName into first/last name as an initial hint
        var words = user.DisplayName.Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
        var firstName = words.Length > 0 ? words[0] : "";
        var lastName = words.Length > 1 ? string.Join(" ", words.Skip(1)) : "";

        profile = new UserProfile
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            FirstName = firstName,
            LastName = lastName,
            CreatedAt = time.GetUtcNow().UtcDateTime,
            UpdatedAt = time.GetUtcNow().UtcDateTime,
        };

        db.Profiles.Add(profile);
        await db.SaveChangesAsync(ct);

        return profile;
    }
}
