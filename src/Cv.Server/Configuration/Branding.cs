using System.Reflection;

namespace Cv.Server.Configuration;

/// <summary>
/// Product name and company. Both live only in branding.json at the repository root; Directory.Build.props reads them at build time into the
/// assembly's Product and Company attributes, and this class reads those attributes - so no second copy exists anywhere.
/// </summary>
public static class Branding
{
    public static string ProductName { get; } =
        typeof(Branding).Assembly.GetCustomAttribute<AssemblyProductAttribute>()?.Product is { Length: > 0 } name ? name : "App";

    public static string Company { get; } =
        typeof(Branding).Assembly.GetCustomAttribute<AssemblyCompanyAttribute>()?.Company is { Length: > 0 } company ? company : "App";

    /// <summary>
    /// The data folder of the Windows program: <c>%LOCALAPPDATA%\&lt;Company&gt;\&lt;Product&gt;</c> (the Windows convention). Never
    /// <c>%LOCALAPPDATA%\&lt;Product&gt;</c>: that is the installer's program folder, which an uninstall or reinstall deletes.
    /// </summary>
    public static string DesktopDataDirectory(string localAppData) => Path.Combine(localAppData, Company, ProductName);

    /// <summary>Where earlier test builds kept their data (inside the program folder) - only used to move it out once.</summary>
    public static string LegacyDesktopDataDirectory(string localAppData) => Path.Combine(localAppData, ProductName);
}
