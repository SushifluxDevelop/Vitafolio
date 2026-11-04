namespace Cv.Desktop.Ui;

public enum NavigationDecision
{
    /// <summary>Stays in the window.</summary>
    Allow,

    /// <summary>An ordinary web link to another site: the default browser opens it, the window stays where it is.</summary>
    OpenExternally,

    /// <summary>Nothing happens.</summary>
    Block,
}

/// <summary>
/// What the window may navigate to - pure, so every case is unit-tested. The window only ever shows its own origin (the in-process server,
/// in development the Vite dev server). Web links (http/https) to any other site go to the default browser; everything else
/// (<c>file:</c>, <c>data:</c>, <c>javascript:</c>, <c>mailto:</c>, app protocols, unparsable text) is blocked. New-window requests follow
/// the same rule, but never stay inside: a window of the program is never a second window.
/// </summary>
internal static class NavigationPolicy
{
    public static NavigationDecision Decide(string? target, Uri ownOrigin, bool newWindow = false)
    {
        if (string.IsNullOrWhiteSpace(target) || !Uri.TryCreate(target, UriKind.Absolute, out var uri)) return NavigationDecision.Block;

        if (uri.Scheme is "http" or "https")
        {
            if (!newWindow && SameOrigin(uri, ownOrigin)) return NavigationDecision.Allow;
            // A new window onto the own origin is blocked too: it would be a second window of the program
            return SameOrigin(uri, ownOrigin) ? NavigationDecision.Block : NavigationDecision.OpenExternally;
        }

        if (newWindow) return NavigationDecision.Block;

        // The page's own empty frames and the blobs it creates itself (e.g. a generated file shown in the page)
        if (uri.AbsoluteUri == "about:blank") return NavigationDecision.Allow;
        if (uri.Scheme == "blob" && Uri.TryCreate(uri.AbsolutePath, UriKind.Absolute, out var inner)
            && inner.Scheme is "http" or "https" && SameOrigin(inner, ownOrigin))
        {
            return NavigationDecision.Allow;
        }
        return NavigationDecision.Block;
    }

    private static bool SameOrigin(Uri a, Uri b) =>
        string.Equals(a.Scheme, b.Scheme, StringComparison.OrdinalIgnoreCase)
        && string.Equals(a.Host, b.Host, StringComparison.OrdinalIgnoreCase)
        && a.Port == b.Port;
}
