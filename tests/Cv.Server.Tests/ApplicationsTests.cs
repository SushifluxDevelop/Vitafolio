// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using System.Net;
using System.Text.Json;
using Cv.Server.Controllers;
using Cv.Server.Data;
using Cv.Server.Documents;
using Cv.Server.Tests.Support;

namespace Cv.Server.Tests;

public class ApplicationsTests(ServerFixture fixture) : IClassFixture<ServerFixture>
{
    private static readonly byte[] PdfMagic = "%PDF-"u8.ToArray();

    private static object CreateSampleApplicationRequest(Guid? coverLetterId = null, string status = "draft") => new
    {
        jobTitle = "Senior Fullstack Engineer",
        company = "Acme Technologies GmbH",
        location = "Berlin / Remote",
        contactPerson = "Frau Dr. Schmidt",
        contactEmail = "jobs@acme-tech.example",
        contactPhone = "+49 30 12345678",
        jobPostingUrl = "https://acme-tech.example/careers/senior-fullstack",
        jobDescription = "Modern .NET and React stack.",
        salaryExpectation = "85.000 EUR",
        status = status,
        coverLetterId = coverLetterId,
        cvDesign = "classic",
        cvAccentColor = "#14213D",
        cvFont = "Liberation Sans",
        cvLanguage = "de",
        cvShowPhoto = true,
        cvPhotoShape = "rounded",
        includeCoverSheet = true,
        notes = "Interviewrunde 1 geplant für nächsten Dienstag."
    };

    [Fact]
    public async Task Applications_CrudLifecycleWorks()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "app_crud_user");

        // 1. Initial list is empty
        var initialList = await user.GetAsync("/api/applications");
        Assert.Equal(HttpStatusCode.OK, initialList.StatusCode);
        var initialJson = await initialList.JsonAsync();
        Assert.Equal(JsonValueKind.Array, initialJson.ValueKind);
        Assert.Empty(initialJson.EnumerateArray());

        // 2. Create application
        var createRes = await user.PostAsync("/api/applications", CreateSampleApplicationRequest());
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var created = await createRes.JsonAsync();
        var createdId = created.GetProperty("id").GetString()!;
        Assert.Equal("Senior Fullstack Engineer", created.GetProperty("jobTitle").GetString());
        Assert.Equal("Acme Technologies GmbH", created.GetProperty("company").GetString());
        Assert.Equal("draft", created.GetProperty("status").GetString());
        Assert.False(created.GetProperty("isFollowUpDue").GetBoolean());
        Assert.False(created.GetProperty("hasArchivedPdf").GetBoolean());

        // Events should contain the initial "Bewerbung angelegt" event
        var events = created.GetProperty("events").EnumerateArray().ToList();
        Assert.Single(events);
        Assert.Equal("Bewerbung angelegt", events[0].GetProperty("title").GetString());

        // 3. Get single application
        var getRes = await user.GetAsync($"/api/applications/{createdId}");
        Assert.Equal(HttpStatusCode.OK, getRes.StatusCode);
        var fetched = await getRes.JsonAsync();
        Assert.Equal(createdId, fetched.GetProperty("id").GetString());
        Assert.Equal("Berlin / Remote", fetched.GetProperty("location").GetString());

        // 4. Update application
        var updateReq = new
        {
            jobTitle = "Lead Fullstack Engineer",
            company = "Acme Technologies Holding AG",
            location = "München / Hybrid",
            salaryExpectation = "95.000 EUR",
            notes = "Gehaltsvorstellung nachjustiert."
        };
        var putRes = await user.PutAsync($"/api/applications/{createdId}", updateReq);
        Assert.Equal(HttpStatusCode.OK, putRes.StatusCode);
        var updated = await putRes.JsonAsync();
        Assert.Equal("Lead Fullstack Engineer", updated.GetProperty("jobTitle").GetString());
        Assert.Equal("Acme Technologies Holding AG", updated.GetProperty("company").GetString());
        Assert.Equal("95.000 EUR", updated.GetProperty("salaryExpectation").GetString());

        // 5. Delete application
        var deleteRes = await user.DeleteAsync($"/api/applications/{createdId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteRes.StatusCode);

        // 6. Confirm 404
        var getAfterDelete = await user.GetAsync($"/api/applications/{createdId}");
        Assert.Equal(HttpStatusCode.NotFound, getAfterDelete.StatusCode);
    }

    [Fact]
    public async Task Applications_StatusTransition_ArchivesSnapshot_AndLogsEvents()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "app_status_user");

        // 1. Create cover letter first
        var clReq = new
        {
            title = "Anschreiben Acme",
            recipientCompany = "Acme Corp",
            recipientCity = "Berlin",
            subject = "Bewerbung als Entwickler",
            salutation = "Sehr geehrte Damen und Herren,",
            body = "Hiermit bewerbe ich mich auf die ausgeschriebene Stelle."
        };
        var clRes = await user.PostAsync("/api/cover-letters", clReq);
        Assert.Equal(HttpStatusCode.Created, clRes.StatusCode);
        var clJson = await clRes.JsonAsync();
        var coverLetterId = Guid.Parse(clJson.GetProperty("id").GetString()!);

        // 2. Create application as draft
        var appReq = CreateSampleApplicationRequest(coverLetterId, status: "draft");
        var appRes = await user.PostAsync("/api/applications", appReq);
        var appJson = await appRes.JsonAsync();
        var appId = appJson.GetProperty("id").GetString()!;
        Assert.False(appJson.GetProperty("hasArchivedPdf").GetBoolean());

        // 3. Update status to 'applied' via /status endpoint
        var statusReq = new
        {
            status = "applied",
            note = "Bewerbungsunterlagen per E-Mail versendet."
        };
        var statusRes = await user.PostAsync($"/api/applications/{appId}/status", statusReq);
        Assert.Equal(HttpStatusCode.OK, statusRes.StatusCode);
        var updatedApp = await statusRes.JsonAsync();
        Assert.Equal("applied", updatedApp.GetProperty("status").GetString());
        Assert.True(updatedApp.GetProperty("hasArchivedPdf").GetBoolean());

        // Events should now have 2 items: "Bewerbung angelegt" and "Bewerbung eingereicht"
        var events = updatedApp.GetProperty("events").EnumerateArray().ToList();
        Assert.Equal(2, events.Count);
        Assert.Equal("Bewerbung eingereicht", events[0].GetProperty("title").GetString());
        Assert.Equal("Bewerbungsunterlagen per E-Mail versendet.", events[0].GetProperty("note").GetString());

        // 4. Download dossier returns the archived PDF
        var downloadRes = await user.GetAsync($"/api/applications/{appId}/dossier/download");
        Assert.Equal(HttpStatusCode.OK, downloadRes.StatusCode);
        Assert.Equal("application/pdf", downloadRes.Content.Headers.ContentType?.MediaType);
        var pdfBytes = await downloadRes.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        Assert.True(pdfBytes.Length > 1000);
        Assert.True(pdfBytes.AsSpan(0, 5).SequenceEqual(PdfMagic));

        // 5. Preview dossier also returns valid PDF
        var previewRes = await user.GetAsync($"/api/applications/{appId}/dossier/preview");
        Assert.Equal(HttpStatusCode.OK, previewRes.StatusCode);
        Assert.Equal("application/pdf", previewRes.Content.Headers.ContentType?.MediaType);
        var previewBytes = await previewRes.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        Assert.True(previewBytes.Length > 1000);
        Assert.True(previewBytes.AsSpan(0, 5).SequenceEqual(PdfMagic));
    }

    [Fact]
    public async Task Applications_FollowUpDue_CalculationLogic()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "app_followup_user");

        // 1. Application applied 20 days ago without custom FollowUpAt -> Due!
        var pastDate = DateTime.UtcNow.AddDays(-20);
        var req1 = new
        {
            jobTitle = "Old Application",
            company = "Legacy Corp",
            status = "applied",
            appliedAt = pastDate
        };
        var res1 = await user.PostAsync("/api/applications", req1);
        Assert.Equal(HttpStatusCode.Created, res1.StatusCode);
        var json1 = await res1.JsonAsync();
        Assert.True(json1.GetProperty("isFollowUpDue").GetBoolean());

        // 2. Application applied 3 days ago without custom FollowUpAt -> Not due
        var recentDate = DateTime.UtcNow.AddDays(-3);
        var req2 = new
        {
            jobTitle = "Recent Application",
            company = "Fresh Corp",
            status = "applied",
            appliedAt = recentDate
        };
        var res2 = await user.PostAsync("/api/applications", req2);
        Assert.Equal(HttpStatusCode.Created, res2.StatusCode);
        var json2 = await res2.JsonAsync();
        Assert.False(json2.GetProperty("isFollowUpDue").GetBoolean());

        // 3. Application with explicit FollowUpAt in the future -> Not due even if applied 30 days ago
        var futureDate = DateTime.UtcNow.AddDays(7);
        var req3 = new
        {
            jobTitle = "Scheduled Application",
            company = "Scheduled Corp",
            status = "applied",
            appliedAt = pastDate,
            followUpAt = futureDate
        };
        var res3 = await user.PostAsync("/api/applications", req3);
        Assert.Equal(HttpStatusCode.Created, res3.StatusCode);
        var json3 = await res3.JsonAsync();
        Assert.False(json3.GetProperty("isFollowUpDue").GetBoolean());

        // 4. Stats endpoint reflects the follow up count
        var statsRes = await user.GetAsync("/api/applications/stats");
        Assert.Equal(HttpStatusCode.OK, statsRes.StatusCode);
        var stats = await statsRes.JsonAsync();
        Assert.Equal(3, stats.GetProperty("total").GetInt32());
        Assert.Equal(3, stats.GetProperty("applied").GetInt32());
        Assert.Equal(1, stats.GetProperty("followUpsDue").GetInt32());
    }

    [Fact]
    public async Task Applications_CustomEventsLifecycle()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "app_event_user");

        // Create application
        var createRes = await user.PostAsync("/api/applications", CreateSampleApplicationRequest());
        var created = await createRes.JsonAsync();
        var appId = created.GetProperty("id").GetString()!;

        // Add custom event: Phone Screen
        var eventReq = new
        {
            title = "Telefon-Interview",
            note = "Gespräch mit HR, 30 Minuten via Teams.",
            status = "interview"
        };
        var addRes = await user.PostAsync($"/api/applications/{appId}/events", eventReq);
        Assert.Equal(HttpStatusCode.OK, addRes.StatusCode);
        var eventJson = await addRes.JsonAsync();
        var eventId = eventJson.GetProperty("id").GetString()!;
        Assert.Equal("Telefon-Interview", eventJson.GetProperty("title").GetString());
        Assert.Equal("interview", eventJson.GetProperty("status").GetString());

        // Fetch application and verify events
        var getRes = await user.GetAsync($"/api/applications/{appId}");
        var appJson = await getRes.JsonAsync();
        var events = appJson.GetProperty("events").EnumerateArray().ToList();
        Assert.Contains(events, e => e.GetProperty("id").GetString() == eventId);

        // Delete the event
        var delRes = await user.DeleteAsync($"/api/applications/{appId}/events/{eventId}");
        Assert.Equal(HttpStatusCode.NoContent, delRes.StatusCode);

        // Fetch again and verify deleted
        var getRes2 = await user.GetAsync($"/api/applications/{appId}");
        var appJson2 = await getRes2.JsonAsync();
        var events2 = appJson2.GetProperty("events").EnumerateArray().ToList();
        Assert.DoesNotContain(events2, e => e.GetProperty("id").GetString() == eventId);
    }

    [Fact]
    public async Task Applications_UserIsolationIsEnforced()
    {
        var admin = await fixture.AdminAsync();
        var (userA, _) = await fixture.UserAsync(admin, "app_iso_user_a");
        var (userB, _) = await fixture.UserAsync(admin, "app_iso_user_b");

        // User A creates application
        var resA = await userA.PostAsync("/api/applications", CreateSampleApplicationRequest());
        var jsonA = await resA.JsonAsync();
        var appId = jsonA.GetProperty("id").GetString()!;

        // User B cannot view User A's application
        var getB = await userB.GetAsync($"/api/applications/{appId}");
        Assert.Equal(HttpStatusCode.NotFound, getB.StatusCode);

        // User B cannot update User A's application
        var updateB = await userB.PutAsync($"/api/applications/{appId}", new { jobTitle = "Hacked Title", company = "Hacked" });
        Assert.Equal(HttpStatusCode.NotFound, updateB.StatusCode);

        // User B cannot delete User A's application
        var deleteB = await userB.DeleteAsync($"/api/applications/{appId}");
        Assert.Equal(HttpStatusCode.NotFound, deleteB.StatusCode);

        // User B cannot add events to User A's application
        var eventB = await userB.PostAsync($"/api/applications/{appId}/events", new { title = "Hacked Event" });
        Assert.Equal(HttpStatusCode.NotFound, eventB.StatusCode);

        // User B's list does not contain User A's application
        var listB = await userB.GetAsync("/api/applications");
        var listBJson = await listB.JsonAsync();
        Assert.Empty(listBJson.EnumerateArray());
    }

    [Fact]
    public void TypstRenderer_RenderDossierPdf_GeneratesValidPdf()
    {
        var renderer = new TypstRenderer();

        var profile = new ProfileResponse(
            Id: Guid.NewGuid(),
            FirstName: "Max",
            LastName: "Mustermann",
            AcademicTitle: "Dr.",
            ProfessionalTitle: "Principal Systems Engineer",
            Email: "max@example.org",
            Phone: "+49 89 9876543",
            Street: "Hauptstraße 12",
            PostalCode: "80331",
            City: "München",
            Country: "Deutschland",
            DateOfBirth: "1988-04-12",
            PlaceOfBirth: "München",
            Nationality: "Deutsch",
            MaritalStatus: "Verheiratet",
            Website: "https://max.example.org",
            LinkedIn: null,
            GitHub: "https://github.com/max-mustermann",
            Xing: null,
            Bio: "Erfahrener Software-Architekt mit Leidenschaft für performante Backend-Systeme.",
            HasPhoto: false,
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: DateTime.UtcNow,
            Experiences:
            [
                new ExperienceDto(
                    Guid.NewGuid(),
                    "Lead Architect",
                    "Enterprise Cloud GmbH",
                    "Vollzeit",
                    "München",
                    "Deutschland",
                    "2020-03",
                    null,
                    true,
                    "Verantwortung für die Core-Plattformarchitektur.",
                    0,
                    DateTime.UtcNow,
                    DateTime.UtcNow)
            ],
            Educations: [],
            Skills:
            [
                new SkillDto(Guid.NewGuid(), "C# / .NET", "Backend", 5, 0, DateTime.UtcNow, DateTime.UtcNow),
                new SkillDto(Guid.NewGuid(), "Rust", "Backend", 4, 1, DateTime.UtcNow, DateTime.UtcNow)
            ],
            Languages:
            [
                new LanguageDto(Guid.NewGuid(), "Deutsch", "C2", 0, DateTime.UtcNow, DateTime.UtcNow),
                new LanguageDto(Guid.NewGuid(), "Englisch", "C1", 1, DateTime.UtcNow, DateTime.UtcNow)
            ],
            Certificates: [],
            Interests: [],
            CustomSections: []);

        var coverLetter = new CoverLetterDto(
            Id: Guid.NewGuid(),
            Title: "Bewerbung Principal Engineer",
            SenderName: "Max Mustermann",
            SenderStreet: "Hauptstraße 12",
            SenderPostalCode: "80331",
            SenderCity: "München",
            SenderPhone: "+49 89 9876543",
            SenderEmail: "max@example.org",
            RecipientCompany: "NextGen Systems AG",
            RecipientDepartment: "Engineering",
            RecipientContactPerson: "Herr Direktor Braun",
            RecipientStreet: "Technologiepark 5",
            RecipientPostalCode: "70563",
            RecipientCity: "Stuttgart",
            RecipientCountry: "Deutschland",
            Place: "München",
            Date: "06.11.2026",
            Subject: "Bewerbung als Principal Systems Engineer",
            Salutation: "Sehr geehrter Herr Direktor Braun,",
            Body: "mit großer Begeisterung bewerbe ich mich auf die ausgeschriebene Position.\n\nIch bringe über 12 Jahre Erfahrung im Design hochgradig skalierbarer Systeme mit.",
            Closing: "Mit freundlichen Grüßen",
            SignatureName: "Max Mustermann",
            HasSignature: false,
            AttachmentsNote: "Lebenslauf, Zeugnisse",
            Language: "de",
            Font: "Liberation Sans",
            AccentColor: "#14213D",
            CreatedAt: DateTime.UtcNow,
            UpdatedAt: DateTime.UtcNow);

        var options = new DossierRenderOptions(
            Design: "classic",
            AccentColor: "#14213D",
            Font: "Liberation Sans",
            ShowPhoto: false,
            PhotoShape: "rounded",
            Language: "de",
            IncludeCoverSheet: true,
            TargetJob: "Principal Systems Engineer",
            TargetCompany: "NextGen Systems AG",
            Contents: ["Anschreiben", "Lebenslauf"]);

        var pdfBytes = renderer.RenderDossierPdf(profile, coverLetter, options);

        Assert.NotNull(pdfBytes);
        Assert.True(pdfBytes.Length > 2000);
        Assert.True(pdfBytes.AsSpan(0, 5).SequenceEqual(PdfMagic));
    }
}
