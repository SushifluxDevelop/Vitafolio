using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using Cv.Desktop.Hosting;

namespace Cv.Desktop.Ui;

/// <summary>An extra button of a dialog next to "Close" (e.g. opening an official download page).</summary>
internal sealed record DialogAction(string Text, Action Run);

/// <summary>
/// The only place that shows a message: always the program's own branded window, never a system message box. The message is shown
/// complete (the text area scrolls instead of cutting anything off), is selectable, and "Copy" puts message, details, version and time
/// on the clipboard in one click.
/// </summary>
internal static class Dialogs
{
    /// <summary>The readable program version for the copied report; set once at start.</summary>
    public static string? Version { get; set; }

    /// <summary>
    /// Shows an error: <paramref name="message"/> says what happened in plain words, <paramref name="details"/> (optional) is the technical text
    /// (exception, reason) below it. Returns when the user closes the window.
    /// </summary>
    public static void ShowError(IWin32Window? owner, string title, string message, string? details = null, DialogAction? action = null, string closeText = "")
    {
        DesktopLog.Error($"{title}: {message}{(details is null ? string.Empty : " | " + details.Replace(Environment.NewLine, " / "))}");
        using var window = new ErrorWindow(title, message, details, action, string.IsNullOrEmpty(closeText) ? Texts.Close : closeText);
        window.StartPosition = DevMonitor.Active ? FormStartPosition.Manual : owner is null ? FormStartPosition.CenterScreen : FormStartPosition.CenterParent;
        if (owner is null) window.ShowDialog();
        else window.ShowDialog(owner);
    }

    /// <summary>The complete text for the clipboard: message, details, then a line with product, version and time.</summary>
    public static string BuildReport(string title, string message, string? details, string? version, DateTimeOffset at)
    {
        var text = new StringBuilder();
        text.AppendLine(title).AppendLine().AppendLine(message.Trim());
        if (!string.IsNullOrWhiteSpace(details)) text.AppendLine().AppendLine(details.Trim());
        text.AppendLine().Append(Texts.Product);
        if (!string.IsNullOrWhiteSpace(version)) text.Append(' ').Append(version);
        text.Append(" · ").Append(at.ToString("yyyy-MM-dd HH:mm:ss zzz", CultureInfo.InvariantCulture));
        return text.ToString();
    }

    /// <summary>Opens an http/https address in the default browser (used by dialog actions).</summary>
    public static void OpenInBrowser(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https")) return;
        try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true })?.Dispose(); }
        catch (System.ComponentModel.Win32Exception ex) { DesktopLog.Warn($"Link konnte nicht geöffnet werden: {ex.Message}"); }
    }
}

/// <summary>The error window: brand header, scrolling selectable text, a "Copy" button with its status slot, optional action, "Close".</summary>
internal sealed class ErrorWindow : Form
{
    private readonly Label _copiedLabel;
    private readonly string _title;
    private readonly string _message;
    private readonly string? _details;

    public ErrorWindow(string title, string message, string? details, DialogAction? action, string closeText)
    {
        _title = title;
        _message = message;
        _details = details;
        var palette = Palette.Current;

        AutoScaleDimensions = new SizeF(96f, 96f);
        AutoScaleMode = AutoScaleMode.Dpi;
        Text = Texts.Product;
        Icon = Chrome.WindowIcon;
        BackColor = palette.Page;
        ForeColor = palette.Text;
        Font = new Font("Segoe UI", 9.5f);
        FormBorderStyle = FormBorderStyle.Sizable;
        MaximizeBox = false;
        MinimizeBox = false;
        ShowInTaskbar = true;
        KeyPreview = true;
        ClientSize = new Size(680, 440);
        MinimumSize = SizeFromClientSize(new Size(520, 340));

        // Header: logo, title (a long title wraps instead of being cut)
        var header = new Panel { Dock = DockStyle.Top, Height = 84, BackColor = palette.Surface, Padding = new Padding(20, 14, 20, 14) };
        var logo = new PictureBox { Image = Chrome.LogoBitmap(56), SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(56, 56), Dock = DockStyle.Left };
        var titleLabel = new Label
        {
            Text = title,
            Dock = DockStyle.Fill,
            Font = new Font("Segoe UI Semibold", 13.5f),
            ForeColor = palette.Text,
            TextAlign = ContentAlignment.MiddleLeft,
            Padding = new Padding(16, 0, 0, 0),
            Name = "lblTitle",
        };
        header.Controls.Add(titleLabel);
        header.Controls.Add(logo);

        // Body: the complete text, read-only but selectable
        var body = new Panel { Dock = DockStyle.Fill, Padding = new Padding(20, 16, 20, 8) };
        var textBox = new TextBox
        {
            Multiline = true,
            ReadOnly = true,
            ScrollBars = ScrollBars.Vertical,
            WordWrap = true,
            Dock = DockStyle.Fill,
            BorderStyle = BorderStyle.FixedSingle,
            BackColor = palette.Surface,
            ForeColor = palette.Text,
            Font = new Font("Segoe UI", 10f),
            Text = ComposeText(message, details),
            Name = "txtMessage",
        };
        body.Controls.Add(textBox);

        // Footer: [Copy] [status slot ...] [action] [Close]; the status slot is reserved from the start, nothing moves when it fills
        var footer = new TableLayoutPanel
        {
            Dock = DockStyle.Bottom,
            Height = 66,
            ColumnCount = 4,
            RowCount = 1,
            Padding = new Padding(20, 10, 20, 16),
            BackColor = palette.Page,
        };
        footer.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        footer.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        footer.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        footer.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        footer.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        var copy = MakeButton(Texts.Copy, primary: false, palette);
        copy.Name = "btnCopy";
        copy.Click += (_, _) => CopyToClipboard();
        _copiedLabel = new Label
        {
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft,
            ForeColor = palette.Muted,
            Padding = new Padding(12, 0, 0, 0),
            Name = "lblCopied",
            Text = string.Empty,
        };
        footer.Controls.Add(copy, 0, 0);
        footer.Controls.Add(_copiedLabel, 1, 0);
        if (action is not null)
        {
            var extra = MakeButton(action.Text, primary: false, palette);
            extra.Name = "btnAction";
            extra.Margin = new Padding(0, 0, 10, 0);
            extra.Click += (_, _) => action.Run();
            footer.Controls.Add(extra, 2, 0);
        }
        var close = MakeButton(closeText, primary: true, palette);
        close.Name = "btnClose";
        close.DialogResult = DialogResult.OK;
        footer.Controls.Add(close, 3, 0);

        // Z-order: the fill panel first, then the docked edges
        Controls.Add(body);
        Controls.Add(footer);
        Controls.Add(header);

        AcceptButton = close;
        CancelButton = close;
        if (DevMonitor.Active)
        {
            // Position before the first paint, so the dialog never flashes up on another monitor
            StartPosition = FormStartPosition.Manual;
            DevMonitor.Center(this);
        }
        if (palette.IsDark) textBox.HandleCreated += (_, _) => Native.SetWindowTheme(textBox.Handle, "DarkMode_Explorer", null);
        Shown += (_, _) =>
        {
            textBox.SelectionStart = 0;
            textBox.SelectionLength = 0;
            close.Focus();
        };
    }

    /// <summary>With <c>CV_DEV_MONITOR</c> set the dialog opens on that monitor without taking the focus.</summary>
    protected override bool ShowWithoutActivation => DevMonitor.Active;

    /// <summary>A modal dialog is activated by Windows however it is shown; in this mode it carries WS_EX_NOACTIVATE so it never takes the focus.</summary>
    protected override CreateParams CreateParams
    {
        get
        {
            var cp = base.CreateParams;
            if (DevMonitor.Active) cp.ExStyle |= 0x08000000;
            return cp;
        }
    }

    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        if (DevMonitor.Active) DevMonitor.Center(this);
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        Chrome.UseDarkTitleBar(Handle, Palette.Current.IsDark);
    }

    private static string ComposeText(string message, string? details) =>
        string.IsNullOrWhiteSpace(details)
            ? message.Trim()
            : message.Trim() + Environment.NewLine + Environment.NewLine + Texts.TechnicalDetails + Environment.NewLine + details.Trim();

    private void CopyToClipboard()
    {
        var report = Dialogs.BuildReport(_title, _message, _details, Dialogs.Version, DateTimeOffset.Now);
        try
        {
            Clipboard.SetDataObject(report, copy: true, retryTimes: 5, retryDelay: 100);
            _copiedLabel.Text = Texts.Copied;
        }
        catch (Exception ex) when (ex is ExternalException or ThreadStateException or ArgumentException)
        {
            // Another program holds the clipboard: say so, never throw into the window
            _copiedLabel.Text = Texts.CopyFailed;
        }
    }

    private static Button MakeButton(string text, bool primary, Palette palette)
    {
        var button = new Button
        {
            Text = text,
            AutoSize = true,
            AutoSizeMode = AutoSizeMode.GrowAndShrink,
            MinimumSize = new Size(110, 36),
            Padding = new Padding(14, 0, 14, 0),
            FlatStyle = FlatStyle.Flat,
            UseVisualStyleBackColor = false,
            Anchor = AnchorStyles.Right,
            Margin = new Padding(0),
            Font = new Font("Segoe UI Semibold", 9.5f),
            BackColor = primary ? palette.Accent : palette.Surface,
            ForeColor = primary ? palette.AccentText : palette.Text,
        };
        button.FlatAppearance.BorderSize = primary ? 0 : 1;
        button.FlatAppearance.BorderColor = palette.Border;
        return button;
    }
}
