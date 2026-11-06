using System.Security.Cryptography;
using System.Text;
using Cv.Server.Configuration;

namespace Cv.Server.Auth;

/// <summary>
/// One-time emergency token for resetting the password and two-factor authentication of the sole administrator.
/// When the only admin account is locked out or loses its credentials, the operator with access to the server
/// data directory or container logs can request or trigger an emergency reset. The token is generated and logged prominently
/// in the container logs, stored with owner-only permissions in &lt;data&gt;/emergency-token, and consumed on use.
/// </summary>
public sealed class EmergencyToken(ServerSettings settings, ILogger<EmergencyToken> logger)
{
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private const int Length = 28;

    private readonly Lock _gate = new();
    private string? _code;

    private string File => Path.Combine(settings.DataDirectory, "emergency-token");
    private string TriggerFile => Path.Combine(settings.DataDirectory, "emergency-reset");

    /// <summary>Checks if a trigger file &lt;data&gt;/emergency-reset exists on startup. If so, consumes it and creates a token.</summary>
    public void CheckTriggerFile()
    {
        lock (_gate)
        {
            if (!System.IO.File.Exists(TriggerFile)) return;
            try
            {
                System.IO.File.Delete(TriggerFile);
                logger.LogInformation("Notfall-Triggerdatei '{TriggerFile}' erkannt und verarbeitet.", TriggerFile);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                logger.LogWarning("Notfall-Triggerdatei '{TriggerFile}' konnte nicht gelöscht werden: {Message}", TriggerFile, ex.Message);
            }
            GenerateAndAnnounce();
        }
    }

    /// <summary>Creates a new random code, writes it to disk, and logs it with a clear banner in operator logs.</summary>
    public string GenerateAndAnnounce()
    {
        string code;
        lock (_gate)
        {
            var chars = new char[Length];
            for (var i = 0; i < chars.Length; i++) chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
            code = _code = new string(chars);
            if (System.IO.File.Exists(File)) System.IO.File.Delete(File);
            KeyStorage.WritePrivateFile(File, Format(code));
        }

        var line = new string('=', 78);
        logger.LogWarning(
            "{Line}\nADMINISTRATOR-NOTFALL-CODE: {Code}\n" +
            "Ein Notfall-Passwort-Reset für den Administrator in {Product} wurde angefordert.\n" +
            "Geben Sie diesen Einmal-Code in der Anmeldemaske unter 'Notfall-Zugang' ein.\n" +
            "Der Code gilt nur einmal und setzt bei Erfolg auch die Zwei-Faktor-Authentifizierung zurück.\n{Line}",
            line, Format(code), Branding.ProductName, line);

        return code;
    }

    /// <summary>Constant-time check of an entered code (dashes, spaces and case do not matter).</summary>
    public bool Matches(string? entered)
    {
        string? expected;
        lock (_gate)
        {
            expected = _code ??= Load();
        }
        if (expected is null || string.IsNullOrEmpty(entered) || entered.Length > 128) return false;
        var normalized = Normalize(entered);
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(normalized), Encoding.ASCII.GetBytes(expected));
    }

    /// <summary>Deletes the emergency token file and clears the in-memory code.</summary>
    public void Consume()
    {
        lock (_gate)
        {
            _code = null;
            try
            {
                if (System.IO.File.Exists(File)) System.IO.File.Delete(File);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                logger.LogWarning("Notfall-Code-Datei {File} konnte nicht gelöscht werden: {Message}", File, ex.Message);
            }
        }
    }

    internal static string Normalize(string code) =>
        new string(code.Where(c => c is not ('-' or ' ')).ToArray()).ToUpperInvariant();

    internal static string Format(string code) =>
        string.Join('-', Enumerable.Range(0, (code.Length + 3) / 4).Select(i => code.Substring(i * 4, Math.Min(4, code.Length - i * 4))));

    private string? Load()
    {
        if (!System.IO.File.Exists(File)) return null;
        var code = Normalize(System.IO.File.ReadAllText(File).Trim());
        return code.Length == Length && code.All(c => Alphabet.Contains(c, StringComparison.Ordinal)) ? code : null;
    }
}

