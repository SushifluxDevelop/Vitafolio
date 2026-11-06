using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.WebUtilities;

namespace Cv.Server.Errors;

/// <summary>One error of a form field: a stable code plus optional parameters (e.g. <c>validation.min_length</c> with <c>min</c>).</summary>
public sealed class FieldError(string code, IReadOnlyDictionary<string, object?>? parameters = null)
{
    public string Code { get; } = code;

    public IReadOnlyDictionary<string, object?> Params { get; } = parameters ?? new Dictionary<string, object?>();
}

/// <summary>
/// The error body of every API error: RFC 7807 ProblemDetails plus <c>code</c> (stable identifier the UI translates), <c>params</c>,
/// field <c>errors</c> and <c>traceId</c>. <c>detail</c> is an English fallback text. Never contains stack traces or internals.
/// </summary>
public sealed class ProblemBody
{
    public int Status { get; init; }

    public string Title { get; init; } = "";

    public string Detail { get; init; } = "";

    public string Code { get; init; } = "";

    public IReadOnlyDictionary<string, object?> Params { get; init; } = new Dictionary<string, object?>();

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyDictionary<string, IReadOnlyList<FieldError>>? Errors { get; init; }

    public string? TraceId { get; init; }
}

/// <summary>Thrown by controllers and services; turned into a <see cref="ProblemBody"/> by <see cref="ApiExceptionHandler"/>.</summary>
public sealed class ApiException(
    int status,
    string code,
    string detail,
    IReadOnlyDictionary<string, object?>? parameters = null,
    IReadOnlyDictionary<string, IReadOnlyList<FieldError>>? errors = null) : Exception(detail)
{
    public int Status { get; } = status;

    public string Code { get; } = code;

    public IReadOnlyDictionary<string, object?>? Parameters { get; } = parameters;

    public IReadOnlyDictionary<string, IReadOnlyList<FieldError>>? Errors { get; } = errors;

    public static ApiException Validation(IReadOnlyDictionary<string, IReadOnlyList<FieldError>> errors) =>
        new(StatusCodes.Status400BadRequest, "validation.failed", "Validation failed.", null, errors);

    public static ApiException BadRequest(string code, string detail) => new(StatusCodes.Status400BadRequest, code, detail);

    public static ApiException Unauthorized(string code, string detail) => new(StatusCodes.Status401Unauthorized, code, detail);

    /// <summary>A failure that belongs to one field, e.g. the current password is wrong.</summary>
    public static ApiException Field(string field, string code, string detail, int status = StatusCodes.Status400BadRequest) =>
        new(status, code, detail, null, new Dictionary<string, IReadOnlyList<FieldError>> { [field] = [new FieldError(code)] });

    public static ApiException NotFound(string code, string detail) => new(StatusCodes.Status404NotFound, code, detail);

    public static ApiException Conflict(string code, string detail) => new(StatusCodes.Status409Conflict, code, detail);

    public static ApiException Forbidden(string code, string detail) => new(StatusCodes.Status403Forbidden, code, detail);
}

public static class ApiProblem
{
    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    };

    public static ProblemBody Create(HttpContext context, int status, string code, string detail,
        IReadOnlyDictionary<string, object?>? parameters = null, IReadOnlyDictionary<string, IReadOnlyList<FieldError>>? errors = null) => new()
    {
        Status = status,
        Title = code == "validation.failed" ? "Validation failed" : ReasonPhrases.GetReasonPhrase(status),
        Detail = detail,
        Code = code,
        Params = parameters ?? new Dictionary<string, object?>(),
        Errors = errors,
        TraceId = Activity.Current?.Id ?? context.TraceIdentifier,
    };

    /// <summary>Writes a problem response (middleware, authentication handler, rate limiter).</summary>
    public static async Task WriteAsync(HttpContext context, int status, string code, string detail,
        IReadOnlyDictionary<string, object?>? parameters = null, IReadOnlyDictionary<string, IReadOnlyList<FieldError>>? errors = null)
    {
        if (context.Response.HasStarted) return;
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json";
        context.Response.Headers.CacheControl = "no-store";
        await JsonSerializer.SerializeAsync(context.Response.Body, Create(context, status, code, detail, parameters, errors), Json, context.RequestAborted);
    }
}

/// <summary>Every unhandled exception becomes a problem response: <see cref="ApiException"/> as given, anything else as a 500 without details.</summary>
public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        switch (exception)
        {
            case ApiException api:
                await ApiProblem.WriteAsync(context, api.Status, api.Code, api.Message, api.Parameters, api.Errors);
                return true;
            case BadHttpRequestException bad:
                await ApiProblem.WriteAsync(context, bad.StatusCode, "request.invalid", "The request could not be read.");
                return true;
            case OperationCanceledException when context.RequestAborted.IsCancellationRequested:
                return true;
            default:
                logger.LogError(exception, "Unerwarteter Fehler bei {Method} {Path}", context.Request.Method, context.Request.Path);
                await ApiProblem.WriteAsync(context, StatusCodes.Status500InternalServerError, "server.error",
                    "An unexpected error occurred on the server.");
                return true;
        }
    }
}

/// <summary>
/// Turns an <see cref="ApiException"/> thrown in a controller into the problem response inside MVC - unlike the exception middleware
/// this keeps headers already set on the response (e.g. the cookie removal of a failed refresh).
/// </summary>
public sealed class ApiExceptionFilter : Microsoft.AspNetCore.Mvc.Filters.IExceptionFilter
{
    public void OnException(Microsoft.AspNetCore.Mvc.Filters.ExceptionContext context)
    {
        if (context.Exception is not ApiException api) return;
        context.Result = new Microsoft.AspNetCore.Mvc.ObjectResult(
            ApiProblem.Create(context.HttpContext, api.Status, api.Code, api.Message, api.Parameters, api.Errors))
        {
            StatusCode = api.Status,
            ContentTypes = { "application/problem+json" },
        };
        context.HttpContext.Response.Headers.CacheControl = "no-store";
        context.ExceptionHandled = true;
    }
}
