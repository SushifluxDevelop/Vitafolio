using System.Globalization;
using Cv.Server.Configuration;

namespace Cv.Desktop;

/// <summary>
/// Every text the program itself shows (loading view, dialogs) in German and English. The window's own language is not known before the
/// UI has loaded (it is a setting of the account inside the database), so the Windows display language decides: English if Windows is
/// English, German otherwise.
/// </summary>
internal static class Texts
{
    public static bool English { get; set; } = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "en";

    private static string T(string german, string english) => English ? english : german;

    public static string Product => Branding.ProductName;

    // ---- loading view ----
    public static string Starting => T("Wird gestartet …", "Starting …");

    public static string StartingServer => T("Der lokale Server wird gestartet …", "Starting the local server …");

    public static string LoadingUi => T("Die Oberfläche wird geladen …", "Loading the interface …");

    public static string WaitingForDevServer => T("Warte auf den Vite-Entwicklungsserver …", "Waiting for the Vite dev server …");

    public static string Stopping => T("Wird beendet – die Datensicherung läuft …", "Closing – the backup is running …");

    // ---- dialogs ----
    public static string Close => T("Schließen", "Close");

    public static string Quit => T("Beenden", "Quit");

    public static string Copy => T("Kopieren", "Copy");

    public static string Copied => T("Kopiert", "Copied");

    public static string CopyFailed => T("Kopieren nicht möglich", "Copy not possible");

    public static string TechnicalDetails => T("Technische Details", "Technical details");

    public static string StartFailedTitle => T($"{Product} konnte nicht gestartet werden", $"{Product} could not be started");

    public static string StartFailed => T(
        "Der interne Server des Programms konnte nicht gestartet werden.",
        "The program's internal server could not be started.");

    public static string WebViewMissingTitle => T("WebView2 fehlt", "WebView2 is missing");

    public static string WebViewMissing => T(
        $"{Product} braucht die „Microsoft Edge WebView2 Runtime“, um sein Fenster darzustellen. Sie ist auf diesem PC nicht installiert " +
        $"(Windows 11 bringt sie mit, einzelne Windows-10-PCs nicht). Laden Sie die Runtime von der offiziellen Microsoft-Seite herunter " +
        $"(„Evergreen Bootstrapper“), installieren Sie sie und starten Sie {Product} danach neu.",
        $"{Product} needs the \"Microsoft Edge WebView2 Runtime\" to show its window. It is not installed on this PC " +
        $"(Windows 11 includes it, some Windows 10 PCs do not). Download the runtime from Microsoft's official page " +
        $"(\"Evergreen Bootstrapper\"), install it and start {Product} again.");

    public static string OpenDownloadPage => T("Download-Seite öffnen", "Open download page");

    public static string WindowFailedTitle => T($"Das Fenster von {Product} konnte nicht geöffnet werden", $"The window of {Product} could not be opened");

    public static string WindowFailed => T(
        "Die Oberfläche konnte nicht in das Fenster geladen werden.",
        "The interface could not be loaded into the window.");

    public static string DevServerMissing(int vitePort, int serverPort, string reason) => T(
        $"Der Vite-Entwicklungsserver antwortet unter http://127.0.0.1:{vitePort} nicht ({reason}). Starten Sie ihn im Ordner frontend " +
        $"mit VITE_DEV_PORT={vitePort} und API_PROXY_TARGET=http://127.0.0.1:{serverPort} (npm run dev); er leitet /api an den Server dieses Programms weiter.",
        $"The Vite dev server does not answer at http://127.0.0.1:{vitePort} ({reason}). Start it in the frontend folder " +
        $"with VITE_DEV_PORT={vitePort} and API_PROXY_TARGET=http://127.0.0.1:{serverPort} (npm run dev); it forwards /api to this program's server.");

    public static string UiNotFound(string address, int status) => T(
        $"Das Programm hat unter {address} keine Oberfläche gefunden (HTTP {status}). Der Programmordner ist unvollständig: der Ordner „wwwroot“ " +
        $"mit der gebauten Oberfläche fehlt oder ist leer. Installieren Sie {Product} neu.",
        $"The program found no interface at {address} (HTTP {status}). The program folder is incomplete: the \"wwwroot\" folder " +
        $"with the built interface is missing or empty. Reinstall {Product}.");

    public static string ServerNotAnswering(string reason) => T(
        $"Der lokale Server läuft, antwortet aber nicht auf /api/health ({reason}).",
        $"The local server is running but does not answer /api/health ({reason}).");

    public static string WebViewProcessFailedTitle => T("Die Anzeige wurde beendet", "The display was terminated");

    public static string WebViewProcessFailed(string kind, string reason) => T(
        $"Der Anzeige-Prozess (WebView2) wurde unerwartet beendet ({kind}, {reason}). Starten Sie {Product} neu; Ihre Daten sind nicht betroffen.",
        $"The display process (WebView2) ended unexpectedly ({kind}, {reason}). Start {Product} again; your data is not affected.");

    public static string ServerStoppedTitle => T("Der interne Server wurde beendet", "The internal server has stopped");

    public static string ServerStopped => T(
        $"Der interne Server von {Product} wurde unerwartet beendet. Das Programm wird geschlossen; starten Sie es danach neu. Ihre Daten und die Sicherungen bleiben erhalten.",
        $"The internal server of {Product} stopped unexpectedly. The program will close; start it again afterwards. Your data and backups are kept.");

    public static string UnexpectedErrorTitle => T("Unerwarteter Fehler", "Unexpected error");

    public static string UnexpectedError => T(
        "Im Programm ist ein unerwarteter Fehler aufgetreten.",
        "An unexpected error occurred in the program.");

    public static string LogFile(string path) => T($"Protokolldatei: {path}", $"Log file: {path}");
}
