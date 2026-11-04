using System.Security.Cryptography;
using System.Text;
using Cv.Server.Configuration;

namespace Cv.Server.Auth;

/// <summary>
/// The one-time setup code of the server mode. Without it, whoever reaches a fresh instance first could make themselves admin. On a
/// start without any account a random code (28 characters from an alphabet without look-alikes, about 138 bits, shown as
/// <c>XXXX-XXXX-…</c>) is created in <c>&lt;data&gt;/setup-token</c> (owner-only on Linux) and written to the log on every start while no
/// account exists - the operator reads it there (Docker / Unraid logs). <c>/api/setup</c> needs it; it is deleted after the first admin
/// was created. Desktop mode has no setup.
/// </summary>
public sealed class SetupToken(ServerSettings settings, ILogger<SetupToken> logger)
{
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private const int Length = 28;

    private readonly Lock _gate = new();
    private string? _code;

    private string File => Path.Combine(settings.DataDirectory, "setup-token");

    /// <summary>Creates (or reads) the code and logs it prominently. Called at start while no account exists.</summary>
    public void EnsureAndAnnounce()
    {
        string code;
        lock (_gate)
        {
            code = _code ??= Load() ?? Create();
        }
        var line = new string('=', 78);
        logger.LogWarning(
            "{Line}\nEinrichtungscode: {Code}\nNoch kein Konto vorhanden. Die Einrichtung des ersten Administrators in {Product} verlangt diesen Code.\n" +
            "Zu finden auf Unraid unter Docker → {Product} → Logs (sonst: docker logs). Der Code gilt nur einmal.\n{Line}",
            line, Format(code), Branding.ProductName, Branding.ProductName, line);
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

    /// <summary>The code has done its job (the first admin exists).</summary>
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
                logger.LogWarning("Einrichtungscode-Datei {File} konnte nicht gelöscht werden: {Message}", File, ex.Message);
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

    private string Create()
    {
        var chars = new char[Length];
        for (var i = 0; i < chars.Length; i++) chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        var code = new string(chars);
        if (System.IO.File.Exists(File)) System.IO.File.Delete(File);
        KeyStorage.WritePrivateFile(File, Format(code));
        return code;
    }
}
