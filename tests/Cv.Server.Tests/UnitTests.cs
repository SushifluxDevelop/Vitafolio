using System.Text;
using Cv.Server.Auth;
using Cv.Server.Backups;
using Cv.Server.Configuration;

namespace Cv.Server.Tests;

/// <summary>Pins the examples of scripts/version-display.sh - both must produce the same text.</summary>
public sealed class VersionFormatTests
{
    [Theory]
    [InlineData("v2026.11.12", "v2026.11.12.13.557", "release", "v2026.11.12 (13.557)")]
    [InlineData("v2026.11.12", "v2026.11.12.13.557", "beta", "v2026.11.12 (13.557 β)")]
    [InlineData("v2026.11.12", "v2026.11.12.13.557", "dev", "v2026.11.12 (13.557-dev)")]
    [InlineData("v2026.11.12", null, "release", "v2026.11.12")]
    [InlineData("v2026.11.12", null, "beta", "v2026.11.12")]
    [InlineData("v2026.11.12", null, "dev", "v2026.11.12-dev")]
    [InlineData("v2026.11.12", "", "dev", "v2026.11.12-dev")]
    // Build ids that do not belong to the short version or are malformed count as "no counters" (never empty parentheses)
    [InlineData("v2026.11.12", "v2026.11.11.13.557", "release", "v2026.11.12")]
    [InlineData("v2026.11.12", "v2026.11.12.13", "release", "v2026.11.12")]
    [InlineData("v2026.11.12", "v2026.11.12.13.557.1", "release", "v2026.11.12")]
    [InlineData("v2026.11.12", "v2026.11.12.13..557", "release", "v2026.11.12")]
    [InlineData("v2026.11.12", "v2026.11.12.a.557", "release", "v2026.11.12")]
    [InlineData("v2026.11.12", "v2026.11.12.13.557", "unknown", "v2026.11.12 (13.557)")]
    [InlineData("v0.0.0", null, "dev", "v0.0.0-dev")]
    public void Display_matches_the_script(string shortVersion, string? buildId, string channel, string expected) =>
        Assert.Equal(expected, VersionFormat.Display(shortVersion, buildId, channel));

    [Theory]
    [InlineData("v2026.11.12", "v2026.11.12.13.557", "release", "v2026.11.12")]
    [InlineData("v2026.11.12", "v2026.11.12.13.557", "beta", "v2026.11.12.13.557-beta")]
    [InlineData("v2026.11.12", "v2026.11.12.13.557", "dev", "v2026.11.12.13.557-dev")]
    [InlineData("v2026.11.12", null, "beta", "v2026.11.12-beta")]
    public void Tag_matches_the_script(string shortVersion, string? buildId, string channel, string expected) =>
        Assert.Equal(expected, VersionFormat.Tag(shortVersion, buildId, channel));

    [Fact]
    public void Missing_version_file_falls_back_to_v0()
    {
        var (shortVersion, buildId) = AppVersion.Read(Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"), "version.txt"));
        Assert.Equal("v0.0.0", shortVersion);
        Assert.Null(buildId);
    }

    [Fact]
    public void Version_file_is_read_with_both_lines()
    {
        var file = Path.Combine(Path.GetTempPath(), $"cv-version-{Guid.NewGuid():N}.txt");
        File.WriteAllText(file, "v2026.11.12\r\nv2026.11.12.13.557\r\n");
        try
        {
            Assert.Equal(("v2026.11.12", "v2026.11.12.13.557"), AppVersion.Read(file));
        }
        finally
        {
            File.Delete(file);
        }
    }
}

/// <summary>RFC 6238 appendix B test vectors (SHA-1 seed "12345678901234567890").</summary>
public sealed class TotpTests
{
    private static readonly byte[] Seed = Encoding.ASCII.GetBytes("12345678901234567890");

    [Theory]
    [InlineData(59L, "94287082")]
    [InlineData(1111111109L, "07081804")]
    [InlineData(1111111111L, "14050471")]
    [InlineData(1234567890L, "89005924")]
    [InlineData(2000000000L, "69279037")]
    [InlineData(20000000000L, "65353130")]
    public void Rfc6238_vectors(long unixSeconds, string expected)
    {
        var step = Totp.Step(DateTimeOffset.FromUnixTimeSeconds(unixSeconds));
        Assert.Equal(expected, Totp.Compute(Seed, step, digits: 8));
        // The 6-digit code is the same value modulo 10^6
        Assert.Equal(expected[2..], Totp.Compute(Seed, step));
    }

    [Fact]
    public void Match_accepts_one_step_of_drift_and_nothing_more()
    {
        var now = DateTimeOffset.FromUnixTimeSeconds(1234567890);
        var step = Totp.Step(now);
        Assert.Equal(step, Totp.Match(Seed, Totp.Compute(Seed, step), now));
        Assert.Equal(step - 1, Totp.Match(Seed, Totp.Compute(Seed, step - 1), now));
        Assert.Equal(step + 1, Totp.Match(Seed, Totp.Compute(Seed, step + 1), now));
        Assert.Null(Totp.Match(Seed, Totp.Compute(Seed, step + 2), now));
        Assert.Null(Totp.Match(Seed, "12345", now));
        Assert.Null(Totp.Match(Seed, "abcdef", now));
    }

    [Fact]
    public void Base32_round_trip_and_rfc4648_vectors()
    {
        Assert.Equal("MZXW6YTBOI", Base32.Encode(Encoding.ASCII.GetBytes("foobar")));
        Assert.Equal("MZXW6", Base32.Encode(Encoding.ASCII.GetBytes("foo")));
        Assert.Equal("foobar", Encoding.ASCII.GetString(Base32.Decode("mzxw6ytboi")));
        var secret = Totp.NewSecret();
        Assert.Equal(secret, Base32.Decode(Base32.Encode(secret)));
    }

    [Fact]
    public void Otpauth_uri_carries_issuer_account_and_secret()
    {
        var uri = Totp.OtpAuthUri("Name With Space", "anna", "ABC");
        Assert.Equal("otpauth://totp/Name%20With%20Space:anna?secret=ABC&issuer=Name%20With%20Space&algorithm=SHA1&digits=6&period=30", uri);
    }
}

public sealed class BackupRetentionTests
{
    [Fact]
    public void Keeps_the_newest_recent_and_the_daily_copies_of_the_configured_days()
    {
        var now = new DateTime(2026, 11, 4, 12, 0, 0);
        var recent = Enumerable.Range(0, 25).Select(i => $"/b/recent/app-{now.AddHours(-i):yyyyMMdd-HHmmss}-scheduled.db").Append("/b/recent/notes.db").ToList();
        var daily = new[] { $"/b/daily/app-{now.AddDays(-59):yyyyMMdd}-020000-start.db", $"/b/daily/app-{now.AddDays(-61):yyyyMMdd}-020000-manual.db", "/b/daily/manual.db" };

        var deleted = BackupService.Retention.ToDelete(recent, daily, now, keepRecent: 20, keepDailyDays: 60).ToList();

        Assert.Equal(6, deleted.Count);
        Assert.Equal(recent.Skip(20).Take(5), deleted.Take(5));
        Assert.Contains(daily[1], deleted);
        Assert.DoesNotContain("/b/recent/notes.db", deleted);
        Assert.DoesNotContain("/b/daily/manual.db", deleted);

        // 0 days = no daily copies at all
        Assert.Equal(2, BackupService.Retention.ToDelete([], daily, now, 20, 0).Count());
    }

    [Fact]
    public void Only_own_file_names_are_parsed()
    {
        Assert.Equal((new DateTime(2026, 11, 4, 2, 0, 0), "pre-restore"), BackupService.Parse("app-20261104-020000-pre-restore.db"));
        Assert.Null(BackupService.Parse("app-20261104-020000-other.db"));
        Assert.Null(BackupService.Parse("../app-20261104-020000-manual.db.exe"));
    }
}

public sealed class TrustedProxiesTests
{
    [Fact]
    public void Parses_addresses_and_networks()
    {
        var (proxies, networks) = ServerSettings.ParseTrustedProxies("172.17.0.1, 10.0.0.0/8 ;::1");
        Assert.Equal(2, proxies.Count);
        Assert.Single(networks);
    }

    [Fact]
    public void Empty_means_none_and_garbage_stops_the_start()
    {
        Assert.Empty(ServerSettings.ParseTrustedProxies("").Proxies);
        Assert.Throws<InvalidOperationException>(() => ServerSettings.ParseTrustedProxies("not-an-ip"));
    }
}
