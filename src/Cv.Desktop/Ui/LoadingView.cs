using System.Drawing.Drawing2D;
using System.Drawing.Text;

namespace Cv.Desktop.Ui;

/// <summary>
/// What the window shows until the app has loaded (and while it closes): the brand surface with the logo, the product name, what is
/// happening right now and a slim progress bar. Fixed layout around the centre - the status line has its slot from the start, so a new
/// text never moves anything. With Windows' animation effects switched off the bar stands still.
/// </summary>
internal sealed class LoadingView : Control
{
    private readonly System.Windows.Forms.Timer _timer = new() { Interval = 30 };
    private readonly Palette _palette;
    private Bitmap? _logo;
    private int _logoSize;
    private string _status = Texts.Starting;
    private float _phase;

    public LoadingView(Palette palette)
    {
        _palette = palette;
        DoubleBuffered = true;
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.UserPaint, true);
        Dock = DockStyle.Fill;
        Name = "loadingView";
        _timer.Tick += (_, _) =>
        {
            _phase = (_phase + 0.012f) % 1f;
            Invalidate();
        };
    }

    public string Status
    {
        get => _status;
        set
        {
            if (_status == value) return;
            _status = value;
            Invalidate();
        }
    }

    protected override void OnVisibleChanged(EventArgs e)
    {
        base.OnVisibleChanged(e);
        _timer.Enabled = Visible && SystemInformation.UIEffectsEnabled;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
        var s = DeviceDpi / 96f;

        using (var background = new LinearGradientBrush(ClientRectangle, _palette.PageTop, _palette.Page, 90f))
        {
            g.FillRectangle(background, ClientRectangle);
        }

        // Block around the vertical centre, slightly above it
        var centreX = Width / 2f;
        var top = Math.Max(24 * s, Height / 2f - 150 * s);

        var logoSize = (int)Math.Round(96 * s);
        if (_logo is null || _logoSize != logoSize)
        {
            _logo?.Dispose();
            _logo = Chrome.LogoBitmap(logoSize);
            _logoSize = logoSize;
        }
        g.DrawImage(_logo, centreX - logoSize / 2f, top, logoSize, logoSize);

        var centred = TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix | TextFormatFlags.EndEllipsis;
        using var nameFont = new Font("Segoe UI Semibold", 30 * s, FontStyle.Regular, GraphicsUnit.Pixel);
        TextRenderer.DrawText(g, Texts.Product, nameFont, new Rectangle((int)(centreX - 260 * s), (int)(top + 112 * s), (int)(520 * s), (int)(46 * s)),
            _palette.Text, centred);

        using var statusFont = new Font("Segoe UI", 15 * s, FontStyle.Regular, GraphicsUnit.Pixel);
        TextRenderer.DrawText(g, _status, statusFont, new Rectangle((int)(centreX - 300 * s), (int)(top + 172 * s), (int)(600 * s), (int)(28 * s)),
            _palette.Muted, centred);

        // Progress bar: a track and a gold segment gliding along it
        var trackWidth = 280 * s;
        var track = new RectangleF(centreX - trackWidth / 2, top + 214 * s, trackWidth, 4 * s);
        using (var trackBrush = new SolidBrush(Color.FromArgb(70, _palette.Accent)))
        {
            g.FillRectangle(trackBrush, track);
        }
        var segment = trackWidth * 0.32f;
        var x = SystemInformation.UIEffectsEnabled
            ? track.Left + (trackWidth + segment) * _phase - segment
            : track.Left + (trackWidth - segment) / 2;
        var clip = RectangleF.Intersect(track, new RectangleF(x, track.Top, segment, track.Height));
        if (clip.Width > 0)
        {
            using var accent = new SolidBrush(_palette.Accent);
            g.FillRectangle(accent, clip);
        }
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _timer.Dispose();
            _logo?.Dispose();
        }
        base.Dispose(disposing);
    }
}
