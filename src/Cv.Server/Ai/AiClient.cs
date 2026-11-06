// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Cv.Server.Data;
using Cv.Server.Errors;

namespace Cv.Server.Ai;

public interface IAiClient
{
    Task<string> CompleteAsync(
        string provider,
        string model,
        string? baseUrl,
        string? apiKey,
        string systemPrompt,
        string userPrompt,
        CancellationToken ct
    );

    Task<TestAiConnectionResponse> TestConnectionAsync(
        string provider,
        string model,
        string? baseUrl,
        string? apiKey,
        CancellationToken ct
    );
}

public sealed class AiClient(HttpClient http, ILogger<AiClient> logger) : IAiClient
{
    private const string DefaultOpenAiBaseUrl = "https://api.openai.com/v1";
    private const string DefaultAnthropicBaseUrl = "https://api.anthropic.com/v1";
    private const string DefaultOllamaBaseUrl = "http://localhost:11434";

    public async Task<string> CompleteAsync(
        string provider,
        string model,
        string? baseUrl,
        string? apiKey,
        string systemPrompt,
        string userPrompt,
        CancellationToken ct
    )
    {
        return provider switch
        {
            AiProviders.OpenAi => await CallOpenAiCompatibleAsync(GetSafeBaseUrl(baseUrl, DefaultOpenAiBaseUrl), model, apiKey, systemPrompt, userPrompt, ct),
            AiProviders.Custom => await CallOpenAiCompatibleAsync(GetSafeBaseUrl(baseUrl, DefaultOpenAiBaseUrl), model, apiKey, systemPrompt, userPrompt, ct),
            AiProviders.Ollama => await CallOpenAiCompatibleAsync(GetSafeBaseUrl(baseUrl, DefaultOllamaBaseUrl) + "/v1", model, apiKey ?? "ollama", systemPrompt, userPrompt, ct),
            AiProviders.Anthropic => await CallAnthropicAsync(GetSafeBaseUrl(baseUrl, DefaultAnthropicBaseUrl), model, apiKey, systemPrompt, userPrompt, ct),
            AiProviders.Gemini => await CallGeminiAsync(model, apiKey, systemPrompt, userPrompt, ct),
            _ => throw ApiException.BadRequest("ai.invalid_provider", $"Anbieter '{provider}' unterstützt keine Direktverbindung.")
        };
    }

    public async Task<TestAiConnectionResponse> TestConnectionAsync(
        string provider,
        string model,
        string? baseUrl,
        string? apiKey,
        CancellationToken ct
    )
    {
        try
        {
            var ping = await CompleteAsync(
                provider,
                model,
                baseUrl,
                apiKey,
                "You are a helpful assistant.",
                "Reply with {\"status\":\"ok\"} in JSON.",
                ct
            );

            if (!string.IsNullOrWhiteSpace(ping))
            {
                return new TestAiConnectionResponse(true, "Verbindung erfolgreich hergestellt.");
            }

            return new TestAiConnectionResponse(false, "Keine Antwort vom Anbieter empfangen.");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "AI connection test failed for provider {Provider}", provider);
            return new TestAiConnectionResponse(false, $"Verbindungsfehler: {ex.Message}");
        }
    }

    private async Task<string> CallOpenAiCompatibleAsync(
        string baseUri,
        string model,
        string? apiKey,
        string systemPrompt,
        string userPrompt,
        CancellationToken ct
    )
    {
        var endpoint = $"{baseUri.TrimEnd('/')}/chat/completions";
        using var req = new HttpRequestMessage(HttpMethod.Post, endpoint);

        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey.Trim());
        }

        var bodyObj = new
        {
            model = string.IsNullOrWhiteSpace(model) ? "gpt-4o-mini" : model.Trim(),
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userPrompt }
            },
            temperature = 0.3
        };

        req.Content = new StringContent(JsonSerializer.Serialize(bodyObj), Encoding.UTF8, "application/json");

        using var resp = await http.SendAsync(req, ct);
        var respContent = await resp.Content.ReadAsStringAsync(ct);

        if (!resp.IsSuccessStatusCode)
        {
            throw ApiException.BadRequest(
                "ai.api_error",
                $"KI-Dienst antwortete mit Fehler ({resp.StatusCode}): {Truncate(respContent, 200)}"
            );
        }

        var doc = JsonNode.Parse(respContent);
        var message = doc?["choices"]?[0]?["message"]?["content"]?.GetValue<string>();

        return message ?? "";
    }

    private async Task<string> CallAnthropicAsync(
        string baseUri,
        string model,
        string? apiKey,
        string systemPrompt,
        string userPrompt,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw ApiException.BadRequest("ai.missing_key", "Anthropic erfordert einen API-Key.");
        }

        var endpoint = $"{baseUri.TrimEnd('/')}/messages";
        using var req = new HttpRequestMessage(HttpMethod.Post, endpoint);
        req.Headers.Add("x-api-key", apiKey.Trim());
        req.Headers.Add("anthropic-version", "2023-06-01");

        var bodyObj = new
        {
            model = string.IsNullOrWhiteSpace(model) ? "claude-3-5-haiku-20241022" : model.Trim(),
            max_tokens = 4096,
            system = systemPrompt,
            messages = new[]
            {
                new { role = "user", content = userPrompt }
            },
            temperature = 0.3
        };

        req.Content = new StringContent(JsonSerializer.Serialize(bodyObj), Encoding.UTF8, "application/json");

        using var resp = await http.SendAsync(req, ct);
        var respContent = await resp.Content.ReadAsStringAsync(ct);

        if (!resp.IsSuccessStatusCode)
        {
            throw ApiException.BadRequest(
                "ai.api_error",
                $"Anthropic antwortete mit Fehler ({resp.StatusCode}): {Truncate(respContent, 200)}"
            );
        }

        var doc = JsonNode.Parse(respContent);
        var text = doc?["content"]?[0]?["text"]?.GetValue<string>();

        return text ?? "";
    }

    private async Task<string> CallGeminiAsync(
        string model,
        string? apiKey,
        string systemPrompt,
        string userPrompt,
        CancellationToken ct
    )
    {
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw ApiException.BadRequest("ai.missing_key", "Google Gemini erfordert einen API-Key.");
        }

        var chosenModel = string.IsNullOrWhiteSpace(model) ? "gemini-2.5-flash" : model.Trim();
        var endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/{chosenModel}:generateContent?key={Uri.EscapeDataString(apiKey.Trim())}";

        using var req = new HttpRequestMessage(HttpMethod.Post, endpoint);

        var bodyObj = new
        {
            systemInstruction = new
            {
                parts = new[] { new { text = systemPrompt } }
            },
            contents = new[]
            {
                new { parts = new[] { new { text = userPrompt } } }
            },
            generationConfig = new
            {
                temperature = 0.3,
                responseMimeType = "application/json"
            }
        };

        req.Content = new StringContent(JsonSerializer.Serialize(bodyObj), Encoding.UTF8, "application/json");

        using var resp = await http.SendAsync(req, ct);
        var respContent = await resp.Content.ReadAsStringAsync(ct);

        if (!resp.IsSuccessStatusCode)
        {
            throw ApiException.BadRequest(
                "ai.api_error",
                $"Google Gemini antwortete mit Fehler ({resp.StatusCode}): {Truncate(respContent, 200)}"
            );
        }

        var doc = JsonNode.Parse(respContent);
        var text = doc?["candidates"]?[0]?["content"]?["parts"]?[0]?["text"]?.GetValue<string>();

        return text ?? "";
    }

    private static string GetSafeBaseUrl(string? configured, string fallback)
    {
        if (string.IsNullOrWhiteSpace(configured)) return fallback;

        var trimmed = configured.Trim();
        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
        {
            throw ApiException.BadRequest("ai.invalid_url", "Die angegebene Basis-URL ist ungültig.");
        }

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
        {
            throw ApiException.BadRequest("ai.invalid_url", "Es werden nur HTTP- und HTTPS-Adressen unterstützt.");
        }

        // SSRF protection: reject AWS/GCP instance metadata endpoint
        if (uri.Host == "169.254.169.254" || uri.Host.Equals("metadata.google.internal", StringComparison.OrdinalIgnoreCase))
        {
            throw ApiException.BadRequest("ai.invalid_url", "Verbindung zu Cloud-Metadatendiensten ist aus Sicherheitsgründen gesperrt.");
        }

        return trimmed.TrimEnd('/');
    }

    private static string Truncate(string text, int maxLen) =>
        text.Length <= maxLen ? text : text[..maxLen] + "...";
}
