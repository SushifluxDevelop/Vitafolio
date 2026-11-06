using Cv.Server.Auth;
using Cv.Server.Backups;
using Cv.Server.Configuration;
using Cv.Server.Data;
using Cv.Server.Errors;
using Cv.Server.Security;
using Cv.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

namespace Cv.Server;

/// <summary>
/// The server as one reusable app: its own Program.cs (Docker, development) and the Windows program (in-process) build exactly the same
/// app from here. <see cref="Build"/> also prepares the database (integrity check, WAL, migrations) - the caller only runs the app.
/// </summary>
public static class ServerApp
{
    public static WebApplication Build(ServerAppOptions options, string[]? args = null)
    {
        ArgumentNullException.ThrowIfNull(options);
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            Args = args ?? [],
            // The same name for every host, so nothing depends on which exe started the server
            ApplicationName = typeof(ServerApp).Assembly.GetName().Name,
        });
        if (options.Urls.Length > 0) builder.WebHost.UseUrls(options.Urls);
        // No "Server: Kestrel" header: nothing to tell a scanner
        builder.WebHost.ConfigureKestrel(kestrel => kestrel.AddServerHeader = false);

        var settings = ServerSettings.Resolve(options, builder.Configuration, builder.Environment);
        AddServices(builder, settings);

        var app = builder.Build();
        LogStart(app, settings);
        PrepareData(app, settings);
        ConfigurePipeline(app, settings);
        return app;
    }

    private static void AddServices(WebApplicationBuilder builder, ServerSettings settings)
    {
        var services = builder.Services;
        builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);
        builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Migrations", LogLevel.Warning);

        services.AddSingleton(settings);
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<AppVersion>();
        services.AddSingleton<SigningKeyStore>();
        services.AddSingleton<TokenService>();
        services.AddSingleton<LoginChallengeStore>();
        services.AddSingleton<SettingsService>();
        services.AddSingleton<DesktopOwner>();
        services.AddSingleton<SetupToken>();
        services.AddSingleton<EmergencyToken>();
        services.AddSingleton<Documents.TypstRenderer>();
        services.AddSingleton<Documents.DocxRenderer>();
        services.AddSingleton<AccountAttemptLimiter>();
        services.AddSingleton<BackupService>();
        services.AddSingleton<BackupSettingsStore>();
        services.AddSingleton<RestoreService>();
        services.AddSingleton<MaintenanceGate>();
        services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
        services.AddScoped<Accounts>();
        services.AddScoped<ActivityLogger>();
        services.AddScoped<SessionService>();
        services.AddScoped<TwoFactorService>();
        services.AddScoped<StepUp>();
        services.AddHostedService<BackupWorker>();
        services.AddHostedService<SessionCleanupWorker>();

        EnsureWritable(settings.DataDirectory, settings.IsDesktop,
            string.Equals(Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER"), "true", StringComparison.OrdinalIgnoreCase));
        KeyStorage.EnsurePrivateDirectory(settings.KeysDirectory);
        var dataProtection = services.AddDataProtection()
            .SetApplicationName("Cv.Server")
            .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(settings.KeysDirectory, "dataprotection")));
        if (OperatingSystem.IsWindows())
        {
            // Windows (desktop program): the key ring is encrypted with DPAPI for the current Windows user
            dataProtection.ProtectKeysWithDpapi();
        }
        else
        {
            // Linux container: no key encryption is available - the protection is the file permissions (see the start log line, which
            // replaces the framework's generic warning "No XML encryptor configured")
            builder.Logging.AddFilter("Microsoft.AspNetCore.DataProtection.KeyManagement.XmlKeyManager", LogLevel.Error);
        }

        var connectionSetup = new SqliteConnectionSetup();
        services.AddDbContext<AppDbContext>(db =>
        {
            db.UseSqlite(SqliteDatabase.ConnectionString(settings.DatabaseFile));
            db.AddInterceptors(connectionSetup);
        });

        services.AddExceptionHandler<ApiExceptionHandler>();
        services.AddProblemDetails();

        services.AddControllers(mvc =>
            {
                mvc.Filters.Add<ApiExceptionFilter>();
                mvc.Filters.Add<TwoFactorSetupFilter>();
                mvc.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
            })
            .ConfigureApiBehaviorOptions(api =>
            {
                // A body that cannot be read at all (broken JSON, wrong types): one field-level answer in our own format
                api.InvalidModelStateResponseFactory = context =>
                {
                    var errors = context.ModelState
                        .Where(e => e.Value?.Errors.Count > 0)
                        .ToDictionary(
                            e => string.IsNullOrEmpty(e.Key) ? "body" : JsonFieldName(e.Key),
                            e => (IReadOnlyList<FieldError>)[new FieldError("validation.invalid_value")]);
                    return new ObjectResult(ApiProblem.Create(context.HttpContext, StatusCodes.Status400BadRequest, "validation.failed",
                        "The request body could not be read.", null, errors))
                    {
                        StatusCode = StatusCodes.Status400BadRequest,
                        ContentTypes = { "application/problem+json" },
                    };
                };
            });

        services.AddAuthentication(AuthConstants.Scheme)
            .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, CvAuthenticationHandler>(AuthConstants.Scheme, null);
        services.AddAuthorizationBuilder()
            .AddPolicy(AuthConstants.AdminPolicy, policy => policy.RequireAuthenticatedUser().RequireRole(Roles.Admin))
            // Secure by default: an endpoint without [AllowAnonymous] needs a signed-in user
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

        services.AddRateLimiter(options => RateLimitPolicies.Configure(options, settings.RateLimits));

        if (settings.TrustedProxies.Count > 0 || settings.TrustedNetworks.Count > 0)
        {
            services.Configure<ForwardedHeadersOptions>(forwarded =>
            {
                forwarded.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
                forwarded.KnownProxies.Clear();
                forwarded.KnownIPNetworks.Clear();
                foreach (var proxy in settings.TrustedProxies) forwarded.KnownProxies.Add(proxy);
                foreach (var network in settings.TrustedNetworks) forwarded.KnownIPNetworks.Add(network);
            });
        }

        services.AddOpenApi();
    }

    private static void LogStart(WebApplication app, ServerSettings settings)
    {
        app.Logger.LogInformation("{Product} startet ({Mode}, Kanal {Channel}). Datenordner: {DataDir}, Sicherungen: {BackupDir}.",
            Branding.ProductName, settings.IsDesktop ? "Windows-Programm" : "Server", settings.Channel, settings.DataDirectory, settings.BackupDirectory);
        if (OperatingSystem.IsWindows())
        {
            app.Logger.LogInformation("Schlüssel (Datenschutz-Schlüsselbund und Token-Signatur) in {Keys} sind mit DPAPI für den Windows-Benutzer verschlüsselt.", settings.KeysDirectory);
        }
        else
        {
            app.Logger.LogInformation(
                "Schlüssel (Datenschutz-Schlüsselbund und Token-Signatur) liegen unverschlüsselt in {Keys}. Geschützt sind sie durch die Dateirechte: " +
                "der Ordner ist nur für den Benutzer lesbar, unter dem der Server läuft (Container: PUID/PGID). Den Datenordner deshalb nicht für andere " +
                "Benutzer freigeben. Die allgemeine Framework-Warnung 'No XML encryptor configured' wird aus diesem Grund nicht angezeigt.",
                settings.KeysDirectory);
        }
        if (settings.WebRootPath is null)
        {
            app.Logger.LogInformation("Keine gebaute Oberfläche gefunden - nur die API wird ausgeliefert.");
        }
    }

    private static void PrepareData(WebApplication app, ServerSettings settings)
    {
        SqliteDatabase.Prepare(settings.DatabaseFile, app.Services, app.Logger);
        if (settings.IsDesktop) DesktopOwner.Ensure(app.Services, app.Logger);
        else AnnounceSetupTokenIfNeeded(app.Services);
        // Created now, so a broken key folder stops the start instead of the first sign-in
        app.Services.GetRequiredService<SigningKeyStore>();
        // Once the last hosted service has stopped (the final backup is made): close pooled connections so SQLite folds the WAL back
        app.Lifetime.ApplicationStopped.Register(Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools);
    }

    /// <summary>Server mode without any account: the one-time setup code is created and written to the log (every start until setup).</summary>
    private static void AnnounceSetupTokenIfNeeded(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        if (!scope.ServiceProvider.GetRequiredService<AppDbContext>().Users.Any()) services.GetRequiredService<SetupToken>().EnsureAndAnnounce();
        services.GetRequiredService<EmergencyToken>().CheckTriggerFile();
    }

    private static void ConfigurePipeline(WebApplication app, ServerSettings settings)
    {
        app.UseExceptionHandler();
        // DNS-rebinding protection first (before the UI files); desktop mode checks its exact loopback host in the authentication
        if (settings.IsDesktop) app.UseDesktopHostGuard(settings, app.Logger);
        else app.UseHostGuard(settings, app.Logger);
        if (settings.TrustedProxies.Count > 0 || settings.TrustedNetworks.Count > 0) app.UseForwardedHeaders();
        app.UseSecurityHeaders();
        app.UseMaintenanceGate();

        StaticFileOptions? files = null;
        if (settings.WebRootPath is not null && Directory.Exists(settings.WebRootPath))
        {
            files = new StaticFileOptions
            {
                FileProvider = new PhysicalFileProvider(settings.WebRootPath),
                ContentTypeProvider = new FileExtensionContentTypeProvider(),
                OnPrepareResponse = ctx =>
                {
                    // Vite puts content-hashed files into /assets: cache them forever; everything else (index.html) is revalidated
                    ctx.Context.Response.Headers.CacheControl = ctx.Context.Request.Path.StartsWithSegments("/assets")
                        ? "public, max-age=31536000, immutable"
                        : "no-cache";
                },
            };
            // Before authentication: the built UI is public, the API behind it is not
            app.UseStaticFiles(files);
        }

        app.UseCsrfHeaderCheck();
        app.UseRateLimiter();
        app.UseAuthentication();
        app.UseAuthorization();

        app.MapControllers();

        // Unknown API routes: a problem answer, never the UI's index.html
        app.MapFallback("/api/{**rest}", (HttpContext context) =>
                ApiProblem.WriteAsync(context, StatusCodes.Status404NotFound, "not_found", "There is no API endpoint at this address."))
            .AllowAnonymous();
        if (files is not null)
        {
            // Client-side routes of the React app
            app.MapFallbackToFile("index.html", files).AllowAnonymous();
        }

        if (app.Environment.IsDevelopment()) app.MapOpenApi().AllowAnonymous();

        app.MapGet("/api/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();
        app.MapGet("/api/version", (AppVersion version) =>
        {
            var v = version.Current;
            return Results.Ok(new { version = v.Version, @short = v.Short, buildId = v.BuildId, channel = v.Channel });
        }).AllowAnonymous();
    }

    /// <summary>
    /// Makes sure the data folder exists and can be written to, and says what is wrong in plain words when it cannot: the path is a file,
    /// access is denied, or another I/O problem (with the original text). The container hint (PUID/PGID) only appears in server mode inside a container.
    /// </summary>
    internal static void EnsureWritable(string dataDirectory, bool desktop, bool inContainer)
    {
        if (File.Exists(dataDirectory))
        {
            throw new InvalidOperationException(
                $"Der Datenordner '{dataDirectory}' ist eine Datei und kein Ordner. Bitte die Einstellung für den Datenordner (DATA_DIR) prüfen.");
        }
        try
        {
            Directory.CreateDirectory(dataDirectory);
            var probe = Path.Combine(dataDirectory, $".write-test-{Guid.NewGuid():N}");
            File.WriteAllText(probe, "");
            File.Delete(probe);
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException)
        {
            throw new InvalidOperationException(DescribeDataFolderProblem(ex, dataDirectory, desktop, inContainer), ex);
        }
    }

    internal static string DescribeDataFolderProblem(Exception ex, string dataDirectory, bool desktop, bool inContainer)
    {
        if (ex is UnauthorizedAccessException)
        {
            var hint = inContainer && !desktop
                // Operator-facing: the usual cause is a data folder owned by another user (container PUID/PGID, Unraid appdata)
                ? "Der Ordner muss dem Benutzer gehören, unter dem der Server läuft (Docker/Unraid: PUID/PGID, Standard 99/100)."
                : "Bitte die Berechtigungen des Ordners prüfen: der Benutzer, unter dem das Programm läuft, braucht dort Schreibrechte.";
            return $"Kein Schreibzugriff auf den Datenordner '{dataDirectory}'. {hint}";
        }
        return $"Der Datenordner '{dataDirectory}' ist nicht benutzbar: {ex.Message}";
    }

    /// <summary>"$.newPassword" / "NewPassword" -> "newPassword".</summary>
    private static string JsonFieldName(string key)
    {
        var name = key.StartsWith("$.", StringComparison.Ordinal) ? key[2..] : key;
        return name.Length > 0 ? char.ToLowerInvariant(name[0]) + name[1..] : "body";
    }
}
