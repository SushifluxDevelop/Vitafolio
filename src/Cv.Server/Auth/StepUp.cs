using Cv.Server.Configuration;
using Cv.Server.Data;
using Cv.Server.Errors;
using Cv.Server.Services;
using Microsoft.EntityFrameworkCore;

namespace Cv.Server.Auth;

/// <summary>
/// Step-up check for actions that touch everyone's data (backup download, upload, restore): in server mode the admin's current password
/// and - when 2FA is on - a code (TOTP or recovery code) in the same request. Desktop mode: the local owner, no check.
/// </summary>
public sealed class StepUp(AppDbContext db, Accounts accounts, TwoFactorService twoFactor, ActivityLogger activity, ServerSettings settings)
{
    public async Task VerifyAsync(HttpContext context, string? password, string? code, string action, CancellationToken ct)
    {
        if (settings.IsDesktop) return;
        var id = context.User.RequiredUserId();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new ApiException(StatusCodes.Status401Unauthorized, "auth.invalid", "The account no longer exists.");
        var ok = !string.IsNullOrEmpty(password) && password.Length <= InputRules.LoginFieldMax && accounts.CheckPassword(user, password);
        if (ok && user.TotpEnabled)
        {
            var factor = await twoFactor.VerifyAsync(user, code, ct);
            if (factor == SecondFactor.AlreadyUsed) throw TwoFactorService.CodeAlreadyUsed(StatusCodes.Status403Forbidden);
            ok = factor != SecondFactor.Invalid;
        }
        if (!ok)
        {
            await activity.RecordNowAsync(context, "auth.reauth_failed", user.Username, new { action }, ct: ct);
            throw new ApiException(StatusCodes.Status403Forbidden, "auth.reauth_failed",
                user.TotpEnabled ? "Password or two-factor code is wrong." : "The password is wrong.",
                new Dictionary<string, object?> { ["twoFactorRequired"] = user.TotpEnabled });
        }
        await db.SaveChangesAsync(ct); // a re-hashed password
    }
}
