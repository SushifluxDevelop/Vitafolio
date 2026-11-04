using Cv.Server.Configuration;
using Cv.Server.Errors;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Cv.Server.Auth;

/// <summary>The endpoint exists only in server mode; the Windows program answers 404 (it has no sign-in and no account management).</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class ServerModeOnlyAttribute : Attribute, IResourceFilter
{
    public void OnResourceExecuting(ResourceExecutingContext context)
    {
        if (context.HttpContext.RequestServices.GetRequiredService<ServerSettings>().IsDesktop)
        {
            context.Result = NotFound(context.HttpContext);
        }
    }

    public void OnResourceExecuted(ResourceExecutedContext context)
    {
    }

    internal static ObjectResult NotFound(HttpContext http) =>
        new(ApiProblem.Create(http, StatusCodes.Status404NotFound, "not_found", "Not found."))
        {
            StatusCode = StatusCodes.Status404NotFound,
            ContentTypes = { "application/problem+json" },
        };
}

/// <summary>Marks the endpoints a user who must set up 2FA may still call (2FA setup itself, me, preferences).</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class AllowDuringTwoFactorSetupAttribute : Attribute;

/// <summary>
/// While the instance requires 2FA and the signed-in user has not set it up, every authenticated API answers 403
/// <c>auth.twofactor_setup_required</c> - except endpoints marked <see cref="AllowDuringTwoFactorSetupAttribute"/> and anonymous ones
/// (logout, refresh).
/// </summary>
public sealed class TwoFactorSetupFilter : IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user.Identity?.IsAuthenticated != true || !user.HasClaim(AuthConstants.ClaimMustSetupTwoFactor, "true")) return;
        var metadata = context.ActionDescriptor.EndpointMetadata;
        if (metadata.OfType<IAllowAnonymous>().Any() || metadata.OfType<AllowDuringTwoFactorSetupAttribute>().Any()) return;
        context.Result = new ObjectResult(ApiProblem.Create(context.HttpContext, StatusCodes.Status403Forbidden, "auth.twofactor_setup_required",
            "Two-factor authentication must be set up before you can continue."))
        {
            StatusCode = StatusCodes.Status403Forbidden,
            ContentTypes = { "application/problem+json" },
        };
    }
}
