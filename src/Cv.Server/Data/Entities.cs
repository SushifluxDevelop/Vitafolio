namespace Cv.Server.Data;

public static class Roles
{
    public const string Admin = "admin";
    public const string User = "user";

    public static bool IsValid(string? role) => role is Admin or User;
}

/// <summary>An account. Server mode: created by setup, by an admin or by self-registration. Desktop mode: the one local owner.</summary>
public sealed class User
{
    public Guid Id { get; set; }

    /// <summary>As entered (shown in the UI).</summary>
    public string Username { get; set; } = "";

    /// <summary>Lower-case form, unique - usernames are case-insensitive.</summary>
    public string NormalizedUsername { get; set; } = "";

    public string DisplayName { get; set; } = "";

    public string Role { get; set; } = Roles.User;

    /// <summary>Framework PasswordHasher output; empty for the desktop owner (who never signs in).</summary>
    public string PasswordHash { get; set; } = "";

    public bool Disabled { get; set; }

    /// <summary>The automatically created owner account of the Windows program.</summary>
    public bool IsLocalOwner { get; set; }

    public bool TotpEnabled { get; set; }

    /// <summary>The confirmed TOTP secret, encrypted with ASP.NET Core Data Protection (key ring in the data directory).</summary>
    public string? TotpSecretProtected { get; set; }

    /// <summary>A secret created by "setup" and not yet confirmed with a code.</summary>
    public string? TotpPendingSecretProtected { get; set; }

    /// <summary>The last accepted TOTP time step: a code of this or an earlier step is never accepted again (replay protection).</summary>
    public long? TotpLastUsedStep { get; set; }

    /// <summary>"de" | "en"; null = not chosen yet (the UI follows the browser).</summary>
    public string? Language { get; set; }

    /// <summary>"system" | "light" | "dark".</summary>
    public string Theme { get; set; } = "system";

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? LastLoginAt { get; set; }

    public List<RecoveryCode> RecoveryCodes { get; set; } = [];

    public List<Session> Sessions { get; set; } = [];

    public UserProfile? Profile { get; set; }

    public List<CoverLetter> CoverLetters { get; set; } = [];
}

/// <summary>One 2FA recovery code (SHA-256 hash of a high-entropy random code), usable once.</summary>
public sealed class RecoveryCode
{
    public long Id { get; set; }

    public Guid UserId { get; set; }

    public User? User { get; set; }

    public string CodeHash { get; set; } = "";

    public DateTime CreatedAt { get; set; }

    public DateTime? UsedAt { get; set; }
}

/// <summary>
/// A sign-in on one device = one refresh-token family. Every refresh rotates the token; presenting an already rotated token again
/// revokes the whole session (the token was probably stolen).
/// </summary>
public sealed class Session
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public User? User { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime LastUsedAt { get; set; }

    /// <summary>Sliding: moved forward by every refresh.</summary>
    public DateTime ExpiresAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    /// <summary>logout | revoked | refresh_reuse | password_changed | user_disabled | password_set.</summary>
    public string? RevokedReason { get; set; }

    public string? Ip { get; set; }

    public string? UserAgent { get; set; }

    public List<RefreshToken> RefreshTokens { get; set; } = [];
}

/// <summary>One refresh token of a session (only its SHA-256 hash is stored).</summary>
public sealed class RefreshToken
{
    public long Id { get; set; }

    public Guid SessionId { get; set; }

    public Session? Session { get; set; }

    public string TokenHash { get; set; } = "";

    public DateTime CreatedAt { get; set; }

    /// <summary>Set when the token was exchanged for a new one; a later use of this token is a reuse.</summary>
    public DateTime? RotatedAt { get; set; }
}

/// <summary>An instance-wide setting edited by admins (key/value, value as text).</summary>
public sealed class AppSetting
{
    public string Key { get; set; } = "";

    public string Value { get; set; } = "";

    public DateTime UpdatedAt { get; set; }
}

/// <summary>Append-only record of who did what (no foreign key to the user: entries outlive deleted accounts).</summary>
public sealed class ActivityEntry
{
    public long Id { get; set; }

    public DateTime At { get; set; }

    public Guid? ActorId { get; set; }

    public string? ActorName { get; set; }

    public string Action { get; set; } = "";

    public string? Target { get; set; }

    public string? Ip { get; set; }

    /// <summary>A JSON object, or null.</summary>
    public string? Details { get; set; }
}

/// <summary>Master profile for a user containing personal details, contact info, bio and photo.</summary>
public sealed class UserProfile
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public User? User { get; set; }

    public string FirstName { get; set; } = "";

    public string LastName { get; set; } = "";

    public string? AcademicTitle { get; set; }

    public string? ProfessionalTitle { get; set; }

    public string? Email { get; set; }

    public string? Phone { get; set; }

    public string? Street { get; set; }

    public string? PostalCode { get; set; }

    public string? City { get; set; }

    public string? Country { get; set; }

    public string? DateOfBirth { get; set; }

    public string? PlaceOfBirth { get; set; }

    public string? Nationality { get; set; }

    public string? MaritalStatus { get; set; }

    public string? Website { get; set; }

    public string? LinkedIn { get; set; }

    public string? GitHub { get; set; }

    public string? Xing { get; set; }

    public string? Bio { get; set; }

    public string? PhotoPath { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public List<Experience> Experiences { get; set; } = [];

    public List<Education> Educations { get; set; } = [];

    public List<Skill> Skills { get; set; } = [];

    public List<LanguageSkill> Languages { get; set; } = [];

    public List<Certificate> Certificates { get; set; } = [];

    public List<Interest> Interests { get; set; } = [];

    public List<CustomSection> CustomSections { get; set; } = [];
}

/// <summary>A work experience station (Berufserfahrung).</summary>
public sealed class Experience
{
    public Guid Id { get; set; }

    public Guid ProfileId { get; set; }

    public UserProfile? Profile { get; set; }

    public string JobTitle { get; set; } = "";

    public string Employer { get; set; } = "";

    public string? EmploymentType { get; set; }

    public string? City { get; set; }

    public string? Country { get; set; }

    public string StartDate { get; set; } = "";

    public string? EndDate { get; set; }

    public bool IsCurrent { get; set; }

    public string? Description { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

/// <summary>An educational milestone (Ausbildung / Studium / Schule).</summary>
public sealed class Education
{
    public Guid Id { get; set; }

    public Guid ProfileId { get; set; }

    public UserProfile? Profile { get; set; }

    public string Degree { get; set; } = "";

    public string? FieldOfStudy { get; set; }

    public string Institution { get; set; } = "";

    public string? City { get; set; }

    public string? Country { get; set; }

    public string StartDate { get; set; } = "";

    public string? EndDate { get; set; }

    public bool IsCurrent { get; set; }

    public string? Grade { get; set; }

    public string? Description { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

/// <summary>A skill or competence with rating level 1-5.</summary>
public sealed class Skill
{
    public Guid Id { get; set; }

    public Guid ProfileId { get; set; }

    public UserProfile? Profile { get; set; }

    public string Name { get; set; } = "";

    public string? Category { get; set; }

    public int Level { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

/// <summary>A language skill with CEFR level (A1-C2 / native).</summary>
public sealed class LanguageSkill
{
    public Guid Id { get; set; }

    public Guid ProfileId { get; set; }

    public UserProfile? Profile { get; set; }

    public string Language { get; set; } = "";

    public string Level { get; set; } = "";

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

/// <summary>A certificate or training credential.</summary>
public sealed class Certificate
{
    public Guid Id { get; set; }

    public Guid ProfileId { get; set; }

    public UserProfile? Profile { get; set; }

    public string Title { get; set; } = "";

    public string? Issuer { get; set; }

    public string? IssueDate { get; set; }

    public string? ExpiryDate { get; set; }

    public string? CredentialUrl { get; set; }

    public string? CredentialId { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

/// <summary>An interest, hobby, volunteer role or driver license.</summary>
public sealed class Interest
{
    public Guid Id { get; set; }

    public Guid ProfileId { get; set; }

    public UserProfile? Profile { get; set; }

    public string Name { get; set; } = "";

    public string? Category { get; set; }

    public string? Description { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

/// <summary>A custom resume section with user-defined title.</summary>
public sealed class CustomSection
{
    public Guid Id { get; set; }

    public Guid ProfileId { get; set; }

    public UserProfile? Profile { get; set; }

    public string Title { get; set; } = "";

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public List<CustomSectionItem> Items { get; set; } = [];
}

/// <summary>An entry within a custom resume section.</summary>
public sealed class CustomSectionItem
{
    public Guid Id { get; set; }

    public Guid SectionId { get; set; }

    public CustomSection? Section { get; set; }

    public string Title { get; set; } = "";

    public string? Subtitle { get; set; }

    public string? DateRange { get; set; }

    public string? Description { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

/// <summary>A cover letter (Anschreiben) adhering to DIN 5008 standards.</summary>
public sealed class CoverLetter
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public User? User { get; set; }

    public string Title { get; set; } = "";

    // Sender information (Absender)
    public string? SenderName { get; set; }
    public string? SenderStreet { get; set; }
    public string? SenderPostalCode { get; set; }
    public string? SenderCity { get; set; }
    public string? SenderPhone { get; set; }
    public string? SenderEmail { get; set; }

    // Recipient information (Empfänger nach DIN 5008)
    public string RecipientCompany { get; set; } = "";
    public string? RecipientDepartment { get; set; }
    public string? RecipientContactPerson { get; set; }
    public string? RecipientStreet { get; set; }
    public string? RecipientPostalCode { get; set; }
    public string RecipientCity { get; set; } = "";
    public string? RecipientCountry { get; set; }

    // Letter content
    public string? Place { get; set; }
    public string? Date { get; set; }
    public string Subject { get; set; } = "";
    public string Salutation { get; set; } = "";
    public string Body { get; set; } = "";
    public string Closing { get; set; } = "";
    public string? SignatureName { get; set; }
    public string? SignaturePath { get; set; }
    public string? AttachmentsNote { get; set; }

    // Options
    public string Language { get; set; } = "de";
    public string? Font { get; set; }
    public string? AccentColor { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
