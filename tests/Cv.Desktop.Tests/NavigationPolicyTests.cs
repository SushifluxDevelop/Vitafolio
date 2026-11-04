using Cv.Desktop.Ui;

namespace Cv.Desktop.Tests;

public sealed class NavigationPolicyTests
{
    private static readonly Uri Own = new("http://127.0.0.1:5555/");

    [Theory]
    [InlineData("http://127.0.0.1:5555/", NavigationDecision.Allow)]
    [InlineData("http://127.0.0.1:5555/applications/3?x=1#top", NavigationDecision.Allow)]
    [InlineData("about:blank", NavigationDecision.Allow)]
    [InlineData("blob:http://127.0.0.1:5555/6f1c1f0e-0000-4000-8000-000000000000", NavigationDecision.Allow)]
    // Other sites: the default browser
    [InlineData("https://example.com/help", NavigationDecision.OpenExternally)]
    [InlineData("http://127.0.0.1:5556/", NavigationDecision.OpenExternally)]
    [InlineData("http://localhost:5555/", NavigationDecision.OpenExternally)]
    [InlineData("https://127.0.0.1:5555/", NavigationDecision.OpenExternally)]
    // Everything else is blocked
    [InlineData("file:///C:/Windows/System32/drivers/etc/hosts", NavigationDecision.Block)]
    [InlineData("javascript:alert(1)", NavigationDecision.Block)]
    [InlineData("data:text/html,<b>x</b>", NavigationDecision.Block)]
    [InlineData("mailto:someone@example.com", NavigationDecision.Block)]
    [InlineData("ms-settings:display", NavigationDecision.Block)]
    [InlineData("blob:https://example.com/abc", NavigationDecision.Block)]
    [InlineData("not a uri", NavigationDecision.Block)]
    [InlineData("", NavigationDecision.Block)]
    [InlineData(null, NavigationDecision.Block)]
    public void Navigation_follows_the_rule(string? target, NavigationDecision expected) =>
        Assert.Equal(expected, NavigationPolicy.Decide(target, Own));

    [Theory]
    [InlineData("https://example.com/", NavigationDecision.OpenExternally)]
    [InlineData("http://127.0.0.1:5555/applications", NavigationDecision.Block)] // never a second window of the program
    [InlineData("about:blank", NavigationDecision.Block)]
    [InlineData("file:///C:/x.txt", NavigationDecision.Block)]
    [InlineData("javascript:void(0)", NavigationDecision.Block)]
    public void A_new_window_never_stays_inside(string target, NavigationDecision expected) =>
        Assert.Equal(expected, NavigationPolicy.Decide(target, Own, newWindow: true));
}
