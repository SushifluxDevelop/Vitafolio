using System.Security.Cryptography;
using Cv.Server.Data;
using Cv.Server.Errors;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Services;

/// <summary>Creating accounts and checking passwords - shared by setup, registration and the admin area.</summary>
public sealed class Accounts(AppDbContext db, IPasswordHasher<User> hasher, TimeProvider time)
{
    // Verified against for unknown usernames, so a wrong username takes as long as a wrong password
    private static readonly Lazy<string> DummyHash = new(() =>
        new PasswordHasher<User>().HashPassword(new User(), Convert.ToBase64String(RandomNumberGenerator.GetBytes(24))));

    public static string Normalize(string username) => username.Trim().ToLowerInvariant();

    /// <summary>Validates the input, checks the username is free and adds the account (not saved yet).</summary>
    public async Task<User> CreateAsync(string? username, string? displayName, string? password, string role, CancellationToken ct)
    {
        var errors = new FieldErrors();
        InputRules.Username(errors, "username", username);
        InputRules.DisplayName(errors, "displayName", displayName);
        InputRules.Password(errors, "password", password);
        errors.ThrowIfAny();

        var normalized = Normalize(username!);
        if (await db.Users.AnyAsync(u => u.NormalizedUsername == normalized, ct))
        {
            throw ApiException.Field("username", "user.username_taken", "This username is already taken.", StatusCodes.Status409Conflict);
        }
        var now = time.GetUtcNow().UtcDateTime;
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username!,
            NormalizedUsername = normalized,
            DisplayName = displayName!.Trim(),
            Role = role,
            CreatedAt = now,
            UpdatedAt = now,
        };
        user.PasswordHash = hasher.HashPassword(user, password!);
        db.Users.Add(user);
        return user;
    }

    /// <summary>True when the password matches; upgrades an outdated hash format on the way (not saved yet).</summary>
    public bool CheckPassword(User? user, string password)
    {
        if (user is null || string.IsNullOrEmpty(user.PasswordHash))
        {
            hasher.VerifyHashedPassword(new User(), DummyHash.Value, password);
            return false;
        }
        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = hasher.HashPassword(user, password);
        }
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
    }

    public void SetPassword(User user, string password)
    {
        user.PasswordHash = hasher.HashPassword(user, password);
        user.UpdatedAt = time.GetUtcNow().UtcDateTime;
    }

    /// <summary>Enabled admins other than <paramref name="except"/> - the "never remove the last admin" rule.</summary>
    public Task<int> OtherActiveAdminsAsync(Guid except, CancellationToken ct) =>
        db.Users.CountAsync(u => u.Role == Roles.Admin && !u.Disabled && u.Id != except, ct);
}
