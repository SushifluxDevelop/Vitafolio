// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using System.Text.RegularExpressions;

namespace Cv.Server.Documents;

/// <summary>
/// User-configurable options when rendering a CV/resume document.
/// </summary>
public sealed partial record CvRenderOptions(
    string? Design,
    string? AccentColor,
    string? Font,
    bool? ShowPhoto,
    string? PhotoShape,
    string? Language)
{
    [GeneratedRegex("^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$")]
    private static partial Regex HexColorRegex();

    public string NormalizedDesign => Design?.Trim().ToLowerInvariant() switch
    {
        "modern" => "modern",
        "plain" or "schlicht" => "plain",
        _ => "classic"
    };

    public string NormalizedAccentColor
    {
        get
        {
            if (string.IsNullOrWhiteSpace(AccentColor)) return "#14213D";
            var color = AccentColor.Trim();
            if (!color.StartsWith('#')) color = "#" + color;
            return HexColorRegex().IsMatch(color) ? color : "#14213D";
        }
    }

    public string NormalizedFont
    {
        get
        {
            if (string.IsNullOrWhiteSpace(Font)) return "Liberation Sans";
            var f = Font.Trim();
            return f.All(c => char.IsLetterOrDigit(c) || c == ' ' || c == '-') ? f : "Liberation Sans";
        }
    }

    public bool NormalizedShowPhoto => ShowPhoto ?? true;

    public string NormalizedPhotoShape => PhotoShape?.Trim().ToLowerInvariant() switch
    {
        "round" => "round",
        "rect" or "square" => "rect",
        _ => "rounded"
    };

    public string NormalizedLanguage => Language?.Trim().ToLowerInvariant() switch
    {
        "en" or "english" => "en",
        _ => "de"
    };
}

/// <summary>
/// Options when rendering an application dossier cover sheet (Deckblatt).
/// </summary>
public sealed partial record CoverSheetOptions(
    string? TargetJob,
    string? TargetCompany,
    IReadOnlyList<string>? Contents,
    string? AccentColor,
    string? Font,
    bool? ShowPhoto,
    string? PhotoShape,
    string? Language)
{
    [GeneratedRegex("^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$")]
    private static partial Regex HexColorRegex();

    public string NormalizedAccentColor
    {
        get
        {
            if (string.IsNullOrWhiteSpace(AccentColor)) return "#14213D";
            var color = AccentColor.Trim();
            if (!color.StartsWith('#')) color = "#" + color;
            return HexColorRegex().IsMatch(color) ? color : "#14213D";
        }
    }

    public string NormalizedFont
    {
        get
        {
            if (string.IsNullOrWhiteSpace(Font)) return "Liberation Sans";
            var f = Font.Trim();
            return f.All(c => char.IsLetterOrDigit(c) || c == ' ' || c == '-') ? f : "Liberation Sans";
        }
    }

    public bool NormalizedShowPhoto => ShowPhoto ?? true;

    public string NormalizedPhotoShape => PhotoShape?.Trim().ToLowerInvariant() switch
    {
        "round" => "round",
        "rect" or "square" => "rect",
        _ => "rounded"
    };

    public string NormalizedLanguage => Language?.Trim().ToLowerInvariant() switch
    {
        "en" or "english" => "en",
        _ => "de"
    };
}
