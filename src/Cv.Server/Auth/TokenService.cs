using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Cv.Server.Configuration;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Cv.Server.Auth;

/// <summary>
/// The HMAC key that signs access tokens: 512 random bits, generated on the first start into <c>&lt;data&gt;/keys/jwt-signing.key</c>.
/// Never in code, never logged. Deleting the file signs everybody out (refresh tokens stay valid, so the UI simply refreshes).
/// <list type="bullet">
/// <item><b>Windows (the desktop program, and a development server on Windows):</b> the file is encrypted with DPAPI for the current
/// Windows user (the same protection as the Data Protection key ring). A plain key file of an earlier build is encrypted once at start;
/// the key itself stays the same, so running sessions keep working.</item>
/// <item><b>Linux (container):</b> plain Base64 in a file only the app user can read (folder 700, file 600) - see the start log line.</item>
/// </list>
/// </summary>
public sealed class SigningKeyStore
{
    private const string FileName = "jwt-signing.key";

    private readonly string _file;
    private readonly ILogger<SigningKeyStore> _logger;
    private readonly ILoggerFactory _loggerFactory;
    private volatile SymmetricSecurityKey _key;

    public SigningKeyStore(ServerSettings settings, ILoggerFactory loggerFactory)
    {
        _loggerFactory = loggerFactory;
        _logger = loggerFactory.CreateLogger<SigningKeyStore>();
        var file = _file = Path.Combine(settings.KeysDirectory, FileName);
        KeyStorage.EnsurePrivateDirectory(settings.KeysDirectory);
        byte[] key;
        if (File.Exists(file))
        {
            key = Read(file, out var wasPlain);
            if (key.Length < 32) throw new InvalidOperationException($"Der Signaturschlüssel {file} ist zu kurz; Datei löschen, damit ein neuer erzeugt wird.");
            if (wasPlain && OperatingSystem.IsWindows())
            {
                Write(key, replace: true);
                _logger.LogInformation("Signaturschlüssel für Anmelde-Tokens ist jetzt mit DPAPI (Windows-Benutzer) verschlüsselt; bestehende Anmeldungen bleiben gültig.");
            }
        }
        else
        {
            key = RandomNumberGenerator.GetBytes(64);
            try
            {
                Write(key, replace: false);
                _logger.LogInformation("Neuer Signaturschlüssel für Anmelde-Tokens angelegt.");
            }
            catch (IOException) when (File.Exists(file))
            {
                // A second process created it at the same moment: use that one
                key = Read(file, out _);
            }
        }
        _key = Create(key);
    }

    public SymmetricSecurityKey Key => _key;

    /// <summary>True when the key file on disk is encrypted (DPAPI).</summary>
    internal bool IsProtectedOnDisk => File.ReadAllText(_file).TrimStart().StartsWith('<');

    /// <summary>A new key: every access token signed with the old one becomes invalid (used after a restore).</summary>
    public void Rotate()
    {
        var key = RandomNumberGenerator.GetBytes(64);
        Write(key, replace: true);
        _key = Create(key);
        _logger.LogInformation("Signaturschlüssel für Anmelde-Tokens erneuert - alle Anmeldungen sind beendet.");
    }

    /// <summary>Reads the key: DPAPI-encrypted XML (Windows) or plain Base64 (Linux, or a file of an earlier build).</summary>
    private byte[] Read(string file, out bool wasPlain)
    {
        var text = File.ReadAllText(file).Trim();
        wasPlain = !text.StartsWith('<');
        if (wasPlain) return Convert.FromBase64String(text);
        if (!OperatingSystem.IsWindows())
        {
            throw new InvalidOperationException($"Der Signaturschlüssel {file} ist mit DPAPI verschlüsselt und kann nur unter Windows gelesen werden; Datei löschen, damit ein neuer erzeugt wird.");
        }
        var plain = new Microsoft.AspNetCore.DataProtection.XmlEncryption.DpapiXmlDecryptor().Decrypt(System.Xml.Linq.XElement.Parse(text));
        return Convert.FromBase64String(plain.Value.Trim());
    }

    private void Write(byte[] key, bool replace)
    {
        var content = Convert.ToBase64String(key);
        if (OperatingSystem.IsWindows())
        {
            var encrypted = new Microsoft.AspNetCore.DataProtection.XmlEncryption.DpapiXmlEncryptor(protectToLocalMachine: false, _loggerFactory)
                .Encrypt(new System.Xml.Linq.XElement("jwtSigningKey", content));
            content = encrypted.EncryptedElement.ToString(System.Xml.Linq.SaveOptions.DisableFormatting);
        }
        if (!replace)
        {
            KeyStorage.WritePrivateFile(_file, content);
            return;
        }
        var temp = _file + ".new";
        if (File.Exists(temp)) File.Delete(temp);
        KeyStorage.WritePrivateFile(temp, content);
        File.Move(temp, _file, overwrite: true);
    }

    private static SymmetricSecurityKey Create(byte[] key) => new(key) { KeyId = Convert.ToHexStringLower(SHA256.HashData(key))[..16] };
}

internal static class KeyStorage
{
    public static void EnsurePrivateDirectory(string directory)
    {
        Directory.CreateDirectory(directory);
        if (!OperatingSystem.IsWindows())
        {
            File.SetUnixFileMode(directory, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
        }
    }

    public static void WritePrivateFile(string file, string content)
    {
        var options = new FileStreamOptions { Mode = FileMode.CreateNew, Access = FileAccess.Write, Share = FileShare.None };
        if (!OperatingSystem.IsWindows()) options.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
        using var stream = new FileStream(file, options);
        using var writer = new StreamWriter(stream, new UTF8Encoding(false));
        writer.Write(content);
    }
}

/// <summary>Result of reading an access token.</summary>
public sealed record AccessTokenResult(bool Valid, bool Expired, Guid UserId, Guid SessionId);

/// <summary>Issues and validates the short-lived access tokens (JWT, HS256) and creates the opaque refresh tokens.</summary>
public sealed class TokenService(SigningKeyStore keys, TimeProvider time)
{
    private readonly JsonWebTokenHandler _handler = new() { MapInboundClaims = false };

    public string CreateAccessToken(Guid userId, Guid sessionId, string role)
    {
        var now = time.GetUtcNow().UtcDateTime;
        return _handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = AuthConstants.Issuer,
            Audience = AuthConstants.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = now + AuthConstants.AccessTokenLifetime,
            Claims = new Dictionary<string, object>
            {
                [AuthConstants.ClaimUserId] = userId.ToString(),
                [AuthConstants.ClaimSessionId] = sessionId.ToString(),
                [AuthConstants.ClaimRole] = role,
            },
            SigningCredentials = new SigningCredentials(keys.Key, SecurityAlgorithms.HmacSha256),
        });
    }

    public async Task<AccessTokenResult> ValidateAccessTokenAsync(string token)
    {
        var result = await _handler.ValidateTokenAsync(token, new TokenValidationParameters
        {
            ValidIssuer = AuthConstants.Issuer,
            ValidAudience = AuthConstants.Audience,
            IssuerSigningKey = keys.Key,
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            RequireExpirationTime = true,
            RequireSignedTokens = true,
            ClockSkew = TimeSpan.FromSeconds(30),
        });
        if (!result.IsValid)
        {
            return new AccessTokenResult(false, result.Exception is SecurityTokenExpiredException, Guid.Empty, Guid.Empty);
        }
        var claims = result.ClaimsIdentity;
        if (!Guid.TryParse(claims.FindFirst(AuthConstants.ClaimUserId)?.Value, out var userId)
            || !Guid.TryParse(claims.FindFirst(AuthConstants.ClaimSessionId)?.Value, out var sessionId))
        {
            return new AccessTokenResult(false, false, Guid.Empty, Guid.Empty);
        }
        return new AccessTokenResult(true, false, userId, sessionId);
    }

    /// <summary>A new refresh token: 256 random bits, Base64url. Only <see cref="Hash"/> of it is stored.</summary>
    public static string NewRefreshToken() => Base64Url(RandomNumberGenerator.GetBytes(32));

    /// <summary>SHA-256 (hex) of a high-entropy token or code - enough for random secrets (no password stretching needed).</summary>
    public static string Hash(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    public static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    internal static ClaimsIdentity Identity(IEnumerable<Claim> claims) =>
        new(claims, AuthConstants.Scheme, AuthConstants.ClaimName, AuthConstants.ClaimRole);
}
