using System.Text.RegularExpressions;

namespace Cv.Server.Configuration;

/// <summary>
/// How a version is written for people and for tags - the C# twin of <c>scripts/version-display.sh</c>; keep both in step.
/// Input is version.txt: line 1 = short version (<c>v2026.11.12</c>), line 2 = build id (<c>v2026.11.12.13.557</c>, may be missing).
/// <list type="bullet">
/// <item>Display: release <c>v2026.11.12 (13.557)</c>, beta <c>v2026.11.12 (13.557 β)</c>, dev <c>v2026.11.12 (13.557-dev)</c>; without
/// counters the plain short version (dev: <c>v2026.11.12-dev</c>) - never empty parentheses.</item>
/// <item>Tag: release <c>v2026.11.12</c>, beta <c>v2026.11.12.13.557-beta</c>, dev <c>v2026.11.12.13.557-dev</c>.</item>
/// </list>
/// Channel: <c>beta</c> and <c>dev</c> as named, anything else counts as release (same as the script).
/// </summary>
public static partial class VersionFormat
{
    /// <summary>Greek small letter beta (U+03B2).</summary>
    public const string BetaMark = "\u03B2";

    // The script accepts "<digits>.<digits>" after "<short>." and nothing else (no leading/trailing/double dots, no third part)
    [GeneratedRegex(@"^[0-9]+\.[0-9]+$")]
    private static partial Regex CountersPattern();

    /// <summary>The "prompts.lines" part of the build id, or null when it is missing or not "&lt;short&gt;.&lt;digits&gt;.&lt;digits&gt;".</summary>
    public static string? Counters(string shortVersion, string? buildId)
    {
        if (string.IsNullOrEmpty(buildId)) return null;
        var prefix = shortVersion + ".";
        if (!buildId.StartsWith(prefix, StringComparison.Ordinal)) return null;
        var rest = buildId[prefix.Length..];
        return CountersPattern().IsMatch(rest) ? rest : null;
    }

    public static string Display(string shortVersion, string? buildId, string? channel)
    {
        var counters = Counters(shortVersion, buildId);
        var kind = Kind(channel);
        if (counters is null) return kind == "dev" ? shortVersion + "-dev" : shortVersion;
        return kind switch
        {
            "beta" => $"{shortVersion} ({counters} {BetaMark})",
            "dev" => $"{shortVersion} ({counters}-dev)",
            _ => $"{shortVersion} ({counters})",
        };
    }

    public static string Tag(string shortVersion, string? buildId, string? channel)
    {
        var counters = Counters(shortVersion, buildId);
        var full = counters is null ? shortVersion : $"{shortVersion}.{counters}";
        return Kind(channel) switch
        {
            "beta" => full + "-beta",
            "dev" => full + "-dev",
            _ => shortVersion,
        };
    }

    private static string Kind(string? channel) => channel is "beta" or "dev" ? channel : "release";
}
