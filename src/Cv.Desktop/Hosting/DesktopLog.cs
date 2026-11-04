using System.Globalization;

namespace Cv.Desktop.Hosting;

/// <summary>
/// The program's own log file (<c>logs/desktop.log</c> in the data folder): start, stop and every error the window shows. The server's
/// own log lines go to its logger. A write that fails never disturbs the program. The file is rolled over at 1 MB (one old copy).
/// </summary>
internal static class DesktopLog
{
    private const long MaxBytes = 1024 * 1024;
    private static readonly Lock Gate = new();
    private static string? _file;

    public static string? File => _file;

    public static void Init(string logDirectory)
    {
        try
        {
            Directory.CreateDirectory(logDirectory);
            _file = Path.Combine(logDirectory, "desktop.log");
            if (System.IO.File.Exists(_file) && new FileInfo(_file).Length > MaxBytes)
            {
                System.IO.File.Move(_file, _file + ".1", overwrite: true);
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            _file = null;
        }
    }

    public static void Info(string message) => Write("INFO ", message);

    public static void Warn(string message) => Write("WARN ", message);

    public static void Error(string message) => Write("FEHLER", message);

    private static void Write(string level, string message)
    {
        if (_file is null) return;
        var line = $"{DateTimeOffset.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)} {level} {message}{Environment.NewLine}";
        try
        {
            lock (Gate) System.IO.File.AppendAllText(_file, line);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            // Logging must never take the program down
        }
    }
}
