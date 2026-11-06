// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using System.Text.Json.Serialization;

namespace Cv.Server.Ai;

public static class AiTasks
{
    public const string GenerateCoverLetter = "generate_cover_letter";
    public const string AnalyzeJobPosting = "analyze_job";
    public const string GenerateSummary = "generate_summary";
    public const string ImproveBulletPoint = "improve_bullet";
    public const string TranslateContent = "translate_content";

    public static bool IsValid(string? task) =>
        task is GenerateCoverLetter or AnalyzeJobPosting or GenerateSummary or ImproveBulletPoint or TranslateContent;
}

public sealed record AiConfigDto(
    string Provider,
    string Model,
    string? BaseUrl,
    bool HasApiKey,
    bool Pseudonymize,
    bool HasServerFallback = false,
    string? ServerFallbackProvider = null
);

public sealed record AdminServerAiConfigDto(
    bool Enabled,
    string? Provider,
    string? Model,
    string? BaseUrl,
    bool HasApiKey
);

public sealed record UpdateAdminServerAiConfigRequest(
    bool Enabled,
    string? Provider,
    string? Model,
    string? BaseUrl,
    string? ApiKey
);

public sealed record UpdateAiConfigRequest(
    string? Provider,
    string? Model,
    string? BaseUrl,
    string? ApiKey,
    bool? Pseudonymize
);

public sealed record TestAiConnectionResponse(
    bool Success,
    string? Message
);

public sealed record AiPromptRequest(
    string Task,
    string? JobTitle,
    string? Company,
    string? JobDescription,
    string? RecipientPerson,
    string? Tone,
    string? Language,
    string? InputText,
    Guid? CoverLetterId
);

public sealed record AiPromptResponse(
    string Task,
    string SystemPrompt,
    string UserPrompt,
    string FullCopyPasteText,
    bool Pseudonymized
);

public sealed record AiParseRequest(
    string Task,
    string RawResponse,
    bool Pseudonymized,
    string? Language
);

public sealed record AiGenerateRequest(
    string Task,
    string? JobTitle,
    string? Company,
    string? JobDescription,
    string? RecipientPerson,
    string? Tone,
    string? Language,
    string? InputText,
    Guid? CoverLetterId
);

public sealed record AiCoverLetterResult(
    [property: JsonPropertyName("subject")] string Subject,
    [property: JsonPropertyName("salutation")] string Salutation,
    [property: JsonPropertyName("opening")] string Opening,
    [property: JsonPropertyName("body")] string Body,
    [property: JsonPropertyName("closing")] string Closing,
    [property: JsonPropertyName("keyMatches")] List<string>? KeyMatches
);

public sealed record MatchedRequirement(
    [property: JsonPropertyName("requirement")] string Requirement,
    [property: JsonPropertyName("candidateMatch")] string CandidateMatch
);

public sealed record MissingRequirement(
    [property: JsonPropertyName("requirement")] string Requirement,
    [property: JsonPropertyName("suggestion")] string Suggestion
);

public sealed record AiJobAnalysisResult(
    [property: JsonPropertyName("matchScore")] int MatchScore,
    [property: JsonPropertyName("summary")] string Summary,
    [property: JsonPropertyName("matchedRequirements")] List<MatchedRequirement> MatchedRequirements,
    [property: JsonPropertyName("missingRequirements")] List<MissingRequirement> MissingRequirements,
    [property: JsonPropertyName("tips")] List<string> Tips
);

public sealed record AiSummaryResult(
    [property: JsonPropertyName("shortSummary")] string ShortSummary,
    [property: JsonPropertyName("bulletPoints")] List<string> BulletPoints
);

public sealed record AiImproveBulletResult(
    [property: JsonPropertyName("improved")] string Improved,
    [property: JsonPropertyName("alternatives")] List<string> Alternatives,
    [property: JsonPropertyName("explanation")] string Explanation
);

public sealed record TranslatedItem(
    [property: JsonPropertyName("key")] string Key,
    [property: JsonPropertyName("translation")] string Translation
);

public sealed record AiTranslateResult(
    [property: JsonPropertyName("translatedText")] string TranslatedText,
    [property: JsonPropertyName("items")] List<TranslatedItem>? Items
);

