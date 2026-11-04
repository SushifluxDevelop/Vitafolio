using Cv.Desktop.Hosting;
using Cv.Desktop.Ui;

namespace Cv.Desktop.Tests;

public sealed class DataFolderTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "cv-desktop-tests", Guid.NewGuid().ToString("N"));

    [Fact]
    public void The_data_folder_is_company_then_product_and_never_the_installer_folder()
    {
        var local = @"C:\Users\someone\AppData\Local";
        var data = Cv.Server.Configuration.Branding.DesktopDataDirectory(local);
        var installer = Path.Combine(local, Cv.Server.Configuration.Branding.ProductName);
        Assert.Equal(Path.Combine(local, Cv.Server.Configuration.Branding.Company, Cv.Server.Configuration.Branding.ProductName), data);
        Assert.NotEqual(installer, data);
        Assert.False(data.StartsWith(installer + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Legacy_data_is_moved_once_and_the_installer_files_stay()
    {
        var legacy = Path.Combine(_root, "Product");
        var target = Path.Combine(_root, "Company", "Product");
        Directory.CreateDirectory(Path.Combine(legacy, "keys"));
        Directory.CreateDirectory(Path.Combine(legacy, "current"));
        File.WriteAllText(Path.Combine(legacy, "app.db"), "db");
        File.WriteAllText(Path.Combine(legacy, "keys", "jwt-signing.key"), "key");
        File.WriteAllText(Path.Combine(legacy, "Update.exe"), "installer");

        var message = DesktopPaths.MigrateLegacy(legacy, target);

        Assert.NotNull(message);
        Assert.Equal("db", File.ReadAllText(Path.Combine(target, "app.db")));
        Assert.True(File.Exists(Path.Combine(target, "keys", "jwt-signing.key")));
        Assert.False(File.Exists(Path.Combine(legacy, "app.db")));
        Assert.True(File.Exists(Path.Combine(legacy, "Update.exe")));
        Assert.True(Directory.Exists(Path.Combine(legacy, "current")));
        Assert.False(Directory.Exists(Path.Combine(target, "current")));

        // A second start changes nothing (the new folder exists)
        File.WriteAllText(Path.Combine(legacy, "app.db"), "other");
        Assert.Null(DesktopPaths.MigrateLegacy(legacy, target));
        Assert.Equal("db", File.ReadAllText(Path.Combine(target, "app.db")));
    }

    [Fact]
    public void Nothing_is_moved_from_a_folder_without_data()
    {
        var legacy = Path.Combine(_root, "Product");
        Directory.CreateDirectory(Path.Combine(legacy, "current"));
        Assert.Null(DesktopPaths.MigrateLegacy(legacy, Path.Combine(_root, "Company", "Product")));
        Assert.False(Directory.Exists(Path.Combine(_root, "Company")));
        Assert.Null(DesktopPaths.MigrateLegacy(null, Path.Combine(_root, "x")));
    }

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }
}

public sealed class ClosePolicyTests
{
    [Theory]
    [InlineData(CloseReason.WindowsShutDown, true)]
    [InlineData(CloseReason.TaskManagerClosing, true)]
    [InlineData(CloseReason.UserClosing, false)]
    [InlineData(CloseReason.ApplicationExitCall, false)]
    [InlineData(CloseReason.None, false)]
    public void System_closes_get_only_a_short_bounded_wait(CloseReason reason, bool bounded)
    {
        var wait = ClosePolicy.BoundedWait(reason);
        Assert.Equal(bounded, wait is not null);
        if (wait is { } limit) Assert.True(limit <= TimeSpan.FromSeconds(10));
    }
}

public sealed class UnexpectedServerStopTests
{
    [Fact]
    public async Task An_unrequested_stop_is_reported_and_a_requested_one_is_not()
    {
        var data = Path.Combine(Path.GetTempPath(), "cv-desktop-tests", Guid.NewGuid().ToString("N"));
        try
        {
            var server = await DesktopServer.StartAsync(new DesktopServerOptions(data, "dev", Development: false), TestContext.Current.CancellationToken);
            var reported = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            server.StoppedUnexpectedly += () => reported.TrySetResult();
            server.SimulateUnexpectedStop();
            await reported.Task.WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
            await server.StopAsync();

            var second = await DesktopServer.StartAsync(new DesktopServerOptions(data, "dev", Development: false), TestContext.Current.CancellationToken);
            var falseAlarm = false;
            second.StoppedUnexpectedly += () => falseAlarm = true;
            await second.StopAsync();
            Assert.False(falseAlarm);
        }
        finally
        {
            Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
            for (var i = 0; i < 10 && Directory.Exists(data); i++)
            {
                try { Directory.Delete(data, true); }
                catch (IOException) { Thread.Sleep(200); }
                catch (UnauthorizedAccessException) { Thread.Sleep(200); }
            }
        }
    }
}
