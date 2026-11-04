using Cv.Server.Errors;

namespace Cv.Server.Security;

public static class SecurityMiddleware
{
    public const string CsrfHeader = "X-Cv-Request";

    /// <summary>
    /// The content security policy of the served UI: only the server's own origin for scripts, styles, fonts, images and API calls; no
    /// framing; no plugins. Inline style attributes are allowed (the UI's animation library sets them), inline scripts are not.
    /// </summary>
    public const string ContentSecurityPolicy =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; " +
        "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

    /// <summary>Standard security headers on every response; API answers are never cached.</summary>
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) => app.Use(async (context, next) =>
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers.XContentTypeOptions = "nosniff";
            headers.XFrameOptions = "DENY";
            headers["Referrer-Policy"] = "no-referrer";
            headers["Cross-Origin-Opener-Policy"] = "same-origin";
            headers["Cross-Origin-Resource-Policy"] = "same-origin";
            headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";
            headers.ContentSecurityPolicy = ContentSecurityPolicy;
            if (context.Request.Path.StartsWithSegments("/api") && !headers.ContainsKey("Cache-Control"))
            {
                headers.CacheControl = "no-store";
            }
            return Task.CompletedTask;
        });
        await next();
    });

    /// <summary>
    /// CSRF protection: every state-changing request to <c>/api</c> (anything but GET/HEAD) must carry <c>X-Cv-Request: 1</c>. A foreign web
    /// page cannot set a custom header on a cross-site request without a CORS preflight, and the server allows no CORS at all.
    /// </summary>
    public static IApplicationBuilder UseCsrfHeaderCheck(this IApplicationBuilder app) => app.Use(async (context, next) =>
    {
        var request = context.Request;
        if (request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(request.Method) && !HttpMethods.IsHead(request.Method)
            && !string.Equals(request.Headers[CsrfHeader].ToString(), "1", StringComparison.Ordinal))
        {
            await ApiProblem.WriteAsync(context, StatusCodes.Status403Forbidden, "csrf.missing",
                $"The request header {CsrfHeader}: 1 is missing.");
            return;
        }
        await next();
    });
}
