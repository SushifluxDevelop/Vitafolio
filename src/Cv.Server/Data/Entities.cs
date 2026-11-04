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
