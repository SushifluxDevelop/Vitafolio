using Cv.Server.Data;

namespace Cv.Server.Controllers;

// Request bodies: every property is nullable so that a missing value becomes our own "validation.required" field error
// (instead of the framework's generic model-binding message).

public sealed record SetupRequest(string? Username, string? DisplayName, string? Password, string? SetupToken = null);

public sealed record LoginRequest(string? Username, string? Password);

public sealed record LoginTwoFactorRequest(string? ChallengeId, string? Code);

public sealed record PreferencesRequest(string? Language, string? Theme);

public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

/// <summary><see cref="CurrentPassword"/> is needed unless the instance forces 2FA and the session is fresh (see AccountController.TotpEnable).</summary>
public sealed record TotpEnableRequest(string? Code, string? CurrentPassword = null);

public sealed record TwoFactorDisableRequest(string? Password, string? Code);

public sealed record CreateUserRequest(string? Username, string? DisplayName, string? Password, string? Role);

public sealed record UpdateUserRequest(string? DisplayName, string? Role, bool? Disabled);

public sealed record SetPasswordRequest(string? NewPassword);

public sealed record EmergencyResetConfirmRequest(string? Code, string? NewPassword);

public sealed record SettingsRequest(bool? RegistrationOpen, bool? RequireTwoFactor);

// Responses

/// <summary>The signed-in user as the UI sees it (<c>/api/auth/me</c> and every sign-in answer).</summary>
public sealed record UserDto(string Id, string Username, string DisplayName, string Role, bool TwoFactorEnabled, bool MustSetupTwoFactor,
    string? Language, string Theme)
{
    public static UserDto From(User user, bool requireTwoFactor) => new(user.Id.ToString(), user.Username, user.DisplayName, user.Role,
        user.TotpEnabled, requireTwoFactor && !user.TotpEnabled && !user.IsLocalOwner, user.Language, user.Theme);
}

public sealed record UserResponse(UserDto User);

/// <summary>An account in the admin list.</summary>
public sealed record AdminUserDto(string Id, string Username, string DisplayName, string Role, bool Disabled, bool TwoFactorEnabled,
    DateTime CreatedAt, DateTime? LastLoginAt)
{
    public static AdminUserDto From(User user) => new(user.Id.ToString(), user.Username, user.DisplayName, user.Role, user.Disabled,
        user.TotpEnabled, user.CreatedAt, user.LastLoginAt);
}

public sealed record SessionDto(string Id, DateTime CreatedAt, DateTime LastUsedAt, string? Ip, string? UserAgent, bool Current);

/// <summary>Step-up credentials (server mode; ignored in desktop mode).</summary>
public sealed record StepUpRequest(string? Password, string? Code);
