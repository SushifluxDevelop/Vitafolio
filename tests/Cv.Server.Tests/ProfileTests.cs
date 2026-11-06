using System.Net;
using System.Net.Http.Headers;
using Cv.Server.Tests.Support;

namespace Cv.Server.Tests;

public sealed class ProfileTests(ServerFixture server) : IClassFixture<ServerFixture>
{
    [Fact]
    public async Task Unauthenticated_request_is_rejected()
    {
        var anon = server.Client();
        var response = await anon.GetAsync("/api/profile");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Get_profile_initializes_and_returns_profile()
    {
        var admin = await server.AdminAsync();
        var (user, _) = await server.UserAsync(admin, "profileuser1");

        var response = await user.GetAsync("/api/profile");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var doc = await response.JsonAsync();
        Assert.Equal("profileuser1", doc.GetProperty("firstName").GetString());
        Assert.Empty(doc.GetProperty("experiences").EnumerateArray().ToList());
        Assert.Empty(doc.GetProperty("educations").EnumerateArray().ToList());
        Assert.Empty(doc.GetProperty("skills").EnumerateArray().ToList());
        Assert.False(doc.GetProperty("hasPhoto").GetBoolean());
    }

    [Fact]
    public async Task Update_profile_saves_personal_data_and_validates_inputs()
    {
        var admin = await server.AdminAsync();
        var (user, _) = await server.UserAsync(admin, "profileuser2");

        // Missing required fields
        var invalid = await user.PutAsync("/api/profile", new { firstName = "", lastName = "" });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Equal("validation.failed", await invalid.CodeAsync());

        // Valid update
        var valid = await user.PutAsync("/api/profile", new
        {
            firstName = "Erika",
            lastName = "Mustermann",
            academicTitle = "Dr.",
            professionalTitle = "Senior Software Architect",
            email = "erika@example.com",
            phone = "+49 123 456789",
            city = "Berlin",
            country = "Deutschland",
            bio = "Erfahrene Software-Architektin mit Fokus auf Cloud & Clean Code.",
        });
        Assert.Equal(HttpStatusCode.OK, valid.StatusCode);

        var doc = await valid.JsonAsync();
        Assert.Equal("Erika", doc.GetProperty("firstName").GetString());
        Assert.Equal("Mustermann", doc.GetProperty("lastName").GetString());
        Assert.Equal("Dr.", doc.GetProperty("academicTitle").GetString());
        Assert.Equal("Senior Software Architect", doc.GetProperty("professionalTitle").GetString());
        Assert.Equal("erika@example.com", doc.GetProperty("email").GetString());
        Assert.Equal("Berlin", doc.GetProperty("city").GetString());
    }

    [Fact]
    public async Task Experiences_crud_and_reorder()
    {
        var admin = await server.AdminAsync();
        var (user, _) = await server.UserAsync(admin, "expuser");

        // 1. Add experience
        var addRes = await user.PostAsync("/api/profile/experiences", new
        {
            jobTitle = "Lead Developer",
            employer = "Acme Corp",
            employmentType = "Vollzeit",
            city = "München",
            startDate = "2021-01",
            isCurrent = true,
            description = "Architektur und Leitung des Backend-Teams.",
            sortOrder = 0,
        });
        Assert.Equal(HttpStatusCode.Created, addRes.StatusCode);
        var exp1 = await addRes.JsonAsync();
        var id1 = Guid.Parse(exp1.GetProperty("id").GetString()!);
        Assert.Equal("Lead Developer", exp1.GetProperty("jobTitle").GetString());
        Assert.True(exp1.GetProperty("isCurrent").GetBoolean());

        // 2. Add second experience
        var addRes2 = await user.PostAsync("/api/profile/experiences", new
        {
            jobTitle = "Junior Developer",
            employer = "Startup GmbH",
            startDate = "2018-03",
            endDate = "2020-12",
            isCurrent = false,
            sortOrder = 1,
        });
        Assert.Equal(HttpStatusCode.Created, addRes2.StatusCode);
        var id2 = Guid.Parse((await addRes2.JsonAsync()).GetProperty("id").GetString()!);

        // 3. Update first experience
        var updateRes = await user.PutAsync($"/api/profile/experiences/{id1}", new
        {
            jobTitle = "Staff Engineer",
            employer = "Acme Corp",
            startDate = "2021-01",
            isCurrent = true,
            sortOrder = 0,
        });
        Assert.Equal(HttpStatusCode.OK, updateRes.StatusCode);
        Assert.Equal("Staff Engineer", (await updateRes.JsonAsync()).GetProperty("jobTitle").GetString());

        // 4. Reorder
        var reorderRes = await user.PutAsync("/api/profile/experiences/reorder", new { ids = new[] { id2, id1 } });
        Assert.Equal(HttpStatusCode.OK, reorderRes.StatusCode);

        // 5. Verify in profile
        var profile = await (await user.GetAsync("/api/profile")).JsonAsync();
        var list = profile.GetProperty("experiences").EnumerateArray().ToList();
        Assert.Equal(2, list.Count);
        Assert.Equal(id2.ToString(), list[0].GetProperty("id").GetString());
        Assert.Equal(id1.ToString(), list[1].GetProperty("id").GetString());

        // 6. Delete
        var delRes = await user.DeleteAsync($"/api/profile/experiences/{id1}");
        Assert.Equal(HttpStatusCode.NoContent, delRes.StatusCode);

        var profileAfter = await (await user.GetAsync("/api/profile")).JsonAsync();
        Assert.Single(profileAfter.GetProperty("experiences").EnumerateArray().ToList());
    }

    [Fact]
    public async Task Educations_skills_and_languages_crud()
    {
        var admin = await server.AdminAsync();
        var (user, _) = await server.UserAsync(admin, "eduskilluser");

        // Education
        var eduRes = await user.PostAsync("/api/profile/educations", new
        {
            degree = "B.Sc. Informatik",
            institution = "TU München",
            startDate = "2015-10",
            endDate = "2018-09",
            grade = "1.4",
            sortOrder = 0,
        });
        Assert.Equal(HttpStatusCode.Created, eduRes.StatusCode);
        var eduId = (await eduRes.JsonAsync()).GetProperty("id").GetString();

        // Skill
        var skillRes = await user.PostAsync("/api/profile/skills", new
        {
            name = "C# / .NET",
            category = "Programmiersprachen",
            level = 5,
            sortOrder = 0,
        });
        Assert.Equal(HttpStatusCode.Created, skillRes.StatusCode);
        var skillId = (await skillRes.JsonAsync()).GetProperty("id").GetString();

        // Language
        var langRes = await user.PostAsync("/api/profile/languages", new
        {
            language = "Englisch",
            level = "C1",
            sortOrder = 0,
        });
        Assert.Equal(HttpStatusCode.Created, langRes.StatusCode);
        var langId = (await langRes.JsonAsync()).GetProperty("id").GetString();

        // Verify in profile
        var profile = await (await user.GetAsync("/api/profile")).JsonAsync();
        Assert.Single(profile.GetProperty("educations").EnumerateArray().ToList());
        Assert.Single(profile.GetProperty("skills").EnumerateArray().ToList());
        Assert.Single(profile.GetProperty("languages").EnumerateArray().ToList());

        // Cleanup
        Assert.Equal(HttpStatusCode.NoContent, (await user.DeleteAsync($"/api/profile/educations/{eduId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await user.DeleteAsync($"/api/profile/skills/{skillId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await user.DeleteAsync($"/api/profile/languages/{langId}")).StatusCode);
    }

    [Fact]
    public async Task Certificates_interests_and_custom_sections_crud()
    {
        var admin = await server.AdminAsync();
        var (user, _) = await server.UserAsync(admin, "certuser");

        // Certificate
        var certRes = await user.PostAsync("/api/profile/certificates", new
        {
            title = "AWS Certified Solutions Architect",
            issuer = "Amazon Web Services",
            issueDate = "2023-06",
            sortOrder = 0,
        });
        Assert.Equal(HttpStatusCode.Created, certRes.StatusCode);
        var certId = (await certRes.JsonAsync()).GetProperty("id").GetString();

        // Interest
        var intRes = await user.PostAsync("/api/profile/interests", new
        {
            name = "Open-Source-Entwicklung",
            category = "Technologie",
            sortOrder = 0,
        });
        Assert.Equal(HttpStatusCode.Created, intRes.StatusCode);
        var intId = (await intRes.JsonAsync()).GetProperty("id").GetString();

        // Custom section + item
        var secRes = await user.PostAsync("/api/profile/custom-sections", new { title = "Publikationen", sortOrder = 0 });
        Assert.Equal(HttpStatusCode.Created, secRes.StatusCode);
        var secId = (await secRes.JsonAsync()).GetProperty("id").GetString()!;

        var itemRes = await user.PostAsync($"/api/profile/custom-sections/{secId}/items", new
        {
            title = "Moderne Microservices mit .NET",
            subtitle = "Fachartikel im Magazin",
            dateRange = "2024",
            sortOrder = 0,
        });
        Assert.Equal(HttpStatusCode.Created, itemRes.StatusCode);
        var itemId = (await itemRes.JsonAsync()).GetProperty("id").GetString()!;

        // Verify profile includes custom section and nested item
        var profile = await (await user.GetAsync("/api/profile")).JsonAsync();
        var sections = profile.GetProperty("customSections").EnumerateArray().ToList();
        Assert.Single(sections);
        Assert.Equal("Publikationen", sections[0].GetProperty("title").GetString());
        Assert.Single(sections[0].GetProperty("items").EnumerateArray().ToList());

        // Delete item then section
        Assert.Equal(HttpStatusCode.NoContent, (await user.DeleteAsync($"/api/profile/custom-sections/{secId}/items/{itemId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await user.DeleteAsync($"/api/profile/custom-sections/{secId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await user.DeleteAsync($"/api/profile/certificates/{certId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await user.DeleteAsync($"/api/profile/interests/{intId}")).StatusCode);
    }

    [Fact]
    public async Task Privacy_and_tenant_isolation_user_a_cannot_access_or_modify_user_b_items()
    {
        var admin = await server.AdminAsync();
        var (userA, _) = await server.UserAsync(admin, "usera");
        var (userB, _) = await server.UserAsync(admin, "userb");

        // User A creates an experience
        var addRes = await userA.PostAsync("/api/profile/experiences", new
        {
            jobTitle = "Secret Project Lead",
            employer = "Confidential Inc",
            startDate = "2022-01",
            sortOrder = 0,
        });
        var expId = (await addRes.JsonAsync()).GetProperty("id").GetString()!;

        // User B tries to update User A's experience -> 404
        var updateRes = await userB.PutAsync($"/api/profile/experiences/{expId}", new
        {
            jobTitle = "Hacked Title",
            employer = "Attacker",
            startDate = "2022-01",
            sortOrder = 0,
        });
        Assert.Equal(HttpStatusCode.NotFound, updateRes.StatusCode);

        // User B tries to delete User A's experience -> 404
        var deleteRes = await userB.DeleteAsync($"/api/profile/experiences/{expId}");
        Assert.Equal(HttpStatusCode.NotFound, deleteRes.StatusCode);

        // Verify User B's profile does not show User A's experience
        var profileB = await (await userB.GetAsync("/api/profile")).JsonAsync();
        Assert.Empty(profileB.GetProperty("experiences").EnumerateArray().ToList());
    }

    [Fact]
    public async Task Photo_upload_validation_retrieval_and_deletion()
    {
        var admin = await server.AdminAsync();
        var (user, _) = await server.UserAsync(admin, "photouser");

        // 1. Initial photo: 404
        Assert.Equal(HttpStatusCode.NotFound, (await user.GetAsync("/api/profile/photo")).StatusCode);

        // 2. Invalid image format (plain text bytes)
        using var invalidContent = new MultipartFormDataContent();
        var txtBytes = new ByteArrayContent("not an image"u8.ToArray());
        txtBytes.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        invalidContent.Add(txtBytes, "photo", "test.jpg");

        var badReq = new HttpRequestMessage(HttpMethod.Post, "/api/profile/photo") { Content = invalidContent };
        var badRes = await user.SendAsync(badReq);
        Assert.Equal(HttpStatusCode.BadRequest, badRes.StatusCode);
        Assert.Equal("photo.invalid_format", await badRes.CodeAsync());

        // 3. Valid JPEG magic bytes (FF D8 FF E0 ...)
        byte[] jpegBytes = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01];
        using var validContent = new MultipartFormDataContent();
        var imgBytes = new ByteArrayContent(jpegBytes);
        imgBytes.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        validContent.Add(imgBytes, "photo", "avatar.jpg");

        var postReq = new HttpRequestMessage(HttpMethod.Post, "/api/profile/photo") { Content = validContent };
        var postRes = await user.SendAsync(postReq);
        Assert.Equal(HttpStatusCode.OK, postRes.StatusCode);

        var profile = await postRes.JsonAsync();
        Assert.True(profile.GetProperty("hasPhoto").GetBoolean());

        // 4. Retrieve photo
        var getRes = await user.GetAsync("/api/profile/photo");
        Assert.Equal(HttpStatusCode.OK, getRes.StatusCode);
        Assert.Equal("image/jpeg", getRes.Content.Headers.ContentType?.MediaType);
        var retrievedBytes = await getRes.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        Assert.Equal(jpegBytes, retrievedBytes);

        // 5. Delete photo
        var delRes = await user.DeleteAsync("/api/profile/photo");
        Assert.Equal(HttpStatusCode.NoContent, delRes.StatusCode);

        // 6. After deletion: 404
        Assert.Equal(HttpStatusCode.NotFound, (await user.GetAsync("/api/profile/photo")).StatusCode);
    }

    [Fact]
    public async Task Json_resume_export_and_import()
    {
        var admin = await server.AdminAsync();
        var (user, _) = await server.UserAsync(admin, "jsonresumeuser");

        // 1. Initial export
        var exportRes = await user.GetAsync("/api/profile/json-resume");
        Assert.Equal(HttpStatusCode.OK, exportRes.StatusCode);
        var exportDoc = await exportRes.JsonAsync();
        Assert.True(exportDoc.TryGetProperty("basics", out var basicsObj));
        Assert.Equal(System.Text.Json.JsonValueKind.Object, basicsObj.ValueKind);

        // 2. Import sample JSON Resume
        var sampleResume = new
        {
            basics = new
            {
                name = "Max Mustermann",
                label = "Cloud Architect",
                email = "max@example.com",
                phone = "+49 987 654321",
                summary = "Erfahrener Architekt für verteilte Systeme.",
                location = new
                {
                    address = "Musterstraße 42",
                    postalCode = "10115",
                    city = "Berlin",
                    countryCode = "DE"
                },
                profiles = new[]
                {
                    new { network = "LinkedIn", url = "https://linkedin.com/in/max-mustermann" },
                    new { network = "GitHub", url = "https://github.com/max-mustermann" }
                }
            },
            work = new[]
            {
                new
                {
                    name = "Tech Solutions GmbH",
                    position = "Lead Architect",
                    startDate = "2022-01",
                    endDate = (string?)null,
                    summary = "Leitung der Cloud-Migration.",
                    highlights = new[] { "Docker & Kubernetes", "Zero Downtime" }
                }
            },
            education = new[]
            {
                new
                {
                    institution = "TU Berlin",
                    studyType = "M.Sc. Informatik",
                    area = "Verteilte Systeme",
                    startDate = "2016-10",
                    endDate = "2021-09",
                    score = "1.3"
                }
            },
            skills = new[]
            {
                new
                {
                    name = "C# / .NET",
                    level = "Master",
                    keywords = new[] { "Backend" }
                }
            },
            languages = new[]
            {
                new
                {
                    language = "Deutsch",
                    fluency = "Muttersprache"
                },
                new
                {
                    language = "Englisch",
                    fluency = "Verhandlungssicher (C1)"
                }
            }
        };

        var importRes = await user.PostAsync("/api/profile/json-resume/import", sampleResume);
        Assert.Equal(HttpStatusCode.OK, importRes.StatusCode);

        var profile = await importRes.JsonAsync();
        Assert.Equal("Max", profile.GetProperty("firstName").GetString());
        Assert.Equal("Mustermann", profile.GetProperty("lastName").GetString());
        Assert.Equal("Cloud Architect", profile.GetProperty("professionalTitle").GetString());
        Assert.Equal("https://linkedin.com/in/max-mustermann", profile.GetProperty("linkedIn").GetString());

        var experiences = profile.GetProperty("experiences").EnumerateArray().ToList();
        Assert.Single(experiences);
        Assert.Equal("Tech Solutions GmbH", experiences[0].GetProperty("employer").GetString());
        Assert.Equal("Lead Architect", experiences[0].GetProperty("jobTitle").GetString());

        var educations = profile.GetProperty("educations").EnumerateArray().ToList();
        Assert.Single(educations);
        Assert.Equal("TU Berlin", educations[0].GetProperty("institution").GetString());

        var skills = profile.GetProperty("skills").EnumerateArray().ToList();
        Assert.Single(skills);
        Assert.Equal("C# / .NET", skills[0].GetProperty("name").GetString());
        Assert.Equal(5, skills[0].GetProperty("level").GetInt32());

        var languages = profile.GetProperty("languages").EnumerateArray().ToList();
        Assert.Equal(2, languages.Count);

        // 3. Export again and verify contents match
        var reExportRes = await user.GetAsync("/api/profile/json-resume");
        Assert.Equal(HttpStatusCode.OK, reExportRes.StatusCode);
        var reExportDoc = await reExportRes.JsonAsync();
        var reBasics = reExportDoc.GetProperty("basics");
        Assert.Equal("Max Mustermann", reBasics.GetProperty("name").GetString());
        Assert.Equal("Cloud Architect", reBasics.GetProperty("label").GetString());

        // 4. Import with replace = true
        var replaceResume = new
        {
            basics = new { name = "Neuer Name", label = "DevOps Engineer" },
            work = new[]
            {
                new { name = "Single Work", position = "DevOps", startDate = "2024-01" }
            }
        };
        var replaceRes = await user.PostAsync("/api/profile/json-resume/import?replace=true", replaceResume);
        Assert.Equal(HttpStatusCode.OK, replaceRes.StatusCode);
        var replacedProfile = await replaceRes.JsonAsync();
        Assert.Equal("Neuer", replacedProfile.GetProperty("firstName").GetString());
        Assert.Equal("Name", replacedProfile.GetProperty("lastName").GetString());
        Assert.Equal("DevOps Engineer", replacedProfile.GetProperty("professionalTitle").GetString());
        var replacedWork = replacedProfile.GetProperty("experiences").EnumerateArray().ToList();
        Assert.Single(replacedWork);
        Assert.Equal("Single Work", replacedWork[0].GetProperty("employer").GetString());
        Assert.Empty(replacedProfile.GetProperty("educations").EnumerateArray().ToList());
        Assert.Empty(replacedProfile.GetProperty("skills").EnumerateArray().ToList());
    }
}
