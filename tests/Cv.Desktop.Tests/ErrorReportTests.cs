using Cv.Desktop.Ui;

namespace Cv.Desktop.Tests;

/// <summary>The text "Kopieren" puts on the clipboard - built without showing any window.</summary>
public sealed class ErrorReportTests
{
    [Fact]
    public void Report_has_title_message_details_version_and_time()
    {
        var at = new DateTimeOffset(2026, 11, 4, 22, 41, 5, TimeSpan.FromHours(1));

        var text = Dialogs.BuildReport("Titel", "Nachricht\nzweite Zeile", "System.Exception: Detail", "v2026.11.4 (1.2)", at);

        Assert.Contains("Titel", text);
        Assert.Contains("Nachricht", text);
        Assert.Contains("zweite Zeile", text);
        Assert.Contains("System.Exception: Detail", text);
        Assert.EndsWith(" v2026.11.4 (1.2) · 2026-11-04 22:41:05 +01:00", text.TrimEnd());
    }

    [Fact]
    public void Report_without_details_and_version_has_no_empty_parts()
    {
        var text = Dialogs.BuildReport("T", "M", null, null, DateTimeOffset.UnixEpoch);

        var nl = Environment.NewLine;
        Assert.Equal($"T{nl}{nl}M{nl}{nl}{Texts.Product} · 1970-01-01 00:00:00 +00:00", text);

    }

    [Fact]
    public void Texts_exist_in_both_languages_and_name_the_product()
    {
        var before = Texts.English;
        try
        {
            foreach (var english in new[] { false, true })
            {
                Texts.English = english;
                Assert.Contains(Texts.Product, Texts.StartFailedTitle);
                Assert.Contains(Texts.Product, Texts.WebViewMissing);
                Assert.Contains("127.0.0.1:5244", Texts.DevServerMissing(5244, 5243, "x"));
            }
        }
        finally
        {
            Texts.English = before;
        }
    }
}
