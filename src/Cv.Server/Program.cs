using Cv.Server;
using Cv.Server.Data;

// The server as it runs in Docker and in development. Everything comes from configuration / environment variables
// (DATA_DIR, BACKUP_DIR, APP_CHANNEL, TRUSTED_PROXIES, WEB_ROOT, ASPNETCORE_URLS); the Windows program builds the same app
// in-process through ServerApp.Build in desktop mode.
WebApplication app;
try
{
    app = ServerApp.Build(new ServerAppOptions { Mode = HostMode.Server }, args);
}
catch (DatabaseRefusedException)
{
    // Damaged database: the explanation is in the log, nothing was changed. Exit code instead of a stack trace.
    return 3;
}
app.Run();
return 0;
