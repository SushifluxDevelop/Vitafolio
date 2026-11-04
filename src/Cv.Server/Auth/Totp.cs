using System.Buffers.Binary;
using System.Security.Cryptography;

namespace Cv.Server.Auth;

/// <summary>
/// TOTP after RFC 6238 (HMAC-SHA-1, 30-second steps, Unix epoch as T0) on top of HOTP (RFC 4226). Codes are checked within one step
/// before and after the current one (clock drift); the caller enforces that a step is never accepted twice.
/// </summary>
public static class Totp
{
    public const int StepSeconds = 30;
    public const int Digits = 6;

    /// <summary>The time step of a moment (number of 30-second periods since the Unix epoch).</summary>
    public static long Step(DateTimeOffset at) => at.ToUnixTimeSeconds() / StepSeconds;

    /// <summary>The HOTP value of one step, as a zero-padded string of <paramref name="digits"/> digits (RFC 4226, section 5.3).</summary>
    public static string Compute(ReadOnlySpan<byte> secret, long step, int digits = Digits)
    {
        Span<byte> counter = stackalloc byte[8];
        BinaryPrimitives.WriteInt64BigEndian(counter, step);
        Span<byte> hash = stackalloc byte[20];
        HMACSHA1.HashData(secret, counter, hash);
        var offset = hash[^1] & 0x0F;
        var binary = ((hash[offset] & 0x7F) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
        var modulo = 1;
        for (var i = 0; i < digits; i++) modulo *= 10;
        return (binary % modulo).ToString(System.Globalization.CultureInfo.InvariantCulture).PadLeft(digits, '0');
    }

    /// <summary>
    /// The step whose code equals <paramref name="code"/> within [current - window, current + window], or null. All candidate steps are
    /// compared in constant time, so the timing does not tell which step matched.
    /// </summary>
    public static long? Match(ReadOnlySpan<byte> secret, string code, DateTimeOffset now, int window = 1)
    {
        if (code.Length != Digits || !code.All(char.IsAsciiDigit)) return null;
        var current = Step(now);
        long? matched = null;
        var expected = System.Text.Encoding.ASCII.GetBytes(code);
        for (var step = current - window; step <= current + window; step++)
        {
            var candidate = System.Text.Encoding.ASCII.GetBytes(Compute(secret, step));
            if (CryptographicOperations.FixedTimeEquals(candidate, expected) && matched is null) matched = step;
        }
        return matched;
    }

    /// <summary>A new random secret of 20 bytes (160 bits, the size RFC 4226 recommends for HMAC-SHA-1).</summary>
    public static byte[] NewSecret() => RandomNumberGenerator.GetBytes(20);

    /// <summary>The <c>otpauth://</c> URI that authenticator apps read from a QR code.</summary>
    public static string OtpAuthUri(string issuer, string account, string base32Secret)
    {
        var label = Uri.EscapeDataString(issuer) + ":" + Uri.EscapeDataString(account);
        return $"otpauth://totp/{label}?secret={base32Secret}&issuer={Uri.EscapeDataString(issuer)}&algorithm=SHA1&digits={Digits}&period={StepSeconds}";
    }
}

/// <summary>Base32 after RFC 4648 (alphabet A-Z2-7, no padding on output) - the secret format of authenticator apps.</summary>
public static class Base32
{
    private const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    public static string Encode(ReadOnlySpan<byte> data)
    {
        var result = new System.Text.StringBuilder((data.Length * 8 + 4) / 5);
        int buffer = 0, bits = 0;
        foreach (var b in data)
        {
            buffer = ((buffer & 0xFF) << 8) | b;
            bits += 8;
            while (bits >= 5)
            {
                result.Append(Alphabet[(buffer >> (bits - 5)) & 31]);
                bits -= 5;
            }
        }
        if (bits > 0) result.Append(Alphabet[(buffer << (5 - bits)) & 31]);
        return result.ToString();
    }

    public static byte[] Decode(string text)
    {
        var clean = text.Trim().TrimEnd('=').Replace(" ", "", StringComparison.Ordinal).ToUpperInvariant();
        var output = new List<byte>(clean.Length * 5 / 8);
        int buffer = 0, bits = 0;
        foreach (var c in clean)
        {
            var value = Alphabet.IndexOf(c, StringComparison.Ordinal);
            if (value < 0) throw new FormatException("Not a Base32 string.");
            buffer = ((buffer & 0xFF) << 5) | value;
            bits += 5;
            if (bits >= 8)
            {
                output.Add((byte)((buffer >> (bits - 8)) & 0xFF));
                bits -= 8;
            }
        }
        return output.ToArray();
    }
}
