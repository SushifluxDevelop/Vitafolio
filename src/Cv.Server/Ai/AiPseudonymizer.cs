// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using System.Text.RegularExpressions;
using Cv.Server.Data;

namespace Cv.Server.Ai;

public static class AiPseudonymizer
{
    public const string TokenName = "[BEWERBER_NAME]";
    public const string TokenEmail = "[BEWERBER_EMAIL]";
    public const string TokenPhone = "[BEWERBER_TELEFON]";
    public const string TokenAddress = "[BEWERBER_ANSCHRIFT]";
    public const string TokenBirthDate = "[BEWERBER_GEBURTSDATUM]";
    public const string TokenBirthPlace = "[BEWERBER_GEBURTSORT]";

    public sealed record ReplacementMap(
        string? Name,
        string? Email,
        string? Phone,
        string? Address,
        string? BirthDate,
        string? BirthPlace
    );

    public static ReplacementMap ExtractMap(UserProfile? profile)
    {
        if (profile is null)
        {
            return new ReplacementMap(null, null, null, null, null, null);
        }

        var fullName = $"{profile.FirstName} {profile.LastName}".Trim();
        if (string.IsNullOrWhiteSpace(fullName)) fullName = null;

        var addressParts = new List<string>();
        if (!string.IsNullOrWhiteSpace(profile.Street)) addressParts.Add(profile.Street);
        var cityLine = $"{profile.PostalCode} {profile.City}".Trim();
        if (!string.IsNullOrWhiteSpace(cityLine)) addressParts.Add(cityLine);
        var address = addressParts.Count > 0 ? string.Join(", ", addressParts) : null;

        return new ReplacementMap(
            Name: fullName,
            Email: string.IsNullOrWhiteSpace(profile.Email) ? null : profile.Email.Trim(),
            Phone: string.IsNullOrWhiteSpace(profile.Phone) ? null : profile.Phone.Trim(),
            Address: address,
            BirthDate: profile.DateOfBirth,
            BirthPlace: string.IsNullOrWhiteSpace(profile.PlaceOfBirth) ? null : profile.PlaceOfBirth.Trim()
        );
    }

    public static string Pseudonymize(string text, ReplacementMap map)
    {
        if (string.IsNullOrEmpty(text)) return text;

        var result = text;

        if (!string.IsNullOrEmpty(map.Email))
        {
            result = Regex.Replace(result, Regex.Escape(map.Email), TokenEmail, RegexOptions.IgnoreCase);
        }

        if (!string.IsNullOrEmpty(map.Phone))
        {
            result = Regex.Replace(result, Regex.Escape(map.Phone), TokenPhone, RegexOptions.IgnoreCase);
        }

        if (!string.IsNullOrEmpty(map.Address))
        {
            result = Regex.Replace(result, Regex.Escape(map.Address), TokenAddress, RegexOptions.IgnoreCase);
        }

        if (!string.IsNullOrEmpty(map.Name))
        {
            result = Regex.Replace(result, Regex.Escape(map.Name), TokenName, RegexOptions.IgnoreCase);
        }

        if (!string.IsNullOrEmpty(map.BirthDate))
        {
            result = Regex.Replace(result, Regex.Escape(map.BirthDate), TokenBirthDate, RegexOptions.IgnoreCase);
        }

        if (!string.IsNullOrEmpty(map.BirthPlace))
        {
            result = Regex.Replace(result, Regex.Escape(map.BirthPlace), TokenBirthPlace, RegexOptions.IgnoreCase);
        }

        return result;
    }

    public static string DePseudonymize(string text, ReplacementMap map)
    {
        if (string.IsNullOrEmpty(text)) return text;

        var result = text;

        if (!string.IsNullOrEmpty(map.Name))
        {
            result = result.Replace(TokenName, map.Name, StringComparison.OrdinalIgnoreCase)
                           .Replace("[CANDIDATE_NAME]", map.Name, StringComparison.OrdinalIgnoreCase)
                           .Replace("[NAME]", map.Name, StringComparison.OrdinalIgnoreCase);
        }

        if (!string.IsNullOrEmpty(map.Email))
        {
            result = result.Replace(TokenEmail, map.Email, StringComparison.OrdinalIgnoreCase)
                           .Replace("[CANDIDATE_EMAIL]", map.Email, StringComparison.OrdinalIgnoreCase)
                           .Replace("[EMAIL]", map.Email, StringComparison.OrdinalIgnoreCase);
        }

        if (!string.IsNullOrEmpty(map.Phone))
        {
            result = result.Replace(TokenPhone, map.Phone, StringComparison.OrdinalIgnoreCase)
                           .Replace("[CANDIDATE_PHONE]", map.Phone, StringComparison.OrdinalIgnoreCase)
                           .Replace("[TELEFON]", map.Phone, StringComparison.OrdinalIgnoreCase)
                           .Replace("[PHONE]", map.Phone, StringComparison.OrdinalIgnoreCase);
        }

        if (!string.IsNullOrEmpty(map.Address))
        {
            result = result.Replace(TokenAddress, map.Address, StringComparison.OrdinalIgnoreCase)
                           .Replace("[CANDIDATE_ADDRESS]", map.Address, StringComparison.OrdinalIgnoreCase)
                           .Replace("[ANSCHRIFT]", map.Address, StringComparison.OrdinalIgnoreCase);
        }

        if (!string.IsNullOrEmpty(map.BirthDate))
        {
            result = result.Replace(TokenBirthDate, map.BirthDate, StringComparison.OrdinalIgnoreCase)
                           .Replace("[GEBURTSDATUM]", map.BirthDate, StringComparison.OrdinalIgnoreCase);
        }

        if (!string.IsNullOrEmpty(map.BirthPlace))
        {
            result = result.Replace(TokenBirthPlace, map.BirthPlace, StringComparison.OrdinalIgnoreCase)
                           .Replace("[GEBURTSORT]", map.BirthPlace, StringComparison.OrdinalIgnoreCase);
        }

        return result;
    }
}
