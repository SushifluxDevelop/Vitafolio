// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using System.Text.Json;
using System.Text.RegularExpressions;
using Cv.Server.Data;
using Cv.Server.Errors;

namespace Cv.Server.Ai;

public static class AiResponseParser
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        AllowTrailingCommas = true,
        ReadCommentHandling = JsonCommentHandling.Skip
    };

    public static string ExtractJson(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";

        var text = raw.Trim();

        // 1. Check for markdown code fences ```json ... ``` or ``` ... ```
        var fenceMatch = Regex.Match(text, @"```(?:json)?\s*([\s\S]*?)\s*```", RegexOptions.IgnoreCase);
        if (fenceMatch.Success && !string.IsNullOrWhiteSpace(fenceMatch.Groups[1].Value))
        {
            text = fenceMatch.Groups[1].Value.Trim();
        }

        // 2. Locate outer JSON braces { ... }
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        if (start >= 0 && end > start)
        {
            return text.Substring(start, end - start + 1);
        }

        return text;
    }

    public static object ParseAndDePseudonymize(
        string task,
        string rawResponse,
        UserProfile? profile,
        bool pseudonymized
    )
    {
        var json = ExtractJson(rawResponse);
        if (string.IsNullOrWhiteSpace(json) || !json.TrimStart().StartsWith('{'))
        {
            throw ApiException.BadRequest(
                "ai.invalid_json",
                "Die KI-Antwort enthielt kein gültiges JSON. Bitte nutzen Sie die Schaltfläche 'Korrektur-Prompt kopieren'."
            );
        }

        var pMap = AiPseudonymizer.ExtractMap(profile);

        try
        {
            return task switch
            {
                AiTasks.GenerateCoverLetter => ParseCoverLetter(json, pMap, pseudonymized),
                AiTasks.AnalyzeJobPosting => ParseJobAnalysis(json, pMap, pseudonymized),
                AiTasks.GenerateSummary => ParseSummary(json, pMap, pseudonymized),
                AiTasks.ImproveBulletPoint => ParseImproveBullet(json),
                AiTasks.TranslateContent => ParseTranslate(json),
                _ => throw ApiException.BadRequest("ai.unsupported_task", $"Unbekannte KI-Aufgabe '{task}'.")
            };
        }
        catch (JsonException ex)
        {
            throw ApiException.BadRequest(
                "ai.parse_failed",
                $"Die JSON-Struktur der Antwort konnte nicht gelesen werden: {ex.Message}. Bitte fordern Sie die KI auf: 'Antworte ausschließlich im validen JSON-Format'."
            );
        }
    }

    private static AiCoverLetterResult ParseCoverLetter(string json, AiPseudonymizer.ReplacementMap pMap, bool pseudonymized)
    {
        var res = JsonSerializer.Deserialize<AiCoverLetterResult>(json, JsonOptions)
                  ?? throw new JsonException("Parsed cover letter result was null.");

        if (string.IsNullOrWhiteSpace(res.Subject) || string.IsNullOrWhiteSpace(res.Body))
        {
            throw ApiException.BadRequest(
                "ai.missing_fields",
                "Das Anschreiben enthält keinen Betreff oder Textkörper. Bitte prüfen Sie die Eingabe."
            );
        }

        if (!pseudonymized) return res;

        return new AiCoverLetterResult(
            Subject: AiPseudonymizer.DePseudonymize(res.Subject, pMap),
            Salutation: AiPseudonymizer.DePseudonymize(res.Salutation, pMap),
            Opening: AiPseudonymizer.DePseudonymize(res.Opening, pMap),
            Body: AiPseudonymizer.DePseudonymize(res.Body, pMap),
            Closing: AiPseudonymizer.DePseudonymize(res.Closing, pMap),
            KeyMatches: res.KeyMatches?.Select(m => AiPseudonymizer.DePseudonymize(m, pMap)).ToList()
        );
    }

    private static AiJobAnalysisResult ParseJobAnalysis(string json, AiPseudonymizer.ReplacementMap pMap, bool pseudonymized)
    {
        var res = JsonSerializer.Deserialize<AiJobAnalysisResult>(json, JsonOptions)
                  ?? throw new JsonException("Parsed job analysis result was null.");

        var score = Math.Clamp(res.MatchScore, 0, 100);

        if (!pseudonymized) return res with { MatchScore = score };

        return new AiJobAnalysisResult(
            MatchScore: score,
            Summary: AiPseudonymizer.DePseudonymize(res.Summary, pMap),
            MatchedRequirements: res.MatchedRequirements.Select(m => new MatchedRequirement(
                Requirement: AiPseudonymizer.DePseudonymize(m.Requirement, pMap),
                CandidateMatch: AiPseudonymizer.DePseudonymize(m.CandidateMatch, pMap)
            )).ToList(),
            MissingRequirements: res.MissingRequirements.Select(m => new MissingRequirement(
                Requirement: AiPseudonymizer.DePseudonymize(m.Requirement, pMap),
                Suggestion: AiPseudonymizer.DePseudonymize(m.Suggestion, pMap)
            )).ToList(),
            Tips: res.Tips.Select(t => AiPseudonymizer.DePseudonymize(t, pMap)).ToList()
        );
    }

    private static AiSummaryResult ParseSummary(string json, AiPseudonymizer.ReplacementMap pMap, bool pseudonymized)
    {
        var res = JsonSerializer.Deserialize<AiSummaryResult>(json, JsonOptions)
                  ?? throw new JsonException("Parsed summary result was null.");

        if (!pseudonymized) return res;

        return new AiSummaryResult(
            ShortSummary: AiPseudonymizer.DePseudonymize(res.ShortSummary, pMap),
            BulletPoints: res.BulletPoints.Select(b => AiPseudonymizer.DePseudonymize(b, pMap)).ToList()
        );
    }

    private static AiImproveBulletResult ParseImproveBullet(string json)
    {
        return JsonSerializer.Deserialize<AiImproveBulletResult>(json, JsonOptions)
               ?? throw new JsonException("Parsed bullet improvement was null.");
    }

    private static AiTranslateResult ParseTranslate(string json)
    {
        return JsonSerializer.Deserialize<AiTranslateResult>(json, JsonOptions)
               ?? throw new JsonException("Parsed translate result was null.");
    }
}
