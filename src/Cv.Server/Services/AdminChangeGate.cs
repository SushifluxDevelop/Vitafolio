namespace Cv.Server.Services;

/// <summary>
/// Serialises the account changes that can remove an admin (role change, disable, delete): the "at least one enabled admin stays" check
/// and the change must happen as one step, or two admins removing each other at the same moment would both succeed. One server process
/// owns the database, so a process-wide lock is enough.
/// </summary>
public static class AdminChangeGate
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public static async Task<IAsyncDisposable> EnterAsync(CancellationToken ct)
    {
        await Gate.WaitAsync(ct);
        return new Releaser();
    }

    private sealed class Releaser : IAsyncDisposable
    {
        private int _released;

        public ValueTask DisposeAsync()
        {
            if (Interlocked.Exchange(ref _released, 1) == 0) Gate.Release();
            return ValueTask.CompletedTask;
        }
    }
}
