// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using Cv.Server.Controllers;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace Cv.Server.Documents;

/// <summary>
/// Generates standard Open XML Word documents (.docx) for resumes and cover letters.
/// Produces clean, professional layouts compatible with Microsoft Word, LibreOffice, and Google Docs.
/// </summary>
public sealed class DocxRenderer
{
    private const int TwipsPerMm = 57; // 1 mm ~ 56.7 twips

    public byte[] RenderCvDocx(ProfileResponse profile, CvRenderOptions options)
    {
        using var stream = new MemoryStream();
        using (var wordDoc = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document, true))
        {
            var mainPart = wordDoc.AddMainDocumentPart();
            mainPart.Document = new Document();
            var body = mainPart.Document.AppendChild(new Body());

            var accentHex = NormalizeHexWithoutHash(options.NormalizedAccentColor);
            var fontName = options.NormalizedFont;
            var isEn = options.NormalizedLanguage == "en";

            // Set document margins (20mm all around)
            var sectionProps = new SectionProperties();
            var pageMargin = new PageMargin
            {
                Top = 20 * TwipsPerMm,
                Bottom = 20 * TwipsPerMm,
                Left = 20 * TwipsPerMm,
                Right = 20 * TwipsPerMm
            };
            sectionProps.AppendChild(pageMargin);

            // Document Header / Candidate Title
            var fullName = (
                (!string.IsNullOrWhiteSpace(profile.AcademicTitle) ? profile.AcademicTitle + " " : "")
                + profile.FirstName + " " + profile.LastName
            ).Trim();

            body.AppendChild(CreateParagraph(fullName, fontSize: 36, isBold: true, colorHex: accentHex, fontName: fontName, spaceAfter: 60));

            if (!string.IsNullOrWhiteSpace(profile.ProfessionalTitle))
            {
                body.AppendChild(CreateParagraph(profile.ProfessionalTitle, fontSize: 24, isBold: false, colorHex: "475569", fontName: fontName, spaceAfter: 120));
            }

            // Contact Info line
            var contactItems = new List<string>();
            if (!string.IsNullOrWhiteSpace(profile.Email)) contactItems.Add(profile.Email);
            if (!string.IsNullOrWhiteSpace(profile.Phone)) contactItems.Add(profile.Phone);
            if (!string.IsNullOrWhiteSpace(profile.City))
            {
                var cityStr = !string.IsNullOrWhiteSpace(profile.PostalCode) ? $"{profile.PostalCode} {profile.City}" : profile.City;
                contactItems.Add(cityStr);
            }
            if (!string.IsNullOrWhiteSpace(profile.Website)) contactItems.Add(profile.Website);

            if (contactItems.Count > 0)
            {
                body.AppendChild(CreateParagraph(string.Join("  •  ", contactItems), fontSize: 19, colorHex: "64748b", fontName: fontName, spaceAfter: 200));
            }

            // Bio / Summary
            if (!string.IsNullOrWhiteSpace(profile.Bio))
            {
                body.AppendChild(CreateSectionHeading(isEn ? "PROFESSIONAL SUMMARY" : "ÜBER MICH", accentHex, fontName));
                body.AppendChild(CreateParagraph(profile.Bio, fontSize: 20, fontName: fontName, spaceAfter: 160));
            }

            // Work Experience
            if (profile.Experiences.Count > 0)
            {
                body.AppendChild(CreateSectionHeading(isEn ? "WORK EXPERIENCE" : "BERUFSERFAHRUNG", accentHex, fontName));
                var table = CreateTwoColumnTable();

                foreach (var exp in profile.Experiences)
                {
                    var dateRange = exp.IsCurrent
                        ? $"{exp.StartDate} - {(isEn ? "Present" : "heute")}"
                        : $"{exp.StartDate} - {exp.EndDate}";

                    var details = new List<Paragraph>
                    {
                        CreateParagraph(exp.JobTitle, fontSize: 21, isBold: true, colorHex: "0f172a", fontName: fontName, spaceAfter: 30)
                    };

                    var companyLine = exp.Employer + (!string.IsNullOrWhiteSpace(exp.City) ? $", {exp.City}" : "");
                    details.Add(CreateParagraph(companyLine, fontSize: 19, colorHex: "475569", fontName: fontName, spaceAfter: 40));

                    if (!string.IsNullOrWhiteSpace(exp.Description))
                    {
                        details.Add(CreateParagraph(exp.Description, fontSize: 19, colorHex: "334155", fontName: fontName, spaceAfter: 80));
                    }

                    table.AppendChild(CreateTableRow(dateRange, details, fontName));
                }

                body.AppendChild(table);
                body.AppendChild(CreateSpacer(120));
            }

            // Education
            if (profile.Educations.Count > 0)
            {
                body.AppendChild(CreateSectionHeading(isEn ? "EDUCATION" : "AUSBILDUNG & STUDIUM", accentHex, fontName));
                var table = CreateTwoColumnTable();

                foreach (var edu in profile.Educations)
                {
                    var dateRange = edu.IsCurrent
                        ? $"{edu.StartDate} - {(isEn ? "Present" : "heute")}"
                        : $"{edu.StartDate} - {edu.EndDate}";

                    var title = !string.IsNullOrWhiteSpace(edu.Degree) && !string.IsNullOrWhiteSpace(edu.FieldOfStudy)
                        ? $"{edu.Degree} in {edu.FieldOfStudy}"
                        : edu.Degree ?? edu.FieldOfStudy ?? "";

                    var details = new List<Paragraph>
                    {
                        CreateParagraph(title, fontSize: 21, isBold: true, colorHex: "0f172a", fontName: fontName, spaceAfter: 30)
                    };

                    var instLine = edu.Institution + (!string.IsNullOrWhiteSpace(edu.City) ? $", {edu.City}" : "");
                    if (!string.IsNullOrWhiteSpace(edu.Grade))
                    {
                        instLine += $"  •  {(isEn ? "Grade:" : "Note:")} {edu.Grade}";
                    }
                    details.Add(CreateParagraph(instLine, fontSize: 19, colorHex: "475569", fontName: fontName, spaceAfter: 40));

                    if (!string.IsNullOrWhiteSpace(edu.Description))
                    {
                        details.Add(CreateParagraph(edu.Description, fontSize: 19, colorHex: "334155", fontName: fontName, spaceAfter: 80));
                    }

                    table.AppendChild(CreateTableRow(dateRange, details, fontName));
                }

                body.AppendChild(table);
                body.AppendChild(CreateSpacer(120));
            }

            // Skills
            if (profile.Skills.Count > 0)
            {
                body.AppendChild(CreateSectionHeading(isEn ? "SKILLS & COMPETENCES" : "FACHLICHE KOMPETENZEN", accentHex, fontName));
                var skillsByCat = profile.Skills.GroupBy(s => s.Category ?? "").OrderBy(g => g.Key);

                foreach (var group in skillsByCat)
                {
                    var catLabel = string.IsNullOrWhiteSpace(group.Key) ? (isEn ? "Skills" : "Kenntnisse") : group.Key;
                    var skillNames = string.Join(", ", group.Select(s => s.Name));
                    var p = CreateParagraph($"{catLabel}: ", fontSize: 20, isBold: true, colorHex: "1e293b", fontName: fontName, spaceAfter: 60);
                    p.AppendChild(CreateRun(skillNames, fontSize: 20, isBold: false, colorHex: "334155", fontName: fontName));
                    body.AppendChild(p);
                }
                body.AppendChild(CreateSpacer(80));
            }

            // Languages
            if (profile.Languages.Count > 0)
            {
                body.AppendChild(CreateSectionHeading(isEn ? "LANGUAGES" : "SPRACHEN", accentHex, fontName));
                var langList = string.Join("   •   ", profile.Languages.Select(l =>
                    string.IsNullOrWhiteSpace(l.Level) ? l.Language : $"{l.Language} ({l.Level})"));
                body.AppendChild(CreateParagraph(langList, fontSize: 20, fontName: fontName, spaceAfter: 120));
            }

            // Certificates
            if (profile.Certificates.Count > 0)
            {
                body.AppendChild(CreateSectionHeading(isEn ? "CERTIFICATES" : "ZERTIFIKATE & WEITERBILDUNG", accentHex, fontName));
                foreach (var cert in profile.Certificates)
                {
                    var certLine = cert.Title + (!string.IsNullOrWhiteSpace(cert.Issuer) ? $" ({cert.Issuer})" : "")
                        + (!string.IsNullOrWhiteSpace(cert.IssueDate) ? $"  —  {cert.IssueDate}" : "");
                    body.AppendChild(CreateParagraph(certLine, fontSize: 20, fontName: fontName, spaceAfter: 50));
                }
                body.AppendChild(CreateSpacer(80));
            }

            // Interests
            if (profile.Interests.Count > 0)
            {
                body.AppendChild(CreateSectionHeading(isEn ? "INTERESTS" : "INTERESSEN & HOBBYS", accentHex, fontName));
                var interestList = string.Join("   •   ", profile.Interests.Select(i => i.Name));
                body.AppendChild(CreateParagraph(interestList, fontSize: 20, fontName: fontName, spaceAfter: 120));
            }

            body.AppendChild(sectionProps);
            mainPart.Document.Save();
        }

        return stream.ToArray();
    }

    public byte[] RenderCoverLetterDocx(CoverLetterDto coverLetter, CoverLetterRenderOptions options)
    {
        using var stream = new MemoryStream();
        using (var wordDoc = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document, true))
        {
            var mainPart = wordDoc.AddMainDocumentPart();
            mainPart.Document = new Document();
            var body = mainPart.Document.AppendChild(new Body());

            var accentHex = NormalizeHexWithoutHash(options.NormalizedAccentColor);
            var fontName = options.NormalizedFont;

            var sectionProps = new SectionProperties();
            var pageMargin = new PageMargin
            {
                Top = 20 * TwipsPerMm,
                Bottom = 20 * TwipsPerMm,
                Left = 25 * TwipsPerMm, // DIN 5008 left margin 25mm
                Right = 20 * TwipsPerMm
            };
            sectionProps.AppendChild(pageMargin);

            // Sender Header (top)
            if (!string.IsNullOrWhiteSpace(coverLetter.SenderName))
            {
                body.AppendChild(CreateParagraph(coverLetter.SenderName, fontSize: 28, isBold: true, colorHex: accentHex, fontName: fontName, spaceAfter: 40));
            }

            var senderInfo = new List<string>();
            if (!string.IsNullOrWhiteSpace(coverLetter.SenderStreet)) senderInfo.Add(coverLetter.SenderStreet);
            if (!string.IsNullOrWhiteSpace(coverLetter.SenderPostalCode) || !string.IsNullOrWhiteSpace(coverLetter.SenderCity))
            {
                senderInfo.Add($"{coverLetter.SenderPostalCode} {coverLetter.SenderCity}".Trim());
            }
            if (!string.IsNullOrWhiteSpace(coverLetter.SenderPhone)) senderInfo.Add(coverLetter.SenderPhone);
            if (!string.IsNullOrWhiteSpace(coverLetter.SenderEmail)) senderInfo.Add(coverLetter.SenderEmail);

            if (senderInfo.Count > 0)
            {
                body.AppendChild(CreateParagraph(string.Join("  •  ", senderInfo), fontSize: 17, colorHex: "64748b", fontName: fontName, spaceAfter: 240));
            }

            // DIN 5008 Return Address Line (small 7pt)
            var returnAddressParts = new List<string>();
            if (!string.IsNullOrWhiteSpace(coverLetter.SenderName)) returnAddressParts.Add(coverLetter.SenderName);
            if (!string.IsNullOrWhiteSpace(coverLetter.SenderStreet)) returnAddressParts.Add(coverLetter.SenderStreet);
            if (!string.IsNullOrWhiteSpace(coverLetter.SenderCity))
            {
                returnAddressParts.Add($"{coverLetter.SenderPostalCode} {coverLetter.SenderCity}".Trim());
            }

            if (returnAddressParts.Count > 0)
            {
                body.AppendChild(CreateParagraph(string.Join(" • ", returnAddressParts), fontSize: 15, colorHex: "94a3b8", fontName: fontName, spaceAfter: 60));
            }

            // Recipient Address
            body.AppendChild(CreateParagraph(coverLetter.RecipientCompany, fontSize: 20, isBold: true, fontName: fontName, spaceAfter: 20));
            if (!string.IsNullOrWhiteSpace(coverLetter.RecipientDepartment))
            {
                body.AppendChild(CreateParagraph(coverLetter.RecipientDepartment, fontSize: 20, fontName: fontName, spaceAfter: 20));
            }
            if (!string.IsNullOrWhiteSpace(coverLetter.RecipientContactPerson))
            {
                body.AppendChild(CreateParagraph(coverLetter.RecipientContactPerson, fontSize: 20, fontName: fontName, spaceAfter: 20));
            }
            if (!string.IsNullOrWhiteSpace(coverLetter.RecipientStreet))
            {
                body.AppendChild(CreateParagraph(coverLetter.RecipientStreet, fontSize: 20, fontName: fontName, spaceAfter: 20));
            }
            var recipientCityLine = $"{coverLetter.RecipientPostalCode} {coverLetter.RecipientCity}".Trim();
            body.AppendChild(CreateParagraph(recipientCityLine, fontSize: 20, fontName: fontName, spaceAfter: 200));

            // Date & Place Line (Right aligned)
            var dateStr = (!string.IsNullOrWhiteSpace(coverLetter.Place) && !string.IsNullOrWhiteSpace(coverLetter.Date))
                ? $"{coverLetter.Place}, {coverLetter.Date}"
                : coverLetter.Date ?? coverLetter.Place ?? "";

            if (!string.IsNullOrWhiteSpace(dateStr))
            {
                var dateP = CreateParagraph(dateStr, fontSize: 20, colorHex: "475569", fontName: fontName, spaceAfter: 200);
                dateP.ParagraphProperties ??= new ParagraphProperties();
                dateP.ParagraphProperties.Justification = new Justification { Val = JustificationValues.Right };
                body.AppendChild(dateP);
            }

            // Subject Line (bold, DIN 5008 without "Betreff:")
            body.AppendChild(CreateParagraph(coverLetter.Subject, fontSize: 24, isBold: true, colorHex: accentHex, fontName: fontName, spaceAfter: 160));

            // Salutation
            body.AppendChild(CreateParagraph(coverLetter.Salutation, fontSize: 21, isBold: true, fontName: fontName, spaceAfter: 120));

            // Letter Body
            var paragraphs = coverLetter.Body.Split(new[] { "\r\n\r\n", "\n\n" }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var pText in paragraphs)
            {
                var clean = pText.Trim();
                if (clean.Length > 0)
                {
                    body.AppendChild(CreateParagraph(clean, fontSize: 21, fontName: fontName, spaceAfter: 140));
                }
            }

            // Closing
            body.AppendChild(CreateParagraph(coverLetter.Closing, fontSize: 21, fontName: fontName, spaceAfter: 280));

            // Signature Name
            var sigName = !string.IsNullOrWhiteSpace(coverLetter.SignatureName) ? coverLetter.SignatureName : coverLetter.SenderName;
            if (!string.IsNullOrWhiteSpace(sigName))
            {
                body.AppendChild(CreateParagraph(sigName, fontSize: 21, isBold: true, fontName: fontName, spaceAfter: 240));
            }

            // Attachments Note
            if (!string.IsNullOrWhiteSpace(coverLetter.AttachmentsNote))
            {
                var noteTitle = options.NormalizedLanguage == "en" ? "Attachments" : "Anlagen";
                body.AppendChild(CreateParagraph(noteTitle, fontSize: 19, isBold: true, colorHex: "475569", fontName: fontName, spaceAfter: 40));
                body.AppendChild(CreateParagraph(coverLetter.AttachmentsNote, fontSize: 18, colorHex: "64748b", fontName: fontName, spaceAfter: 80));
            }

            body.AppendChild(sectionProps);
            mainPart.Document.Save();
        }

        return stream.ToArray();
    }

    private static Paragraph CreateSectionHeading(string title, string colorHex, string fontName)
    {
        var p = new Paragraph();
        var pPr = new ParagraphProperties(
            new SpacingBetweenLines { Before = "240", After = "80" },
            new ParagraphBorders(new BottomBorder { Val = BorderValues.Single, Size = 6, Color = colorHex })
        );
        p.AppendChild(pPr);

        var run = new Run();
        var rPr = new RunProperties(
            new RunFonts { Ascii = fontName, HighAnsi = fontName },
            new Bold(),
            new Color { Val = colorHex },
            new FontSize { Val = "24" } // 12pt
        );
        run.AppendChild(rPr);
        run.AppendChild(new Text(title));
        p.AppendChild(run);
        return p;
    }

    private static Paragraph CreateParagraph(string text, int fontSize = 21, bool isBold = false, string? colorHex = null, string fontName = "Liberation Sans", int spaceAfter = 80)
    {
        var p = new Paragraph();
        var pPr = new ParagraphProperties(new SpacingBetweenLines { After = spaceAfter.ToString() });
        p.AppendChild(pPr);

        var run = CreateRun(text, fontSize, isBold, colorHex, fontName);
        p.AppendChild(run);
        return p;
    }

    private static Run CreateRun(string text, int fontSize = 21, bool isBold = false, string? colorHex = null, string fontName = "Liberation Sans")
    {
        var run = new Run();
        var rPr = new RunProperties(
            new RunFonts { Ascii = fontName, HighAnsi = fontName },
            new FontSize { Val = fontSize.ToString() }
        );
        if (isBold) rPr.AppendChild(new Bold());
        if (!string.IsNullOrWhiteSpace(colorHex)) rPr.AppendChild(new Color { Val = colorHex });
        run.AppendChild(rPr);
        run.AppendChild(new Text(text) { Space = SpaceProcessingModeValues.Preserve });
        return run;
    }

    private static Paragraph CreateSpacer(int heightTwips)
    {
        var p = new Paragraph();
        p.AppendChild(new ParagraphProperties(new SpacingBetweenLines { After = heightTwips.ToString() }));
        return p;
    }

    private static Table CreateTwoColumnTable()
    {
        var table = new Table();
        var tblPr = new TableProperties(
            new TableWidth { Width = "5000", Type = TableWidthUnitValues.Pct },
            new TableBorders(
                new TopBorder { Val = BorderValues.None },
                new LeftBorder { Val = BorderValues.None },
                new RightBorder { Val = BorderValues.None },
                new BottomBorder { Val = BorderValues.None },
                new InsideHorizontalBorder { Val = BorderValues.None },
                new InsideVerticalBorder { Val = BorderValues.None }
            )
        );
        table.AppendChild(tblPr);
        return table;
    }

    private static TableRow CreateTableRow(string dateColumnText, IEnumerable<Paragraph> detailsParagraphs, string fontName)
    {
        var row = new TableRow();

        // Left column (Date range, ~28% width)
        var dateCell = new TableCell();
        dateCell.AppendChild(new TableCellProperties(new TableCellWidth { Width = "1400", Type = TableWidthUnitValues.Pct }));
        var dateP = CreateParagraph(dateColumnText, fontSize: 19, isBold: true, colorHex: "475569", fontName: fontName, spaceAfter: 60);
        dateCell.AppendChild(dateP);
        row.AppendChild(dateCell);

        // Right column (Details, ~72% width)
        var detailsCell = new TableCell();
        detailsCell.AppendChild(new TableCellProperties(new TableCellWidth { Width = "3600", Type = TableWidthUnitValues.Pct }));
        foreach (var p in detailsParagraphs)
        {
            detailsCell.AppendChild(p);
        }
        row.AppendChild(detailsCell);

        return row;
    }

    private static string NormalizeHexWithoutHash(string hex)
    {
        var clean = hex.Trim().TrimStart('#');
        return clean.Length == 6 ? clean : "14213D";
    }
}
