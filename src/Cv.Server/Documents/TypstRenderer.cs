// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using System.Reflection;
using System.Text.Json;
using Cv.Server.Controllers;
using typstsharp;

namespace Cv.Server.Documents;

/// <summary>
/// Renders CV, cover letters, and application dossier documents using embedded Typst templates
/// and the in-process native typst compiler.
/// User inputs are passed strictly as JSON data, never concatenated into Typst markup.
/// </summary>
public sealed class TypstRenderer
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    private readonly Assembly _assembly = typeof(TypstRenderer).Assembly;

    public byte[] RenderPdf(ProfileResponse profile, CvRenderOptions options, string? photoFilePath = null)
    {
        string templateName = options.NormalizedDesign switch
        {
            "modern" => "modern.typ",
            "plain" => "plain.typ",
            _ => "classic.typ"
        };
        string templateSource = LoadTemplate(templateName);

        string jsonData = JsonSerializer.Serialize(profile, JsonOptions);
        string jsonOptions = JsonSerializer.Serialize(new
        {
            design = options.NormalizedDesign,
            accentColor = options.NormalizedAccentColor,
            font = options.NormalizedFont,
            showPhoto = options.NormalizedShowPhoto,
            photoShape = options.NormalizedPhotoShape,
            language = options.NormalizedLanguage
        }, JsonOptions);

        string? root = null;
        string photoArg = string.Empty;

        if (options.NormalizedShowPhoto && !string.IsNullOrEmpty(photoFilePath) && File.Exists(photoFilePath))
        {
            root = Path.GetDirectoryName(photoFilePath);
            photoArg = Path.GetFileName(photoFilePath);
        }

        var sysInputs = new Dictionary<string, string>
        {
            ["data"] = jsonData,
            ["options"] = jsonOptions,
            ["photo"] = photoArg
        };

        using var compiler = TypstCompiler.FromSource(
            source: templateSource,
            fonts: new Fonts(IncludeSystemFonts: true, FontPaths: []),
            sysInputs: sysInputs,
            root: root,
            packagePath: null,
            includeSystemPackages: false);

        return compiler.CompilePdf();
    }

    public byte[] RenderCoverLetterPdf(CoverLetterDto coverLetter, CoverLetterRenderOptions options, string? signatureFilePath = null)
    {
        string templateSource = LoadTemplate("cover_letter.typ");

        string jsonData = JsonSerializer.Serialize(coverLetter, JsonOptions);
        string jsonOptions = JsonSerializer.Serialize(new
        {
            accentColor = options.NormalizedAccentColor,
            font = options.NormalizedFont,
            language = options.NormalizedLanguage,
            includeFoldMarks = options.NormalizedIncludeFoldMarks
        }, JsonOptions);

        string? root = null;
        string sigArg = string.Empty;

        if (!string.IsNullOrEmpty(signatureFilePath) && File.Exists(signatureFilePath))
        {
            root = Path.GetDirectoryName(signatureFilePath);
            sigArg = Path.GetFileName(signatureFilePath);
        }

        var sysInputs = new Dictionary<string, string>
        {
            ["data"] = jsonData,
            ["options"] = jsonOptions,
            ["signature"] = sigArg
        };

        using var compiler = TypstCompiler.FromSource(
            source: templateSource,
            fonts: new Fonts(IncludeSystemFonts: true, FontPaths: []),
            sysInputs: sysInputs,
            root: root,
            packagePath: null,
            includeSystemPackages: false);

        return compiler.CompilePdf();
    }

    public byte[] RenderCoverSheetPdf(ProfileResponse profile, CoverSheetOptions options, string? photoFilePath = null)
    {
        string templateSource = LoadTemplate("cover_sheet.typ");

        var dataObj = new Dictionary<string, object?>
        {
            ["firstName"] = profile.FirstName,
            ["lastName"] = profile.LastName,
            ["academicTitle"] = profile.AcademicTitle,
            ["professionalTitle"] = profile.ProfessionalTitle,
            ["email"] = profile.Email,
            ["phone"] = profile.Phone,
            ["street"] = profile.Street,
            ["postalCode"] = profile.PostalCode,
            ["city"] = profile.City,
            ["country"] = profile.Country,
            ["website"] = profile.Website,
            ["targetJob"] = options.TargetJob ?? profile.ProfessionalTitle,
            ["targetCompany"] = options.TargetCompany,
            ["contents"] = options.Contents
        };

        string jsonData = JsonSerializer.Serialize(dataObj, JsonOptions);
        string jsonOptions = JsonSerializer.Serialize(new
        {
            accentColor = options.NormalizedAccentColor,
            font = options.NormalizedFont,
            showPhoto = options.NormalizedShowPhoto,
            photoShape = options.NormalizedPhotoShape,
            language = options.NormalizedLanguage
        }, JsonOptions);

        string? root = null;
        string photoArg = string.Empty;

        if (options.NormalizedShowPhoto && !string.IsNullOrEmpty(photoFilePath) && File.Exists(photoFilePath))
        {
            root = Path.GetDirectoryName(photoFilePath);
            photoArg = Path.GetFileName(photoFilePath);
        }

        var sysInputs = new Dictionary<string, string>
        {
            ["data"] = jsonData,
            ["options"] = jsonOptions,
            ["photo"] = photoArg
        };

        using var compiler = TypstCompiler.FromSource(
            source: templateSource,
            fonts: new Fonts(IncludeSystemFonts: true, FontPaths: []),
            sysInputs: sysInputs,
            root: root,
            packagePath: null,
            includeSystemPackages: false);

        return compiler.CompilePdf();
    }

    public byte[] RenderDossierPdf(
        ProfileResponse profile,
        CoverLetterDto? coverLetter,
        DossierRenderOptions options,
        string? photoFilePath = null,
        string? signatureFilePath = null,
        string? dataDirectory = null)
    {
        string templateSource = LoadTemplate("dossier.typ");

        string jsonData = JsonSerializer.Serialize(profile, JsonOptions);
        string jsonCoverLetter = coverLetter != null
            ? JsonSerializer.Serialize(coverLetter, JsonOptions)
            : "{}";

        var contentsList = options.Contents;
        if (contentsList == null || contentsList.Count == 0)
        {
            var defaultContents = new List<string>();
            if (coverLetter != null && !string.IsNullOrWhiteSpace(coverLetter.Subject))
            {
                defaultContents.Add(options.NormalizedLanguage == "en" ? "Cover Letter" : "Anschreiben");
            }
            defaultContents.Add(options.NormalizedLanguage == "en" ? "Curriculum Vitae" : "Lebenslauf");
            if (options.Attachments != null && options.Attachments.Count > 0)
            {
                defaultContents.Add(options.NormalizedLanguage == "en" ? "Attachments" : "Anlagen");
            }
            contentsList = defaultContents;
        }

        string jsonOptions = JsonSerializer.Serialize(new
        {
            design = options.NormalizedDesign,
            accentColor = options.NormalizedAccentColor,
            font = options.NormalizedFont,
            showPhoto = options.NormalizedShowPhoto,
            photoShape = options.NormalizedPhotoShape,
            language = options.NormalizedLanguage,
            includeCoverSheet = options.NormalizedIncludeCoverSheet,
            targetJob = options.TargetJob ?? profile.ProfessionalTitle,
            targetCompany = options.TargetCompany,
            contents = contentsList,
            attachments = options.Attachments != null
                ? options.Attachments.Select(a => new { title = a.Title, filePath = a.FilePath, contentType = a.ContentType }).ToList()
                : []
        }, JsonOptions);

        string? root = null;
        string photoArg = string.Empty;
        string sigArg = string.Empty;

        bool hasPhoto = options.NormalizedShowPhoto && !string.IsNullOrEmpty(photoFilePath) && File.Exists(photoFilePath);
        bool hasSig = !string.IsNullOrEmpty(signatureFilePath) && File.Exists(signatureFilePath);

        if (!string.IsNullOrEmpty(dataDirectory) && Directory.Exists(dataDirectory))
        {
            root = dataDirectory;
            if (hasPhoto) photoArg = Path.GetRelativePath(dataDirectory, photoFilePath!).Replace('\\', '/');
            if (hasSig) sigArg = Path.GetRelativePath(dataDirectory, signatureFilePath!).Replace('\\', '/');
        }
        else if (hasPhoto && hasSig)
        {
            string photoDir = Path.GetDirectoryName(Path.GetFullPath(photoFilePath!)) ?? Path.GetPathRoot(photoFilePath!) ?? string.Empty;
            string sigDir = Path.GetDirectoryName(Path.GetFullPath(signatureFilePath!)) ?? Path.GetPathRoot(signatureFilePath!) ?? string.Empty;
            string commonDir = GetCommonDirectory(photoDir, sigDir);
            root = commonDir;
            photoArg = Path.GetRelativePath(commonDir, photoFilePath!).Replace('\\', '/');
            sigArg = Path.GetRelativePath(commonDir, signatureFilePath!).Replace('\\', '/');
        }
        else if (hasPhoto)
        {
            root = Path.GetDirectoryName(photoFilePath!);
            photoArg = Path.GetFileName(photoFilePath!) ?? string.Empty;
        }
        else if (hasSig)
        {
            root = Path.GetDirectoryName(signatureFilePath!);
            sigArg = Path.GetFileName(signatureFilePath!) ?? string.Empty;
        }

        var sysInputs = new Dictionary<string, string>
        {
            ["data"] = jsonData,
            ["options"] = jsonOptions,
            ["coverLetter"] = jsonCoverLetter,
            ["photo"] = photoArg,
            ["signature"] = sigArg
        };

        using var compiler = TypstCompiler.FromSource(
            source: templateSource,
            fonts: new Fonts(IncludeSystemFonts: true, FontPaths: []),
            sysInputs: sysInputs,
            root: root,
            packagePath: null,
            includeSystemPackages: false);

        return compiler.CompilePdf();
    }

    private static string GetCommonDirectory(string pathA, string pathB)
    {
        var pA = Path.GetFullPath(pathA).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var pB = Path.GetFullPath(pathB).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);

        while (!string.IsNullOrEmpty(pA))
        {
            if (pB.Equals(pA, StringComparison.OrdinalIgnoreCase) || pB.StartsWith(pA + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            {
                return pA;
            }
            var parent = Path.GetDirectoryName(pA);
            if (parent == null || parent == pA) break;
            pA = parent;
        }
        return Path.GetPathRoot(pathA) ?? pathA;
    }

    private string LoadTemplate(string name)
    {
        string resourceName = $"Cv.Server.Documents.Templates.{name}";
        using var stream = _assembly.GetManifestResourceStream(resourceName);
        if (stream == null)
        {
            throw new InvalidOperationException($"Embedded Typst template '{resourceName}' not found.");
        }
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
