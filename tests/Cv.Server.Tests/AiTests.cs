// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using System.Net;
using System.Text.Json;
using Cv.Server.Ai;
using Cv.Server.Tests.Support;

namespace Cv.Server.Tests;

public class AiTests(ServerFixture fixture) : IClassFixture<ServerFixture>
{
    [Fact]
    public async Task AiConfig_GetDefaultAndSaveWorks()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "aiuser1");

        // 1. Initial config should be copy_paste
        var getRes = await user.GetAsync("/api/ai/config");
        Assert.Equal(HttpStatusCode.OK, getRes.StatusCode);
        var initial = await getRes.JsonAsync();
        Assert.Equal("copy_paste", initial.GetProperty("provider").GetString());
        Assert.False(initial.GetProperty("hasApiKey").GetBoolean());
        Assert.True(initial.GetProperty("pseudonymize").GetBoolean());

        // 2. Save config with API key
        var updatePayload = new
        {
            provider = "openai",
            model = "gpt-4o",
            baseUrl = "https://api.openai.com/v1",
            apiKey = "sk-test-secret-key-12345",
            pseudonymize = true
        };
        var putRes = await user.PutAsync("/api/ai/config", updatePayload);
        Assert.Equal(HttpStatusCode.OK, putRes.StatusCode);
        var updated = await putRes.JsonAsync();
        Assert.Equal("openai", updated.GetProperty("provider").GetString());
        Assert.Equal("gpt-4o", updated.GetProperty("model").GetString());
        Assert.True(updated.GetProperty("hasApiKey").GetBoolean());

        // Ensure API key is NOT exposed in response
        Assert.False(updated.TryGetProperty("apiKey", out _));

        // 3. Test connection endpoint for copy_paste or provider
        var testRes = await user.PostAsync("/api/ai/test-connection", new { });
        Assert.Equal(HttpStatusCode.OK, testRes.StatusCode);
    }

    [Fact]
    public async Task BuildPrompt_PseudonymizesCandidatePiiProperly()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "aiuser2");

        // Save profile with personal info
        var profilePayload = new
        {
            firstName = "Maximilian",
            lastName = "Mustermann",
            email = "max.mustermann@example.com",
            phone = "+49 170 99887766",
            street = "Geheimstraße 12",
            postalCode = "10115",
            city = "Berlin",
            professionalTitle = "Senior DevOps Engineer"
        };
        var profRes = await user.PutAsync("/api/profile", profilePayload);
        Assert.Equal(HttpStatusCode.OK, profRes.StatusCode);

        // Request cover letter prompt
        var promptReq = new
        {
            task = "generate_cover_letter",
            jobTitle = "Lead Cloud Architect",
            company = "Tech Innovations AG",
            jobDescription = "Wir suchen einen Cloud Architect mit Kubernetes und Terraform Erfahrung.",
            language = "de",
            tone = "selbstbewusst und direkt"
        };
        var promptRes = await user.PostAsync("/api/ai/prompt", promptReq);
        Assert.Equal(HttpStatusCode.OK, promptRes.StatusCode);
        var promptJson = await promptRes.JsonAsync();

        var userPrompt = promptJson.GetProperty("userPrompt").GetString()!;
        var copyPaste = promptJson.GetProperty("fullCopyPasteText").GetString()!;

        // The real candidate personal information must NOT be present in the prompt
        Assert.DoesNotContain("Maximilian Mustermann", userPrompt);
        Assert.DoesNotContain("max.mustermann@example.com", userPrompt);
        Assert.DoesNotContain("+49 170 99887766", userPrompt);
        Assert.DoesNotContain("Geheimstraße 12", userPrompt);

        // Pseudonym tokens should be present instead
        Assert.Contains(AiPseudonymizer.TokenName, userPrompt);
        Assert.Contains(AiPseudonymizer.TokenAddress, userPrompt);

        // Copy paste text contains both system and user prompts
        Assert.Contains("SYSTEM INSTRUCTION", copyPaste);
        Assert.Contains("Tech Innovations AG", copyPaste);
    }

    [Fact]
    public async Task BuildPrompt_ForJobAnalysisAndImproveBullet()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "aiuser3");

        // Job analysis prompt
        var analysisReq = new
        {
            task = "analyze_job",
            jobTitle = "Kubernetes Specialist",
            company = "Cloud Corp",
            jobDescription = "Must have: CKA certification, 3+ years production Kubernetes, Go experience.",
            language = "en"
        };
        var analysisRes = await user.PostAsync("/api/ai/prompt", analysisReq);
        Assert.Equal(HttpStatusCode.OK, analysisRes.StatusCode);
        var analysisJson = await analysisRes.JsonAsync();
        Assert.Contains("matchScore", analysisJson.GetProperty("userPrompt").GetString()!);

        // Improve bullet prompt
        var bulletReq = new
        {
            task = "improve_bullet",
            jobTitle = "Fullstack Developer",
            inputText = "Managed migration to React 19.",
            language = "en"
        };
        var bulletRes = await user.PostAsync("/api/ai/prompt", bulletReq);
        Assert.Equal(HttpStatusCode.OK, bulletRes.StatusCode);
        var bulletJson = await bulletRes.JsonAsync();
        Assert.Contains("STAR", bulletJson.GetProperty("systemPrompt").GetString()!);
    }

    [Fact]
    public async Task ParseResponse_TolerantJsonExtractionAndDePseudonymization()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "aiuser4");

        // Set up user profile
        var profilePayload = new
        {
            firstName = "Julia",
            lastName = "Sommer",
            email = "julia.sommer@example.org",
            phone = "+49 30 11223344",
            street = "Blumenweg 5",
            postalCode = "80331",
            city = "München"
        };
        await user.PutAsync("/api/profile", profilePayload);

        // Raw LLM output with Markdown fence and pseudonym token
        var rawLlm = "Hier ist der generierte Vorschlag:\n\n```json\n" +
            "{\n" +
            "  \"subject\": \"Bewerbung als Cloud Architect – [BEWERBER_NAME]\",\n" +
            "  \"salutation\": \"Sehr geehrte Damen und Herren,\",\n" +
            "  \"opening\": \"mit großer Begeisterung bewerbe ich mich auf die ausgeschriebene Position.\",\n" +
            "  \"body\": \"Als erfahrene Entwicklerin bringe ich umfassende Kenntnisse mit. Sie erreichen mich unter [BEWERBER_EMAIL] oder [BEWERBER_TELEFON].\",\n" +
            "  \"closing\": \"Ich freue mich auf das persönliche Kennenlernen.\",\n" +
            "  \"keyMatches\": [\"Cloud Infrastructure\", \"Microservices\"]\n" +
            "}\n```\nViel Erfolg!";

        var parseReq = new
        {
            task = "generate_cover_letter",
            rawResponse = rawLlm,
            pseudonymized = true
        };
        var parseRes = await user.PostAsync("/api/ai/parse", parseReq);
        Assert.Equal(HttpStatusCode.OK, parseRes.StatusCode);
        var parsed = await parseRes.JsonAsync();

        // De-pseudonymization should replace tokens with real profile values
        var subject = parsed.GetProperty("subject").GetString()!;
        var body = parsed.GetProperty("body").GetString()!;

        Assert.Equal("Bewerbung als Cloud Architect – Julia Sommer", subject);
        Assert.Contains("julia.sommer@example.org", body);
        Assert.Contains("+49 30 11223344", body);
        Assert.DoesNotContain("[BEWERBER_NAME]", subject);
        Assert.DoesNotContain("[BEWERBER_EMAIL]", body);
    }

    [Fact]
    public async Task ParseResponse_RejectsInvalidJsonWithHelpfulError()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "aiuser5");

        var parseReq = new
        {
            task = "generate_cover_letter",
            rawResponse = "Leider kann ich diese Anfrage nicht bearbeiten.",
            pseudonymized = true
        };
        var parseRes = await user.PostAsync("/api/ai/parse", parseReq);
        Assert.Equal(HttpStatusCode.BadRequest, parseRes.StatusCode);
        var err = await parseRes.JsonAsync();
        Assert.Equal("ai.invalid_json", err.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Generate_RejectsWhenInCopyPasteMode()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "aiuser6");

        var genReq = new
        {
            task = "generate_cover_letter",
            jobTitle = "Software Dev"
        };
        var genRes = await user.PostAsync("/api/ai/generate", genReq);
        Assert.Equal(HttpStatusCode.BadRequest, genRes.StatusCode);
        var err = await genRes.JsonAsync();
        Assert.Equal("ai.copy_paste_only", err.GetProperty("code").GetString());
    }

    [Fact]
    public async Task AdminServerAiConfig_AndUserFallback_Works()
    {
        var admin = await fixture.AdminAsync();
        var (user, _) = await fixture.UserAsync(admin, "aiuser7");

        // 1. Non-admin cannot access admin-config
        var forbidRes = await user.GetAsync("/api/ai/admin-config");
        Assert.Equal(HttpStatusCode.Forbidden, forbidRes.StatusCode);

        // 2. Admin gets default server config
        var getAdminRes = await admin.GetAsync("/api/ai/admin-config");
        Assert.Equal(HttpStatusCode.OK, getAdminRes.StatusCode);
        var adminCfg = await getAdminRes.JsonAsync();
        Assert.False(adminCfg.GetProperty("enabled").GetBoolean());

        // 3. Admin enables server AI with Ollama
        var saveAdminRes = await admin.PutAsync("/api/ai/admin-config", new
        {
            enabled = true,
            provider = "ollama",
            model = "llama3:latest",
            baseUrl = "http://localhost:11434"
        });
        Assert.Equal(HttpStatusCode.OK, saveAdminRes.StatusCode);
        var savedAdminCfg = await saveAdminRes.JsonAsync();
        Assert.True(savedAdminCfg.GetProperty("enabled").GetBoolean());
        Assert.Equal("ollama", savedAdminCfg.GetProperty("provider").GetString());

        // 4. Normal user now sees hasServerFallback = true
        var userCfgRes = await user.GetAsync("/api/ai/config");
        Assert.Equal(HttpStatusCode.OK, userCfgRes.StatusCode);
        var userCfg = await userCfgRes.JsonAsync();
        Assert.True(userCfg.GetProperty("hasServerFallback").GetBoolean());
        Assert.Equal("ollama", userCfg.GetProperty("serverFallbackProvider").GetString());
    }
}

