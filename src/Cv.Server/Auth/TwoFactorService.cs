using System.Security.Cryptography;
using Cv.Server.Configuration;
using Cv.Server.Data;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Auth;

/// <summary>What a 2FA code check found.</summary>
public enum SecondFactor
{
    Invalid,

    /// <summary>A correct TOTP code whose time step was already used (login and a sensitive action within 30 seconds).</summary>
    AlreadyUsed,
    Totp,
    RecoveryCode,
}

/// <summary>
/// TOTP setup and verification plus recovery codes. Secrets are stored encrypted (Data Protection); a TOTP time step is accepted only
/// once per user (atomic update of <see cref="User.TotpLastUsedStep"/>, so two concurrent requests with one code cannot both pass);
/// recovery codes are stored as SHA-256 hashes and are single use (atomic as well).
/// </summary>
public sealed class TwoFactorService(AppDbContext db, IDataProtectionProvider protection, TimeProvider time, ILogger<TwoFactorService> logger)
{
    public const int RecoveryCodeCount = 10;

    // No 0/O, 1/l/i: easy to read off paper
    private const string RecoveryAlphabet = "abcdefghjkmnpqrstuvwxyz23456789";

    private readonly IDataProtector _protector = protection.CreateProtector("Cv.Server.TotpSecret.v1");

    /// <summary>Creates a new pending secret (replacing an earlier unconfirmed one) and returns it Base32-encoded with its otpauth URI.</summary>
    public (string Secret, string Uri) BeginSetup(User user)
    {
        var secret = Totp.NewSecret();
        user.TotpPendingSecretProtected = _protector.Protect(Convert.ToBase64String(secret));
        var base32 = Base32.Encode(secret);
        return (base32, Totp.OtpAuthUri(Branding.ProductName, user.Username, base32));
    }

    /// <summary>Confirms the pending secret with a code; on success 2FA is on and the new recovery codes are returned (shown once).</summary>
    public async Task<IReadOnlyList<string>?> ConfirmSetupAsync(User user, string code, CancellationToken ct)
    {
        if (user.TotpPendingSecretProtected is null) return null;
        var secret = Unprotect(user.TotpPendingSecretProtected);
        var step = Totp.Match(secret, Normalize(code), time.GetUtcNow());
        if (step is null) return null;

        var now = time.GetUtcNow().UtcDateTime;
        user.TotpSecretProtected = user.TotpPendingSecretProtected;
        user.TotpPendingSecretProtected = null;
        user.TotpEnabled = true;
        user.TotpLastUsedStep = step;
        user.UpdatedAt = now;
        await db.RecoveryCodes.Where(r => r.UserId == user.Id).ExecuteDeleteAsync(ct);
        var codes = new List<string>(RecoveryCodeCount);
        for (var i = 0; i < RecoveryCodeCount; i++)
        {
            var plain = NewRecoveryCode();
            codes.Add(plain);
            db.RecoveryCodes.Add(new RecoveryCode { UserId = user.Id, CodeHash = TokenService.Hash(Normalize(plain)), CreatedAt = now });
        }
        await db.SaveChangesAsync(ct);
        return codes;
    }

    /// <summary>Checks a TOTP code (6 digits) or a recovery code and consumes it. Does not save other pending changes.</summary>
    public async Task<SecondFactor> VerifyAsync(User user, string? code, CancellationToken ct)
    {
        if (!user.TotpEnabled || user.TotpSecretProtected is null || string.IsNullOrWhiteSpace(code) || code.Length > 64) return SecondFactor.Invalid;
        var normalized = Normalize(code);
        if (normalized.Length == Totp.Digits && normalized.All(char.IsAsciiDigit))
        {
            var step = Totp.Match(Unprotect(user.TotpSecretProtected), normalized, time.GetUtcNow());
            if (step is not { } matched) return SecondFactor.Invalid;
            // Replay protection: only a step newer than the last accepted one, decided by the database in one statement
            var updated = await db.Users
                .Where(u => u.Id == user.Id && (u.TotpLastUsedStep == null || u.TotpLastUsedStep < matched))
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.TotpLastUsedStep, matched), ct);
            if (updated == 0) return SecondFactor.AlreadyUsed;
            user.TotpLastUsedStep = matched;
            return SecondFactor.Totp;
        }

        var hash = TokenService.Hash(normalized);
        var now = time.GetUtcNow().UtcDateTime;
        var used = await db.RecoveryCodes
            .Where(r => r.UserId == user.Id && r.CodeHash == hash && r.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.UsedAt, now), ct);
        return used == 1 ? SecondFactor.RecoveryCode : SecondFactor.Invalid;
    }

    /// <summary>Switches 2FA off and removes the secret and all recovery codes (self-service disable, admin reset).</summary>
    public async Task DisableAsync(User user, CancellationToken ct)
    {
        user.TotpEnabled = false;
        user.TotpSecretProtected = null;
        user.TotpPendingSecretProtected = null;
        user.TotpLastUsedStep = null;
        user.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.RecoveryCodes.Where(r => r.UserId == user.Id).ExecuteDeleteAsync(ct);
    }

    /// <summary>The answer for a correct code whose time step was already used: wait for the next code.</summary>
    public static Errors.ApiException CodeAlreadyUsed(int status) => Errors.ApiException.Field("code", "twofactor.code_already_used",
        "This code was just used. Please wait for the next code of your authenticator app.", status);

    public async Task<int> RemainingRecoveryCodesAsync(Guid userId, CancellationToken ct) =>
        await db.RecoveryCodes.CountAsync(r => r.UserId == userId && r.UsedAt == null, ct);

    /// <summary>Spaces and dashes removed, lower case - "ABCDE-FGHIJ", "abcde fghij" and "abcdefghij" are the same code.</summary>
    internal static string Normalize(string code) =>
        new string(code.Where(c => c is not (' ' or '-')).ToArray()).ToLowerInvariant();

    /// <summary>Ten characters from a 31-letter alphabet (about 49 bits), shown as "xxxxx-xxxxx".</summary>
    internal static string NewRecoveryCode()
    {
        Span<char> chars = stackalloc char[10];
        for (var i = 0; i < chars.Length; i++) chars[i] = RecoveryAlphabet[RandomNumberGenerator.GetInt32(RecoveryAlphabet.Length)];
        return $"{new string(chars[..5])}-{new string(chars[5..])}";
    }

    /// <summary>
    /// The secret in clear. The Data Protection keys live in the data folder and are not part of a backup: after restoring into another
    /// data folder they are missing, and the TOTP secrets cannot be read any more - answered with <c>twofactor.key_unavailable</c> (recovery
    /// codes keep working, an admin can reset 2FA).
    /// </summary>
    private byte[] Unprotect(string protectedSecret)
    {
        try
        {
            return Convert.FromBase64String(_protector.Unprotect(protectedSecret));
        }
        catch (Exception ex) when (ex is System.Security.Cryptography.CryptographicException or FormatException)
        {
            logger.LogError("TOTP-Geheimnis nicht lesbar ({Message}). Wahrscheinlich fehlen die Schlüssel im Ordner keys/dataprotection (z. B. nach dem Umzug einer Sicherung in einen neuen Datenordner). Wiederherstellungscodes funktionieren weiter; ein Admin kann die Zwei-Faktor-Anmeldung zurücksetzen.", ex.Message);
            throw new Errors.ApiException(StatusCodes.Status409Conflict, "twofactor.key_unavailable",
                "The two-factor key of this installation is missing (for example after moving a backup to a new data folder). Sign in with a recovery code, or ask an administrator to reset two-factor authentication.");
        }
    }
}
