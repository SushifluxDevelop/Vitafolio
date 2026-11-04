namespace Cv.Desktop.Ui;

/// <summary>
/// How long closing may take. A normal close holds the window open until the server has stopped (its before-shutdown backup runs).
/// When Windows shuts down or the task manager ends the program, the window must not refuse to close: only a short bounded wait.
/// </summary>
internal static class ClosePolicy
{
    public static readonly TimeSpan SystemCloseLimit = TimeSpan.FromSeconds(5);

    /// <summary>The bounded wait for a system-initiated close, or null for a normal close.</summary>
    public static TimeSpan? BoundedWait(CloseReason reason) =>
        reason is CloseReason.WindowsShutDown or CloseReason.TaskManagerClosing ? SystemCloseLimit : null;
}
