using System.IO.Pipes;
using System.Text;
using Cv.Server.Configuration;

namespace Cv.Desktop.Hosting;

/// <summary>
/// One running program per Windows user: a named mutex says "it runs", a named pipe takes the one command <c>show</c> - a second start
/// sends it and ends, the running program then brings its window to the front. Both names are per user session (<c>Local\</c>), derived
/// from the product name, and differ in a development run so it can run next to an installed program.
/// </summary>
internal sealed class SingleInstance : IDisposable
{
    private const string ShowCommand = "show";
    private readonly Mutex _mutex;
    private readonly string _pipeName;
    private readonly CancellationTokenSource _stop = new();
    private Thread? _listener;

    private SingleInstance(Mutex mutex, string pipeName)
    {
        _mutex = mutex;
        _pipeName = pipeName;
    }

    private static string Id(bool dev)
    {
        var name = new string([.. Branding.ProductName.Where(char.IsLetterOrDigit)]);
        return $"{(name.Length > 0 ? name : "App")}.Desktop{(dev ? ".Dev" : string.Empty)}";
    }

    /// <summary>Takes the instance; null when another copy of the program already runs.</summary>
    public static SingleInstance? TryAcquire(bool dev)
    {
        var id = Id(dev);
        var mutex = new Mutex(initiallyOwned: false, $@"Local\{id}");
        try
        {
            if (!mutex.WaitOne(0))
            {
                mutex.Dispose();
                return null;
            }
        }
        catch (AbandonedMutexException)
        {
            // The previous copy crashed: the mutex is ours now
        }
        return new SingleInstance(mutex, id + ".Pipe");
    }

    /// <summary>A second start: asks the running copy to show its window. False when none answers.</summary>
    public static bool SignalRunning(bool dev)
    {
        // The second process is the one the user just started and may bring a window to the front; hand that right to the running copy
        Native.AllowSetForegroundWindow(-1);
        try
        {
            // CurrentUserOnly: only a pipe created by this same user
            using var pipe = new NamedPipeClientStream(".", Id(dev) + ".Pipe", PipeDirection.InOut, PipeOptions.CurrentUserOnly);
            pipe.Connect(5000);
            var bytes = Encoding.UTF8.GetBytes(ShowCommand + "\n");
            pipe.Write(bytes, 0, bytes.Length);
            pipe.Flush();
            return pipe.ReadByte() >= 0;
        }
        catch (Exception ex) when (ex is TimeoutException or IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }

    /// <summary>Listens on a background thread; <paramref name="onShow"/> runs on that thread (marshal to the UI yourself).</summary>
    public void Listen(Action onShow)
    {
        _listener = new Thread(() =>
        {
            while (!_stop.IsCancellationRequested)
            {
                try
                {
                    using var server = new NamedPipeServerStream(_pipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte,
                        PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
                    server.WaitForConnectionAsync(_stop.Token).GetAwaiter().GetResult();
                    var buffer = new byte[32];
                    var read = server.Read(buffer, 0, buffer.Length);
                    var command = Encoding.UTF8.GetString(buffer, 0, read).Trim().ToLowerInvariant();
                    server.WriteByte((byte)'k');
                    server.Flush();
                    if (command == ShowCommand) onShow();
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidOperationException)
                {
                    // A client that went away mid-command: never crash, never spin - wait briefly, listen again
                    if (_stop.Token.WaitHandle.WaitOne(TimeSpan.FromMilliseconds(500))) break;
                }
            }
        })
        {
            IsBackground = true,
            Name = "Command pipe",
        };
        _listener.Start();
    }

    public void Dispose()
    {
        _stop.Cancel();
        _listener?.Join(TimeSpan.FromSeconds(2));
        try { _mutex.ReleaseMutex(); }
        catch (ApplicationException) { /* not owned by this thread any more */ }
        _mutex.Dispose();
    }
}
