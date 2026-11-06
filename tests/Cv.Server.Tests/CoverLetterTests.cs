// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using System.Net;
using Cv.Server.Controllers;
using Cv.Server.Documents;
using Cv.Server.Tests.Support;

namespace Cv.Server.Tests;

public class CoverLetterTests(ServerFixture fixture) : IClassFixture<ServerFixture>
{
    private static object CreateSampleRequest() => new
    {
        title = "Bewerbung als Senior Cloud Architect",
        senderName = "Erika Musterfrau",
        senderStreet = "Musterstraße 42",
        senderPostalCode = "10115",
        senderCity = "Berlin",
        senderPhone = "+49 170 1234567",
        senderEmail = "erika@example.org",
        recipientCompany = "CloudScale GmbH",
        recipientDepartment = "HR Talent Acquisition",
        recipientContactPerson = "Herr Dr. Markus Schmidt",
        recipientStreet = "Innovationspark 1",
        recipientPostalCode = "80331",
        recipientCity = "München",
        recipientCountry = "Deutschland",
        place = "Berlin",
        date = "06.11.2026",
        subject = "Bewerbung als Senior Cloud Architect (Ref: CLD-2026)",
        salutation = "Sehr geehrter Herr Dr. Schmidt,",
        body = "mit großem Interesse verfolge ich die Entwicklungen Ihres Unternehmens im Bereich Cloud-Infrastruktur.\n\nIn meiner bisherigen Position konnte ich komplexe Multi-Region-Cluster aufbauen und die Verfügbarkeit auf 99,99% steigern.\n\nIch freue mich über die Einladung zu einem persönlichen Gespräch.",
        closing = "Mit freundlichen Grüßen",
        signatureName = "Erika Musterfrau",
        attachmentsNote = "Lebenslauf, Arbeitszeugnisse, Zertifikate",
        language = "de",
        font = "Liberation Sans",
        accentColor = "#14213D"
    };

    [Fact]
    public async Task CoverLetters_CrudLifecycleWorksProperly()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "cluser1");

        // 1. Initially listing succeeds
        var initialList = await user.GetAsync("/api/cover-letters");
        Assert.Equal(HttpStatusCode.OK, initialList.StatusCode);
        var initialJson = await initialList.JsonAsync();
        Assert.Equal(System.Text.Json.JsonValueKind.Array, initialJson.ValueKind);

        // 2. Create cover letter
        var req = CreateSampleRequest();
        var createRes = await user.PostAsync("/api/cover-letters", req);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var created = await createRes.JsonAsync();
        var createdId = created.GetProperty("id").GetString()!;
        Assert.Equal("Bewerbung als Senior Cloud Architect", created.GetProperty("title").GetString());
        Assert.Equal("CloudScale GmbH", created.GetProperty("recipientCompany").GetString());
        Assert.Equal("Bewerbung als Senior Cloud Architect (Ref: CLD-2026)", created.GetProperty("subject").GetString());
        Assert.False(created.GetProperty("hasSignature").GetBoolean());

        // 3. Get single cover letter
        var getRes = await user.GetAsync($"/api/cover-letters/{createdId}");
        Assert.Equal(HttpStatusCode.OK, getRes.StatusCode);
        var fetched = await getRes.JsonAsync();
        Assert.Equal(createdId, fetched.GetProperty("id").GetString());
        Assert.Equal("München", fetched.GetProperty("recipientCity").GetString());

        // 4. Update cover letter
        var updateReq = new
        {
            title = "Aktualisierte Bewerbung Cloud Architect",
            recipientCompany = "CloudScale International AG",
            recipientCity = "München",
            subject = "Bewerbung als Lead Architect",
            salutation = "Sehr geehrte Damen und Herren,",
            body = "Aktualisierter Text.",
            closing = "Mit freundlichen Grüßen"
        };
        var putRes = await user.PutAsync($"/api/cover-letters/{createdId}", updateReq);
        Assert.Equal(HttpStatusCode.OK, putRes.StatusCode);
        var updated = await putRes.JsonAsync();
        Assert.Equal("Aktualisierte Bewerbung Cloud Architect", updated.GetProperty("title").GetString());
        Assert.Equal("CloudScale International AG", updated.GetProperty("recipientCompany").GetString());
        Assert.Equal("Bewerbung als Lead Architect", updated.GetProperty("subject").GetString());

        // 5. Delete cover letter
        var deleteRes = await user.DeleteAsync($"/api/cover-letters/{createdId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteRes.StatusCode);

        // 6. Confirm 404
        var getAfterDelete = await user.GetAsync($"/api/cover-letters/{createdId}");
        Assert.Equal(HttpStatusCode.NotFound, getAfterDelete.StatusCode);
    }

    [Fact]
    public async Task CoverLetters_ValidationRejectsInvalidPayloads()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "cluser2");

        // Missing Title
        var bad1 = await user.PostAsync("/api/cover-letters", new { title = "", recipientCompany = "A", recipientCity = "B", subject = "C", salutation = "D", body = "E" });
        Assert.Equal(HttpStatusCode.BadRequest, bad1.StatusCode);

        // Missing RecipientCompany
        var bad2 = await user.PostAsync("/api/cover-letters", new { title = "T", recipientCompany = "", recipientCity = "B", subject = "C", salutation = "D", body = "E" });
        Assert.Equal(HttpStatusCode.BadRequest, bad2.StatusCode);

        // Missing RecipientCity
        var bad3 = await user.PostAsync("/api/cover-letters", new { title = "T", recipientCompany = "A", recipientCity = "", subject = "C", salutation = "D", body = "E" });
        Assert.Equal(HttpStatusCode.BadRequest, bad3.StatusCode);

        // Missing Subject
        var bad4 = await user.PostAsync("/api/cover-letters", new { title = "T", recipientCompany = "A", recipientCity = "B", subject = "", salutation = "D", body = "E" });
        Assert.Equal(HttpStatusCode.BadRequest, bad4.StatusCode);

        // Missing Body
        var bad5 = await user.PostAsync("/api/cover-letters", new { title = "T", recipientCompany = "A", recipientCity = "B", subject = "C", salutation = "D", body = "" });
        Assert.Equal(HttpStatusCode.BadRequest, bad5.StatusCode);
    }

    [Fact]
    public void TypstRenderer_RendersDIN5008CoverLetterSuccessfully()
    {
        var renderer = new TypstRenderer();
        var dto = new CoverLetterDto(
            Guid.NewGuid(),
            "Bewerbung als Senior Cloud Architect",
            "Erika Musterfrau",
            "Musterstraße 42",
            "10115",
            "Berlin",
            "+49 170 1234567",
            "erika@example.org",
            "CloudScale GmbH",
            "HR Talent Acquisition",
            "Herr Dr. Markus Schmidt",
            "Innovationspark 1",
            "80331",
            "München",
            "Deutschland",
            "Berlin",
            "06.11.2026",
            "Bewerbung als Senior Cloud Architect (Ref: CLD-2026)",
            "Sehr geehrter Herr Dr. Schmidt,",
            "mit großem Interesse verfolge ich Ihre Entwicklungen.\n\nIch freue mich über ein Gespräch.",
            "Mit freundlichen Grüßen",
            "Erika Musterfrau",
            false,
            "Anlagen",
            "de",
            "Liberation Sans",
            "#14213D",
            DateTime.UtcNow,
            DateTime.UtcNow
        );

        var options = new CoverLetterRenderOptions(
            Font: "Liberation Sans",
            AccentColor: "#14213D",
            Language: "de",
            IncludeFoldMarks: true
        );

        var pdf = renderer.RenderCoverLetterPdf(dto, options);

        Assert.NotNull(pdf);
        Assert.True(pdf.Length > 1000);
        Assert.Equal((byte)'%', pdf[0]);
        Assert.Equal((byte)'P', pdf[1]);
        Assert.Equal((byte)'D', pdf[2]);
        Assert.Equal((byte)'F', pdf[3]);
    }

    [Fact]
    public void TypstRenderer_RendersCoverSheetSuccessfully()
    {
        var renderer = new TypstRenderer();
        var profile = new ProfileResponse(
            Id: Guid.NewGuid(),
            FirstName: "Max",
            LastName: "Mustermann",
            AcademicTitle: "Dr.",
            ProfessionalTitle: "Senior IT Architect",
            Email: "max@example.com",
            Phone: "+49 30 123456",
            Street: "Hauptstr. 10",
            PostalCode: "10115",
            City: "Berlin",
            Country: "Deutschland",
            DateOfBirth: null,
            PlaceOfBirth: null,
            Nationality: null,
            MaritalStatus: null,
            Website: "https://example.com",
            LinkedIn: null,
            GitHub: null,
            Xing: null,
            Bio: "Erfahrener Architekt.",
            HasPhoto: false,
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: DateTime.UtcNow,
            Experiences: [],
            Educations: [],
            Skills: [],
            Languages: [],
            Certificates: [],
            Interests: [],
            CustomSections: []
        );

        var options = new CoverSheetOptions(
            TargetJob: "Chief Technology Officer",
            TargetCompany: "Enterprise Systems SE",
            Contents: ["Anschreiben", "Lebenslauf", "Zertifikate"],
            AccentColor: "#2563eb",
            Font: "Liberation Sans",
            ShowPhoto: false,
            PhotoShape: "rounded",
            Language: "de"
        );

        var pdf = renderer.RenderCoverSheetPdf(profile, options);

        Assert.NotNull(pdf);
        Assert.True(pdf.Length > 1000);
        Assert.Equal((byte)'%', pdf[0]);
        Assert.Equal((byte)'P', pdf[1]);
        Assert.Equal((byte)'D', pdf[2]);
        Assert.Equal((byte)'F', pdf[3]);
    }

    [Fact]
    public void DocxRenderer_RendersValidResumeAndCoverLetterDocuments()
    {
        var docxRenderer = new DocxRenderer();

        var profile = new ProfileResponse(
            Id: Guid.NewGuid(),
            FirstName: "Julia",
            LastName: "Neumann",
            AcademicTitle: null,
            ProfessionalTitle: "DevOps Engineer",
            Email: "julia@example.com",
            Phone: "+49 160 99887766",
            Street: "Weg 5",
            PostalCode: "20095",
            City: "Hamburg",
            Country: "Deutschland",
            DateOfBirth: null,
            PlaceOfBirth: null,
            Nationality: null,
            MaritalStatus: null,
            Website: null,
            LinkedIn: null,
            GitHub: null,
            Xing: null,
            Bio: "Kubernetes and CI/CD specialist.",
            HasPhoto: false,
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: DateTime.UtcNow,
            Experiences:
            [
                new ExperienceDto(Guid.NewGuid(), "Site Reliability Engineer", "Global Cloud", null, "Hamburg", null, "2020-01", null, true, "Managing multi-region Kubernetes clusters.", 0, DateTime.UtcNow, DateTime.UtcNow)
            ],
            Educations:
            [
                new EducationDto(Guid.NewGuid(), "B.Sc.", "Informatik", "TU Hamburg", "Hamburg", null, "2016-10", "2019-09", false, "1.4", null, 0, DateTime.UtcNow, DateTime.UtcNow)
            ],
            Skills:
            [
                new SkillDto(Guid.NewGuid(), "Kubernetes", "DevOps", 5, 0, DateTime.UtcNow, DateTime.UtcNow),
                new SkillDto(Guid.NewGuid(), "Terraform", "DevOps", 4, 1, DateTime.UtcNow, DateTime.UtcNow)
            ],
            Languages:
            [
                new LanguageDto(Guid.NewGuid(), "Deutsch", "C2", 0, DateTime.UtcNow, DateTime.UtcNow),
                new LanguageDto(Guid.NewGuid(), "Englisch", "C1", 1, DateTime.UtcNow, DateTime.UtcNow)
            ],
            Certificates:
            [
                new CertificateDto(Guid.NewGuid(), "CKA - Certified Kubernetes Administrator", "CNCF", "2022-05", null, null, null, 0, DateTime.UtcNow, DateTime.UtcNow)
            ],
            Interests:
            [
                new InterestDto(Guid.NewGuid(), "Open Source", null, null, 0, DateTime.UtcNow, DateTime.UtcNow)
            ],
            CustomSections: []
        );

        var cvOpts = new CvRenderOptions("classic", "#0284c7", "Liberation Sans", false, "rounded", "de");
        var docxBytes = docxRenderer.RenderCvDocx(profile, cvOpts);

        Assert.NotNull(docxBytes);
        Assert.True(docxBytes.Length > 1000);
        Assert.Equal(0x50, docxBytes[0]);
        Assert.Equal(0x4B, docxBytes[1]);
        Assert.Equal(0x03, docxBytes[2]);
        Assert.Equal(0x04, docxBytes[3]);

        var clDto = new CoverLetterDto(
            Guid.NewGuid(),
            "Bewerbung",
            "Julia Neumann",
            "Weg 5",
            "20095",
            "Hamburg",
            "+49 160 99887766",
            "julia@example.com",
            "Target AG",
            "Engineering",
            "Frau Sommer",
            "Allee 1",
            "10117",
            "Berlin",
            "Deutschland",
            "Hamburg",
            "06.11.2026",
            "Bewerbung als DevOps Specialist",
            "Sehr geehrte Frau Sommer,",
            "gerne bewerbe ich mich bei Ihnen...",
            "Freundliche Grüße",
            "Julia Neumann",
            false,
            "Anlagen",
            "de",
            "Liberation Sans",
            "#0284c7",
            DateTime.UtcNow,
            DateTime.UtcNow
        );

        var clOpts = new CoverLetterRenderOptions("Liberation Sans", "#0284c7", "de", true);
        var clDocx = docxRenderer.RenderCoverLetterDocx(clDto, clOpts);

        Assert.NotNull(clDocx);
        Assert.True(clDocx.Length > 1000);
        Assert.Equal(0x50, clDocx[0]);
        Assert.Equal(0x4B, clDocx[1]);
        Assert.Equal(0x03, clDocx[2]);
        Assert.Equal(0x04, clDocx[3]);
    }

    [Fact]
    public async Task CoverLetters_PreviewAndExportEndpointsWorkSuccessfully()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "cluser3");

        var req = CreateSampleRequest();
        var createRes = await user.PostAsync("/api/cover-letters", req);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var created = await createRes.JsonAsync();
        var createdId = created.GetProperty("id").GetString()!;

        // Preview PDF
        var previewRes = await user.PostAsync($"/api/cover-letters/{createdId}/preview/pdf", new { font = "Liberation Sans" });
        Assert.Equal(HttpStatusCode.OK, previewRes.StatusCode);
        Assert.Equal("application/pdf", previewRes.Content.Headers.ContentType?.MediaType);
        var previewPdf = await previewRes.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        Assert.True(previewPdf.Length > 1000);

        // Export PDF
        var exportPdfRes = await user.PostAsync($"/api/cover-letters/{createdId}/export/pdf", new { font = "Liberation Sans" });
        Assert.Equal(HttpStatusCode.OK, exportPdfRes.StatusCode);
        Assert.Equal("application/pdf", exportPdfRes.Content.Headers.ContentType?.MediaType);
        Assert.NotNull(exportPdfRes.Content.Headers.ContentDisposition?.FileName);

        // Export Docx
        var exportDocxRes = await user.PostAsync($"/api/cover-letters/{createdId}/export/docx", new { font = "Liberation Sans" });
        Assert.Equal(HttpStatusCode.OK, exportDocxRes.StatusCode);
        Assert.Equal("application/vnd.openxmlformats-officedocument.wordprocessingml.document", exportDocxRes.Content.Headers.ContentType?.MediaType);
        var docxBytes = await exportDocxRes.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        Assert.True(docxBytes.Length > 1000);
    }
}
