// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Cv.Server.Controllers;
using Cv.Server.Documents;
using Cv.Server.Tests.Support;

namespace Cv.Server.Tests;

public class DocumentRenderTests(ServerFixture fixture) : IClassFixture<ServerFixture>
{
    private static ProfileResponse CreateSampleProfile(string firstName = "Erika", string lastName = "Musterfrau")
    {
        return new ProfileResponse(
            Id: Guid.NewGuid(),
            FirstName: firstName,
            LastName: lastName,
            AcademicTitle: "M.Sc.",
            ProfessionalTitle: "Senior Cloud Engineer",
            Email: "erika@example.org",
            Phone: "+49 170 1234567",
            Street: "Musterstraße 42",
            PostalCode: "10115",
            City: "Berlin",
            Country: "Deutschland",
            DateOfBirth: "1990-05-14",
            PlaceOfBirth: "Hamburg",
            Nationality: "Deutsch",
            MaritalStatus: "Ledig",
            Website: "https://erika-musterfrau.dev",
            LinkedIn: "https://linkedin.com/in/erika-musterfrau",
            GitHub: "https://github.com/erika-musterfrau",
            Xing: null,
            Bio: "Leidenschaftliche Software-Architektin mit Fokus auf verteilte Systeme, Cloud-Native und hohe Zuverlässigkeit.",
            HasPhoto: false,
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: DateTime.UtcNow,
            Experiences:
            [
                new ExperienceDto(
                    Guid.NewGuid(),
                    "Lead Developer",
                    "TechCorp AG",
                    "Vollzeit",
                    "Berlin",
                    "Deutschland",
                    "2022-01",
                    null,
                    true,
                    "Leitung eines 8-köpfigen Teams, Migration auf Kubernetes, Optimierung der CI/CD-Pipelines.",
                    0,
                    DateTime.UtcNow,
                    DateTime.UtcNow),
                new ExperienceDto(
                    Guid.NewGuid(),
                    "Software Engineer",
                    "InnoSystems GmbH",
                    "Vollzeit",
                    "München",
                    "Deutschland",
                    "2018-03",
                    "2021-12",
                    false,
                    "Entwicklung von Microservices mit C#/.NET und React.",
                    1,
                    DateTime.UtcNow,
                    DateTime.UtcNow)
            ],
            Educations:
            [
                new EducationDto(
                    Guid.NewGuid(),
                    "Master of Science",
                    "Informatik",
                    "TU Berlin",
                    "Berlin",
                    "Deutschland",
                    "2015-10",
                    "2017-09",
                    false,
                    "1.3",
                    "Schwerpunkt Verteilte Systeme und Datenbanken.",
                    0,
                    DateTime.UtcNow,
                    DateTime.UtcNow)
            ],
            Skills:
            [
                new SkillDto(Guid.NewGuid(), "C# / .NET", "Backend", 5, 0, DateTime.UtcNow, DateTime.UtcNow),
                new SkillDto(Guid.NewGuid(), "TypeScript / React", "Frontend", 4, 1, DateTime.UtcNow, DateTime.UtcNow),
                new SkillDto(Guid.NewGuid(), "Docker & Kubernetes", "DevOps", 4, 2, DateTime.UtcNow, DateTime.UtcNow)
            ],
            Languages:
            [
                new LanguageDto(Guid.NewGuid(), "Deutsch", "Muttersprache", 0, DateTime.UtcNow, DateTime.UtcNow),
                new LanguageDto(Guid.NewGuid(), "Englisch", "C1", 1, DateTime.UtcNow, DateTime.UtcNow)
            ],
            Certificates:
            [
                new CertificateDto(Guid.NewGuid(), "AWS Certified Solutions Architect", "Amazon Web Services", "2023-04", "2026-04", "https://aws.amazon.com", "AWS-12345", 0, DateTime.UtcNow, DateTime.UtcNow)
            ],
            Interests:
            [
                new InterestDto(Guid.NewGuid(), "Open Source", "Technik", "Mitwirkung an OSS-Tools", 0, DateTime.UtcNow, DateTime.UtcNow),
                new InterestDto(Guid.NewGuid(), "Klettern & Bouldern", "Sport", null, 1, DateTime.UtcNow, DateTime.UtcNow)
            ],
            CustomSections:
            [
                new CustomSectionDto(Guid.NewGuid(), "Auszeichnungen", 0, DateTime.UtcNow, DateTime.UtcNow,
                [
                    new CustomSectionItemDto(Guid.NewGuid(), "Best Paper Award", "Cloud Conference", "2021", "Auszeichnung für herausragende Forschung im Bereich Container-Sicherheit.", 0, DateTime.UtcNow, DateTime.UtcNow)
                ])
            ]
        );
    }

    [Fact]
    public void TypstRenderer_RendersClassicDesignSuccessfully()
    {
        var renderer = new TypstRenderer();
        var profile = CreateSampleProfile();
        var options = new CvRenderOptions(
            Design: "classic",
            AccentColor: "#14213D",
            Font: "Liberation Sans",
            ShowPhoto: false,
            PhotoShape: "rounded",
            Language: "de");

        var pdf = renderer.RenderPdf(profile, options);

        Assert.NotNull(pdf);
        Assert.True(pdf.Length > 1000);
        // Verify PDF signature %PDF-
        Assert.Equal((byte)'%', pdf[0]);
        Assert.Equal((byte)'P', pdf[1]);
        Assert.Equal((byte)'D', pdf[2]);
        Assert.Equal((byte)'F', pdf[3]);
    }

    [Fact]
    public void TypstRenderer_RendersModernDesignSuccessfully()
    {
        var renderer = new TypstRenderer();
        var profile = CreateSampleProfile();
        var options = new CvRenderOptions(
            Design: "modern",
            AccentColor: "#0284c7",
            Font: "Liberation Sans",
            ShowPhoto: false,
            PhotoShape: "round",
            Language: "en");

        var pdf = renderer.RenderPdf(profile, options);

        Assert.NotNull(pdf);
        Assert.True(pdf.Length > 1000);
        Assert.Equal((byte)'%', pdf[0]);
        Assert.Equal((byte)'P', pdf[1]);
        Assert.Equal((byte)'D', pdf[2]);
        Assert.Equal((byte)'F', pdf[3]);
    }

    [Fact]
    public void TypstRenderer_RendersPlainDesignSuccessfully()
    {
        var renderer = new TypstRenderer();
        var profile = CreateSampleProfile();
        var options = new CvRenderOptions(
            Design: "plain",
            AccentColor: null,
            Font: "Liberation Sans",
            ShowPhoto: false,
            PhotoShape: "rect",
            Language: "de");

        var pdf = renderer.RenderPdf(profile, options);

        Assert.NotNull(pdf);
        Assert.True(pdf.Length > 1000);
        Assert.Equal((byte)'%', pdf[0]);
        Assert.Equal((byte)'P', pdf[1]);
        Assert.Equal((byte)'D', pdf[2]);
        Assert.Equal((byte)'F', pdf[3]);
    }

    [Fact]
    public void TypstRenderer_RendersWithPhotoSuccessfully()
    {
        var renderer = new TypstRenderer();
        var profile = CreateSampleProfile();
        // 1x1 transparent PNG
        byte[] pngBytes = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
        string tempDir = Path.Combine(Path.GetTempPath(), "cv_test_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        string photoFile = Path.Combine(tempDir, "avatar.png");
        try
        {
            File.WriteAllBytes(photoFile, pngBytes);
            var options = new CvRenderOptions(
                Design: "classic",
                AccentColor: "#059669",
                Font: "Liberation Sans",
                ShowPhoto: true,
                PhotoShape: "round",
                Language: "de");

            var pdf = renderer.RenderPdf(profile, options, photoFile);
            Assert.NotNull(pdf);
            Assert.True(pdf.Length > 1000);
        }
        finally
        {
            if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
        }
    }

    [Fact]
    public void TypstRenderer_HandlesMaliciousTypstInjectionGracefully()
    {
        var renderer = new TypstRenderer();
        // Malicious user payload attempting to inject Typst markup / code execution
        var maliciousBio = """
            #import "malicious.typ"
            #panic("injected!")
            #let x = sys.inputs
            """;
        var profile = CreateSampleProfile(firstName: "#eval(\"x\")", lastName: "#[bold text]");
        var malProfile = profile with { Bio = maliciousBio };
        var options = new CvRenderOptions("classic", "#14213D", "Liberation Sans", false, "rounded", "de");

        // Must compile successfully without executing the markup, treating it as pure string literals
        var pdf = renderer.RenderPdf(malProfile, options);
        Assert.NotNull(pdf);
        Assert.True(pdf.Length > 1000);
    }

    [Fact]
    public async Task PreviewPdf_Endpoint_RequiresAuthentication()
    {
        var anon = fixture.Client();
        var response = await anon.PostAsync(
            "/api/profile/preview/pdf",
            new CvRenderOptions("classic", null, null, null, null, null));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PreviewPdf_Endpoint_ReturnsPdfStream()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "pdfpreviewuser");

        var response = await user.PostAsync(
            "/api/profile/preview/pdf",
            new CvRenderOptions("classic", "#14213D", "Liberation Sans", false, "rounded", "de"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);

        var bytes = await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        Assert.NotNull(bytes);
        Assert.True(bytes.Length > 500);
        Assert.Equal((byte)'%', bytes[0]);
        Assert.Equal((byte)'P', bytes[1]);
        Assert.Equal((byte)'D', bytes[2]);
        Assert.Equal((byte)'F', bytes[3]);
    }

    [Fact]
    public async Task ExportPdf_Endpoint_ReturnsPdfWithFilename()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "pdfexportuser");

        // Put some personal name
        await user.PutAsync("/api/profile", new PersonalDataRequest(
            FirstName: "Max",
            LastName: "Mustermann",
            AcademicTitle: null,
            ProfessionalTitle: "Dev",
            Email: null,
            Phone: null,
            Street: null,
            PostalCode: null,
            City: null,
            Country: null,
            DateOfBirth: null,
            PlaceOfBirth: null,
            Nationality: null,
            MaritalStatus: null,
            Website: null,
            LinkedIn: null,
            GitHub: null,
            Xing: null,
            Bio: null));

        var response = await user.PostAsync(
            "/api/profile/export/pdf",
            new CvRenderOptions("modern", "#0284c7", "Liberation Sans", false, "round", "de"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType?.MediaType);
        Assert.NotNull(response.Content.Headers.ContentDisposition);
        Assert.Contains("Lebenslauf_Max_Mustermann.pdf", response.Content.Headers.ContentDisposition.FileName ?? "");

        var bytes = await response.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        Assert.NotNull(bytes);
        Assert.True(bytes.Length > 500);
        Assert.Equal((byte)'%', bytes[0]);
    }
}
