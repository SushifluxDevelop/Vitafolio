using System.Collections.Concurrent;

namespace Cv.Server.Auth;

/// <summary>
/// The pending second step of a sign-in: after a correct password for an account with 2FA, the client gets a random challenge id and
/// has 5 minutes and 5 attempts to send the code. Kept in memory only - a server restart simply asks for the password again.
/// </summary>
public sealed class LoginChallengeStore(TimeProvider time)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);
    public const int MaxAttempts = 5;

    private sealed class Entry(Guid userId, DateTimeOffset expiresAt)
    {
        public Guid UserId { get; } = userId;

        public DateTimeOffset ExpiresAt { get; } = expiresAt;

        public int Attempts;
    }

    private readonly ConcurrentDictionary<string, Entry> _entries = new(StringComparer.Ordinal);

    public string Create(Guid userId)
    {
        Sweep();
        var id = TokenService.NewRefreshToken();
        _entries[TokenService.Hash(id)] = new Entry(userId, time.GetUtcNow() + Lifetime);
        return id;
    }

    /// <summary>The user of a live challenge; counts the attempt. Null when unknown, expired or out of attempts.</summary>
    public Guid? Use(string? challengeId)
    {
        if (string.IsNullOrEmpty(challengeId) || challengeId.Length > 128) return null;
        var key = TokenService.Hash(challengeId);
        if (!_entries.TryGetValue(key, out var entry)) return null;
        if (entry.ExpiresAt <= time.GetUtcNow() || Interlocked.Increment(ref entry.Attempts) > MaxAttempts)
        {
            _entries.TryRemove(key, out _);
            return null;
        }
        return entry.UserId;
    }

    public void Complete(string challengeId) => _entries.TryRemove(TokenService.Hash(challengeId), out _);

    private void Sweep()
    {
        var now = time.GetUtcNow();
        foreach (var (key, entry) in _entries)
        {
            if (entry.ExpiresAt <= now) _entries.TryRemove(key, out _);
        }
    }
}
