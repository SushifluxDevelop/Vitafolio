using Cv.Server.Auth;
using Cv.Server.Configuration;
using Cv.Server.Data;
using Cv.Server.Errors;
using Cv.Server.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Backups;

/// <summary>
/// Blocks the API briefly while the live database is being replaced: every other <c>/api</c> request answers 503 <c>maintenance</c>.
/// Counts the requests in flight, so a restore can wait until the ones already running are done.
/// </summary>
public sealed class MaintenanceGate
{
    private int _inFlight;
    private volatile bool _active;

    public bool Active => _active;

    public int InFlight => Volatile.Read(ref _inFlight);

    internal void Enter() => Interlocked.Increment(ref _inFlight);

    internal void Leave() => Interlocked.Decrement(ref _inFlight);

    internal void Close() => _active = true;

    internal void Open() => _active = false;
}

public static class MaintenanceMiddleware
{
    public static IApplicationBuilder UseMaintenanceGate(this IApplicationBuilder app) => app.Use(async (context, next) =>
    {
        if (!context.Request.Path.StartsWithSegments("/api"))
        {
            await next();
            return;
        }
        var gate = context.RequestServices.GetRequiredService<MaintenanceGate>();
        if (gate.Active && !context.Request.Path.StartsWithSegments("/api/health") && !context.Request.Path.StartsWithSegments("/api/version"))
        {
            context.Response.Headers.RetryAfter = "5";
            await ApiProblem.WriteAsync(context, StatusCodes.Status503ServiceUnavailable, "maintenance",
                "A backup is being restored. Please try again in a few seconds.");
            return;
        }
        gate.Enter();
        try
        {
            await next();
        }
        finally
        {
            gate.Leave();
        }
    });
}
