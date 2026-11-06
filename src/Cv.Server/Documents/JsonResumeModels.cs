// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using System.Text.Json.Serialization;
using Cv.Server.Controllers;
using Cv.Server.Data;

namespace Cv.Server.Documents;

/// <summary>
/// Models conforming to the open standard JSON Resume Schema (v1.0.0).
/// https://jsonresume.org/schema/
/// </summary>
public sealed class JsonResumeDto
{
    [JsonPropertyName("$schema")]
    public string? Schema { get; set; } = "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json";

    [JsonPropertyName("basics")]
    public JsonResumeBasics? Basics { get; set; }

    [JsonPropertyName("work")]
    public List<JsonResumeWork>? Work { get; set; }

    [JsonPropertyName("education")]
    public List<JsonResumeEducation>? Education { get; set; }

    [JsonPropertyName("skills")]
    public List<JsonResumeSkill>? Skills { get; set; }

    [JsonPropertyName("languages")]
    public List<JsonResumeLanguage>? Languages { get; set; }

    [JsonPropertyName("certificates")]
    public List<JsonResumeCertificate>? Certificates { get; set; }

    [JsonPropertyName("interests")]
    public List<JsonResumeInterest>? Interests { get; set; }
}

public sealed class JsonResumeBasics
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("label")]
    public string? Label { get; set; }

    [JsonPropertyName("image")]
    public string? Image { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("url")]
    public string? Url { get; set; }

    [JsonPropertyName("summary")]
    public string? Summary { get; set; }

    [JsonPropertyName("location")]
    public JsonResumeLocation? Location { get; set; }

    [JsonPropertyName("profiles")]
    public List<JsonResumeProfile>? Profiles { get; set; }
}

public sealed class JsonResumeLocation
{
    [JsonPropertyName("address")]
    public string? Address { get; set; }

    [JsonPropertyName("postalCode")]
    public string? PostalCode { get; set; }

    [JsonPropertyName("city")]
    public string? City { get; set; }

    [JsonPropertyName("countryCode")]
    public string? CountryCode { get; set; }

    [JsonPropertyName("region")]
    public string? Region { get; set; }
}

public sealed class JsonResumeProfile
{
    [JsonPropertyName("network")]
    public string? Network { get; set; }

    [JsonPropertyName("username")]
    public string? Username { get; set; }

    [JsonPropertyName("url")]
    public string? Url { get; set; }
}

public sealed class JsonResumeWork
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("position")]
    public string? Position { get; set; }

    [JsonPropertyName("url")]
    public string? Url { get; set; }

    [JsonPropertyName("startDate")]
    public string? StartDate { get; set; }

    [JsonPropertyName("endDate")]
    public string? EndDate { get; set; }

    [JsonPropertyName("summary")]
    public string? Summary { get; set; }

    [JsonPropertyName("highlights")]
    public List<string>? Highlights { get; set; }
}

public sealed class JsonResumeEducation
{
    [JsonPropertyName("institution")]
    public string? Institution { get; set; }

    [JsonPropertyName("url")]
    public string? Url { get; set; }

    [JsonPropertyName("area")]
    public string? Area { get; set; }

    [JsonPropertyName("studyType")]
    public string? StudyType { get; set; }

    [JsonPropertyName("startDate")]
    public string? StartDate { get; set; }

    [JsonPropertyName("endDate")]
    public string? EndDate { get; set; }

    [JsonPropertyName("score")]
    public string? Score { get; set; }

    [JsonPropertyName("courses")]
    public List<string>? Courses { get; set; }
}

public sealed class JsonResumeSkill
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("level")]
    public string? Level { get; set; }

    [JsonPropertyName("keywords")]
    public List<string>? Keywords { get; set; }
}

public sealed class JsonResumeLanguage
{
    [JsonPropertyName("language")]
    public string? Language { get; set; }

    [JsonPropertyName("fluency")]
    public string? Fluency { get; set; }
}

public sealed class JsonResumeCertificate
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("date")]
    public string? Date { get; set; }

    [JsonPropertyName("issuer")]
    public string? Issuer { get; set; }

    [JsonPropertyName("url")]
    public string? Url { get; set; }
}

public sealed class JsonResumeInterest
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("keywords")]
    public List<string>? Keywords { get; set; }
}

/// <summary>
/// Bi-directional mapper between Vitafolio Profile and JSON Resume standard format.
/// </summary>
public static class JsonResumeConverter
{
    public static JsonResumeDto ToJsonResume(ProfileResponse profile)
    {
        var resume = new JsonResumeDto
        {
            Basics = new JsonResumeBasics
            {
                Name = $"{profile.FirstName} {profile.LastName}".Trim(),
                Label = profile.ProfessionalTitle,
                Email = profile.Email,
                Phone = profile.Phone,
                Url = profile.Website,
                Summary = profile.Bio,
                Location = new JsonResumeLocation
                {
                    Address = profile.Street,
                    PostalCode = profile.PostalCode,
                    City = profile.City,
                    CountryCode = profile.Country
                },
                Profiles = []
            },
            Work = [],
            Education = [],
            Skills = [],
            Languages = [],
            Certificates = [],
            Interests = []
        };

        if (!string.IsNullOrWhiteSpace(profile.LinkedIn))
        {
            resume.Basics.Profiles.Add(new JsonResumeProfile { Network = "LinkedIn", Url = profile.LinkedIn });
        }
        if (!string.IsNullOrWhiteSpace(profile.GitHub))
        {
            resume.Basics.Profiles.Add(new JsonResumeProfile { Network = "GitHub", Url = profile.GitHub });
        }
        if (!string.IsNullOrWhiteSpace(profile.Xing))
        {
            resume.Basics.Profiles.Add(new JsonResumeProfile { Network = "XING", Url = profile.Xing });
        }

        foreach (var exp in profile.Experiences)
        {
            resume.Work.Add(new JsonResumeWork
            {
                Name = exp.Employer,
                Position = exp.JobTitle,
                StartDate = exp.StartDate,
                EndDate = exp.IsCurrent ? null : exp.EndDate,
                Summary = exp.Description
            });
        }

        foreach (var edu in profile.Educations)
        {
            resume.Education.Add(new JsonResumeEducation
            {
                Institution = edu.Institution,
                StudyType = edu.Degree,
                Area = edu.FieldOfStudy,
                StartDate = edu.StartDate,
                EndDate = edu.IsCurrent ? null : edu.EndDate,
                Score = edu.Grade,
                Courses = string.IsNullOrWhiteSpace(edu.Description)
                    ? []
                    : edu.Description.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList()
            });
        }

        // Map numeric skill level (1-5) to JSON Resume labels
        foreach (var skill in profile.Skills)
        {
            string skillLevel = skill.Level switch
            {
                5 => "Master",
                4 => "Expert",
                3 => "Advanced",
                2 => "Intermediate",
                _ => "Beginner"
            };

            resume.Skills.Add(new JsonResumeSkill
            {
                Name = skill.Name,
                Level = skillLevel,
                Keywords = string.IsNullOrWhiteSpace(skill.Category) ? [] : [skill.Category]
            });
        }

        foreach (var lang in profile.Languages)
        {
            resume.Languages.Add(new JsonResumeLanguage
            {
                Language = lang.Language,
                Fluency = lang.Level
            });
        }

        foreach (var cert in profile.Certificates)
        {
            resume.Certificates.Add(new JsonResumeCertificate
            {
                Name = cert.Title,
                Issuer = cert.Issuer,
                Date = cert.IssueDate
            });
        }

        foreach (var interest in profile.Interests)
        {
            resume.Interests.Add(new JsonResumeInterest
            {
                Name = interest.Name
            });
        }

        return resume;
    }

    public static void ApplyJsonResume(AppDbContext db, UserProfile profile, JsonResumeDto resume, TimeProvider time, bool replaceExisting = false)
    {
        var now = time.GetUtcNow().UtcDateTime;

        if (resume.Basics != null)
        {
            var basics = resume.Basics;
            if (!string.IsNullOrWhiteSpace(basics.Name))
            {
                var parts = basics.Name.Trim().Split(' ', 2);
                profile.FirstName = parts[0];
                profile.LastName = parts.Length > 1 ? parts[1] : string.Empty;
            }

            if (!string.IsNullOrWhiteSpace(basics.Label)) profile.ProfessionalTitle = basics.Label;
            if (!string.IsNullOrWhiteSpace(basics.Email)) profile.Email = basics.Email;
            if (!string.IsNullOrWhiteSpace(basics.Phone)) profile.Phone = basics.Phone;
            if (!string.IsNullOrWhiteSpace(basics.Url)) profile.Website = basics.Url;
            if (!string.IsNullOrWhiteSpace(basics.Summary)) profile.Bio = basics.Summary;

            if (basics.Location != null)
            {
                if (!string.IsNullOrWhiteSpace(basics.Location.Address)) profile.Street = basics.Location.Address;
                if (!string.IsNullOrWhiteSpace(basics.Location.PostalCode)) profile.PostalCode = basics.Location.PostalCode;
                if (!string.IsNullOrWhiteSpace(basics.Location.City)) profile.City = basics.Location.City;
                if (!string.IsNullOrWhiteSpace(basics.Location.CountryCode)) profile.Country = basics.Location.CountryCode;
            }

            if (basics.Profiles != null)
            {
                foreach (var p in basics.Profiles)
                {
                    if (string.Equals(p.Network, "LinkedIn", StringComparison.OrdinalIgnoreCase)) profile.LinkedIn = p.Url;
                    else if (string.Equals(p.Network, "GitHub", StringComparison.OrdinalIgnoreCase)) profile.GitHub = p.Url;
                    else if (string.Equals(p.Network, "Xing", StringComparison.OrdinalIgnoreCase)) profile.Xing = p.Url;
                }
            }
        }

        if (replaceExisting)
        {
            db.Experiences.RemoveRange(profile.Experiences);
            profile.Experiences.Clear();

            db.Educations.RemoveRange(profile.Educations);
            profile.Educations.Clear();

            db.Skills.RemoveRange(profile.Skills);
            profile.Skills.Clear();

            db.Languages.RemoveRange(profile.Languages);
            profile.Languages.Clear();

            db.Certificates.RemoveRange(profile.Certificates);
            profile.Certificates.Clear();

            db.Interests.RemoveRange(profile.Interests);
            profile.Interests.Clear();
        }

        if (resume.Work != null && resume.Work.Count > 0)
        {
            int order = profile.Experiences.Count;
            foreach (var w in resume.Work)
            {
                if (string.IsNullOrWhiteSpace(w.Name) && string.IsNullOrWhiteSpace(w.Position)) continue;

                var highlightsText = w.Highlights != null && w.Highlights.Count > 0
                    ? string.Join("\n", w.Highlights)
                    : null;
                var fullDesc = string.Join("\n", new[] { w.Summary, highlightsText }.Where(s => !string.IsNullOrWhiteSpace(s)));

                var exp = new Experience
                {
                    Id = Guid.NewGuid(),
                    ProfileId = profile.Id,
                    Employer = w.Name ?? string.Empty,
                    JobTitle = w.Position ?? string.Empty,
                    StartDate = w.StartDate ?? string.Empty,
                    EndDate = w.EndDate,
                    IsCurrent = string.IsNullOrWhiteSpace(w.EndDate),
                    Description = fullDesc,
                    SortOrder = order++,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                db.Experiences.Add(exp);
            }
        }

        if (resume.Education != null && resume.Education.Count > 0)
        {
            int order = profile.Educations.Count;
            foreach (var e in resume.Education)
            {
                if (string.IsNullOrWhiteSpace(e.Institution) && string.IsNullOrWhiteSpace(e.StudyType)) continue;

                var edu = new Education
                {
                    Id = Guid.NewGuid(),
                    ProfileId = profile.Id,
                    Institution = e.Institution ?? string.Empty,
                    Degree = e.StudyType ?? "Abschluss",
                    FieldOfStudy = e.Area,
                    StartDate = e.StartDate ?? string.Empty,
                    EndDate = e.EndDate,
                    IsCurrent = string.IsNullOrWhiteSpace(e.EndDate),
                    Grade = e.Score,
                    SortOrder = order++,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                db.Educations.Add(edu);
            }
        }

        if (resume.Skills != null && resume.Skills.Count > 0)
        {
            int order = profile.Skills.Count;
            foreach (var s in resume.Skills)
            {
                if (string.IsNullOrWhiteSpace(s.Name)) continue;

                int level = s.Level?.ToLowerInvariant() switch
                {
                    "master" => 5,
                    "expert" => 4,
                    "advanced" => 3,
                    "intermediate" => 2,
                    _ => 1
                };

                string? category = s.Keywords != null && s.Keywords.Count > 0 ? s.Keywords[0] : null;

                var skill = new Skill
                {
                    Id = Guid.NewGuid(),
                    ProfileId = profile.Id,
                    Name = s.Name,
                    Category = category,
                    Level = level,
                    SortOrder = order++,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                db.Skills.Add(skill);
            }
        }

        if (resume.Languages != null && resume.Languages.Count > 0)
        {
            int order = profile.Languages.Count;
            foreach (var l in resume.Languages)
            {
                if (string.IsNullOrWhiteSpace(l.Language)) continue;

                var lang = new LanguageSkill
                {
                    Id = Guid.NewGuid(),
                    ProfileId = profile.Id,
                    Language = l.Language,
                    Level = l.Fluency ?? "Gute Kenntnisse",
                    SortOrder = order++,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                db.Languages.Add(lang);
            }
        }

        if (resume.Certificates != null && resume.Certificates.Count > 0)
        {
            int order = profile.Certificates.Count;
            foreach (var c in resume.Certificates)
            {
                if (string.IsNullOrWhiteSpace(c.Name)) continue;

                var cert = new Certificate
                {
                    Id = Guid.NewGuid(),
                    ProfileId = profile.Id,
                    Title = c.Name,
                    Issuer = c.Issuer,
                    IssueDate = c.Date,
                    SortOrder = order++,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                db.Certificates.Add(cert);
            }
        }

        if (resume.Interests != null && resume.Interests.Count > 0)
        {
            int order = profile.Interests.Count;
            foreach (var i in resume.Interests)
            {
                if (string.IsNullOrWhiteSpace(i.Name)) continue;

                var interest = new Interest
                {
                    Id = Guid.NewGuid(),
                    ProfileId = profile.Id,
                    Name = i.Name,
                    SortOrder = order++,
                    CreatedAt = now,
                    UpdatedAt = now
                };
                db.Interests.Add(interest);
            }
        }

        profile.UpdatedAt = now;
    }
}
