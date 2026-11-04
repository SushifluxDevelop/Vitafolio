using Cv.Server.Auth;
using Cv.Server.Configuration;
using Cv.Server.Tests.Support;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Logging.Abstractions;

namespace Cv.Server.Tests;

/// <summary>Key protection on Windows (the desktop program): DPAPI for the key ring and the token signing key, migration of old plain keys.</summary>
public sealed class KeyProtectionTests : IDisposable
{
    private readonly string _data = Path.Combine(Path.GetTempPath(), "cv-server-tests", Guid.NewGuid().ToString("N"));

    private ServerSettings Settings() => new()
    {
        Mode = HostMode.Desktop, DataDirectory = _data, BackupDirectory = Path.Combine(_data, "backups"), Channel = "dev",
    };

    [Fact]
    public async Task A_plain_signing_key_is_encrypted_once_and_existing_tokens_stay_valid()
    {
        if (!OperatingSystem.IsWindows())
        {
            Assert.Skip("DPAPI exists only on Windows.");
            return;
        }
        var settings = Settings();
        Directory.CreateDirectory(settings.KeysDirectory);
        // A key file as earlier builds wrote it (plain Base64)
        var legacy = System.Security.Cryptography.RandomNumberGenerator.GetBytes(64);
        File.WriteAllText(Path.Combine(settings.KeysDirectory, "jwt-signing.key"), Convert.ToBase64String(legacy));
        var before = new TokenService(StoreOver(settings, legacy), TimeProvider.System);
        var sessionId = Guid.NewGuid();
        var token = before.CreateAccessToken(Guid.NewGuid(), sessionId, "admin");

        var store = new SigningKeyStore(settings, NullLoggerFactory.Instance);
        Assert.True(store.IsProtectedOnDisk);
        var text = File.ReadAllText(Path.Combine(settings.KeysDirectory, "jwt-signing.key"));
        Assert.DoesNotContain(Convert.ToBase64String(legacy), text, StringComparison.Ordinal);
        Assert.Equal(legacy, store.Key.Key);

        var result = await new TokenService(store, TimeProvider.System).ValidateAccessTokenAsync(token);
        Assert.True(result.Valid);
        Assert.Equal(sessionId, result.SessionId);

        // A second start reads the encrypted file
        Assert.Equal(legacy, new SigningKeyStore(settings, NullLoggerFactory.Instance).Key.Key);
    }

    [Fact]
    [System.Runtime.Versioning.SupportedOSPlatform("windows")]
    public void Secrets_protected_with_an_unencrypted_key_ring_stay_readable_after_switching_to_dpapi()
    {
        if (!OperatingSystem.IsWindows())
        {
            Assert.Skip("DPAPI exists only on Windows.");
            return;
        }
        var ring = new DirectoryInfo(Path.Combine(_data, "keys", "dataprotection"));
        var old = DataProtectionProvider.Create(ring, b => b.SetApplicationName("Cv.Server"));
        var protectedSecret = old.CreateProtector("Cv.Server.TotpSecret.v1").Protect("totp-secret");

        var withDpapi = DataProtectionProvider.Create(ring, b => b.SetApplicationName("Cv.Server").ProtectKeysWithDpapi());
        Assert.Equal("totp-secret", withDpapi.CreateProtector("Cv.Server.TotpSecret.v1").Unprotect(protectedSecret));
    }

    /// <summary>A store over the same key in another folder (stands in for the earlier build that issued the token).</summary>
    private static SigningKeyStore StoreOver(ServerSettings settings, byte[] legacy)
    {
        var copy = new ServerSettings { Mode = HostMode.Server, DataDirectory = Path.Combine(settings.DataDirectory, "old"), BackupDirectory = settings.BackupDirectory, Channel = "dev" };
        Directory.CreateDirectory(copy.KeysDirectory);
        File.WriteAllText(Path.Combine(copy.KeysDirectory, "jwt-signing.key"), Convert.ToBase64String(legacy));
        return new SigningKeyStore(copy, NullLoggerFactory.Instance);
    }

    public void Dispose() => TestFiles.DeleteDirectory(_data);
}
