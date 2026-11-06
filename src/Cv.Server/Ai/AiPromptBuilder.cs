// Copyright (c) 2026 SushiFlux Develop
// Licensed under the AGPL-3.0-only.

using System.Text;
using System.Text.Json;
using Cv.Server.Data;

namespace Cv.Server.Ai;

public static class AiPromptBuilder
{
    public static (string SystemPrompt, string UserPrompt, string FullCopyPasteText) Build(
        string task,
        UserProfile? profile,
        AiPromptRequest req,
        bool pseudonymize
    )
    {
        var pMap = AiPseudonymizer.ExtractMap(profile);
        var lang = req.Language?.ToLowerInvariant() == "en" ? "en" : "de";
        var isEn = lang == "en";

        return task switch
        {
            AiTasks.GenerateCoverLetter => BuildCoverLetterPrompt(profile, req, pMap, pseudonymize, isEn),
            AiTasks.AnalyzeJobPosting => BuildJobAnalysisPrompt(profile, req, pMap, pseudonymize, isEn),
            AiTasks.GenerateSummary => BuildSummaryPrompt(profile, req, pMap, pseudonymize, isEn),
            AiTasks.ImproveBulletPoint => BuildImproveBulletPrompt(req, isEn),
            AiTasks.TranslateContent => BuildTranslatePrompt(req, isEn),
            _ => throw new ArgumentException($"Unknown AI task '{task}'.", nameof(task))
        };
    }

    private static (string SystemPrompt, string UserPrompt, string FullCopyPasteText) BuildCoverLetterPrompt(
        UserProfile? profile,
        AiPromptRequest req,
        AiPseudonymizer.ReplacementMap pMap,
        bool pseudonymize,
        bool isEn
    )
    {
        var tone = string.IsNullOrWhiteSpace(req.Tone) ? (isEn ? "professional and confident" : "professionell, sympathisch und überzeugend") : req.Tone;
        var recipient = string.IsNullOrWhiteSpace(req.RecipientPerson)
            ? (isEn ? "Hiring Manager" : "Damen und Herren")
            : req.RecipientPerson;

        var systemPrompt = isEn
            ? "You are an elite executive career coach and professional application writer. " +
              "Generate a high-converting cover letter tailored strictly to the target company and job description. " +
              "Style guidelines: concise, compelling, active voice, concrete achievements. " +
              "You must respond ONLY with a valid JSON object matching the requested schema. No markdown formatting outside the JSON, no conversational pleasantries."
            : "Du bist ein erfahrener Karriereberater und Experte für professionelle Bewerbungsunterlagen nach DIN 5008. " +
              "Verfasse ein individuelles, überzeugendes Anschreiben, das perfekt auf die Zielposition und das Unternehmen zugeschnitten ist. " +
              "Stil: prägnant, authentisch, starke Verben, messbare Erfolge, keine verstaubten Floskeln (\"Hiermit bewerbe ich mich...\"). " +
              "Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt gemäß dem vorgegebenen Schema. Keinerlei Begleittext außerhalb des JSON.";

        var sb = new StringBuilder();
        if (isEn)
        {
            sb.AppendLine($"Target Position: {req.JobTitle ?? "Software Engineer"}");
            sb.AppendLine($"Company: {req.Company ?? "Company"}");
            sb.AppendLine($"Recipient: {recipient}");
            sb.AppendLine($"Tone: {tone}");
            if (!string.IsNullOrWhiteSpace(req.JobDescription))
            {
                sb.AppendLine();
                sb.AppendLine("=== JOB DESCRIPTION / REQUIREMENTS ===");
                sb.AppendLine(req.JobDescription.Trim());
            }
        }
        else
        {
            sb.AppendLine($"Zielposition: {req.JobTitle ?? "Fachkraft"}");
            sb.AppendLine($"Unternehmen: {req.Company ?? "Unternehmen"}");
            sb.AppendLine($"Ansprechpartner: {recipient}");
            sb.AppendLine($"Gewünschter Tonfall: {tone}");
            if (!string.IsNullOrWhiteSpace(req.JobDescription))
            {
                sb.AppendLine();
                sb.AppendLine("=== STELLENANZEIGE / ANFORDERUNGEN ===");
                sb.AppendLine(req.JobDescription.Trim());
            }
        }

        AppendProfileSummary(sb, profile, isEn);

        var jsonSchema = isEn
            ? "{\n" +
              "  \"subject\": \"Application as <JobTitle> - <Optional Reference/Focus>\",\n" +
              "  \"salutation\": \"Dear <Recipient>,\",\n" +
              "  \"opening\": \"<1-2 punchy opening sentences explaining motivation and top value proposition>\",\n" +
              "  \"body\": \"<2-3 structured paragraphs detailing relevant experience, tech stack fit and quantifiable achievements>\",\n" +
              "  \"closing\": \"<1-2 confident sentences on notice period/salary expectation if applicable and invitation to an interview>\",\n" +
              "  \"keyMatches\": [\"<Match 1>\", \"<Match 2>\", \"<Match 3>\"]\n" +
              "}"
            : "{\n" +
              "  \"subject\": \"Bewerbung als <JobTitle>\",\n" +
              "  \"salutation\": \"Sehr geehrte(r) <Ansprechpartner>,\",\n" +
              "  \"opening\": \"<1-2 überzeugende Einleitungssätze mit Mehrwert und Motivation>\",\n" +
              "  \"body\": \"<2-3 gegliederte Absätze mit relevanten Berufsstationen, Methoden, Tech-Stack und messbaren Erfolgen>\",\n" +
              "  \"closing\": \"<1-2 abschließende Sätze zu Gehalt/Verfügbarkeit und Vorfreude auf das persönliche Kennenlernen>\",\n" +
              "  \"keyMatches\": [\"<Übereinstimmung 1>\", \"<Übereinstimmung 2>\", \"<Übereinstimmung 3>\"]\n" +
              "}";

        sb.AppendLine();
        sb.AppendLine(isEn ? "=== REQUIRED JSON OUTPUT SCHEMA ===" : "=== GEFORDERTES JSON-SCHEMA ===");
        sb.AppendLine(jsonSchema);

        var userPrompt = sb.ToString();
        if (pseudonymize)
        {
            userPrompt = AiPseudonymizer.Pseudonymize(userPrompt, pMap);
        }

        var copyPaste = BuildCopyPasteText(systemPrompt, userPrompt);
        return (systemPrompt, userPrompt, copyPaste);
    }

    private static (string SystemPrompt, string UserPrompt, string FullCopyPasteText) BuildJobAnalysisPrompt(
        UserProfile? profile,
        AiPromptRequest req,
        AiPseudonymizer.ReplacementMap pMap,
        bool pseudonymize,
        bool isEn
    )
    {
        var systemPrompt = isEn
            ? "You are an AI recruitment strategist. Analyze the provided job posting against the candidate's background. " +
              "Evaluate requirement matches, identify critical skill gaps, calculate an honest match score (0-100), and suggest tactical application tips. " +
              "Respond strictly in JSON format without extra text."
            : "Du bist ein strategischer HR- und Recruiting-Experte. Vergleiche die bereitgestellte Stellenanzeige mit dem Profil des Kandidaten. " +
              "Identifiziere abgedeckte Anforderungen, nenne eventuelle Lücken mit konstruktiven Formulierungstipps, berechne einen realistischen Passungs-Score (0-100) " +
              "und gib taktische Empfehlungen für die Bewerbung. Antworte ausschließlich im JSON-Format.";

        var sb = new StringBuilder();
        sb.AppendLine(isEn ? $"Target Job: {req.JobTitle ?? "Position"} at {req.Company ?? "Company"}" : $"Zielstelle: {req.JobTitle ?? "Stelle"} bei {req.Company ?? "Unternehmen"}");
        sb.AppendLine();
        sb.AppendLine(isEn ? "=== JOB POSTING TEXT ===" : "=== TEXT DER STELLENANZEIGE ===");
        sb.AppendLine(req.JobDescription?.Trim() ?? "(Kein Stellenanzeigentext übergeben)");
        sb.AppendLine();

        AppendProfileSummary(sb, profile, isEn);

        var jsonSchema = "{\n" +
            "  \"matchScore\": 85,\n" +
            "  \"summary\": \"<Kurze Zusammenfassung der Passung in 2-3 Sätzen>\",\n" +
            "  \"matchedRequirements\": [\n" +
            "    { \"requirement\": \"<Geforderte Qualifikation>\", \"candidateMatch\": \"<Wie das Profil das erfüllt>\" }\n" +
            "  ],\n" +
            "  \"missingRequirements\": [\n" +
            "    { \"requirement\": \"<Fehlende Anforderung>\", \"suggestion\": \"<Tipp, wie man dies im Gespräch/Anschreiben positiv ausgleicht>\" }\n" +
            "  ],\n" +
            "  \"tips\": [\n" +
            "    \"<Strategischer Tipp 1>\",\n" +
            "    \"<Strategischer Tipp 2>\"\n" +
            "  ]\n" +
            "}";

        sb.AppendLine();
        sb.AppendLine(isEn ? "=== REQUIRED JSON OUTPUT SCHEMA ===" : "=== GEFORDERTES JSON-SCHEMA ===");
        sb.AppendLine(jsonSchema);

        var userPrompt = sb.ToString();
        if (pseudonymize)
        {
            userPrompt = AiPseudonymizer.Pseudonymize(userPrompt, pMap);
        }

        var copyPaste = BuildCopyPasteText(systemPrompt, userPrompt);
        return (systemPrompt, userPrompt, copyPaste);
    }

    private static (string SystemPrompt, string UserPrompt, string FullCopyPasteText) BuildSummaryPrompt(
        UserProfile? profile,
        AiPromptRequest req,
        AiPseudonymizer.ReplacementMap pMap,
        bool pseudonymize,
        bool isEn
    )
    {
        var systemPrompt = isEn
            ? "You are a professional resume writer. Craft a powerful, 2-3 sentence executive profile summary / elevator pitch " +
              "highlighting key competencies, leadership or technical impact, and core value proposition. Respond strictly with the requested JSON."
            : "Du bist ein professioneller Lebenslauf-Texter. Verfasse ein prägnantes, überzeugendes Kurzprofil (\"Über mich\" / Elevator Pitch) " +
              "in 2-3 Sätzen sowie 3 prägnante Kernkompetenz-Bullets. Antworte ausschließlich mit dem geforderten JSON.";

        var sb = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(req.InputText))
        {
            sb.AppendLine(isEn ? $"Focal Area / Notes: {req.InputText}" : $"Schwerpunkt / Notizen: {req.InputText}");
        }
        AppendProfileSummary(sb, profile, isEn);

        var jsonSchema = "{\n" +
            "  \"shortSummary\": \"<2-3 prägnante Sätze für den Kopf des Lebenslaufs>\",\n" +
            "  \"bulletPoints\": [\n" +
            "    \"<Kernkompetenz 1>\",\n" +
            "    \"<Kernkompetenz 2>\",\n" +
            "    \"<Kernkompetenz 3>\"\n" +
            "  ]\n" +
            "}";

        sb.AppendLine();
        sb.AppendLine(isEn ? "=== REQUIRED JSON OUTPUT SCHEMA ===" : "=== GEFORDERTES JSON-SCHEMA ===");
        sb.AppendLine(jsonSchema);

        var userPrompt = sb.ToString();
        if (pseudonymize)
        {
            userPrompt = AiPseudonymizer.Pseudonymize(userPrompt, pMap);
        }

        var copyPaste = BuildCopyPasteText(systemPrompt, userPrompt);
        return (systemPrompt, userPrompt, copyPaste);
    }

    private static (string SystemPrompt, string UserPrompt, string FullCopyPasteText) BuildImproveBulletPrompt(
        AiPromptRequest req,
        bool isEn
    )
    {
        var systemPrompt = isEn
            ? "You are a senior resume editor specializing in the Google X-Y-Z and STAR accomplishment formats: " +
              "\"Accomplished [X] as measured by [Y], by doing [Z]\". Upgrade the provided bullet point with powerful action verbs " +
              "and tangible metrics. Respond strictly with the requested JSON."
            : "Du bist ein Experte für wirkungsvolle Lebenslauf-Stichpunkte nach der STAR- und XYZ-Methode " +
              "(\"Erreichte [X], gemessen an [Y], durch Maßnahme [Z]\"). Optimiere den übergebenen Stichpunkt mit starken Verben, " +
              "klarem Mehrwert und messbaren Ergebnissen. Antworte ausschließlich im JSON-Format.";

        var sb = new StringBuilder();
        sb.AppendLine(isEn ? $"Job Context: {req.JobTitle ?? "Professional Role"}" : $"Berufskontext: {req.JobTitle ?? "Position"}");
        sb.AppendLine(isEn ? "Raw Bullet Point to Improve:" : "Zu optimierender Stichpunkt:");
        sb.AppendLine($"\"{req.InputText ?? ""}\"");

        var jsonSchema = "{\n" +
            "  \"improved\": \"<Beste, schlagkräftigste Formulierung mit Aktionsverb und messbarem Resultat>\",\n" +
            "  \"alternatives\": [\n" +
            "    \"<Alternative Formulierung mit Fokus auf Führung oder Strategie>\",\n" +
            "    \"<Alternative Formulierung mit Fokus auf Technik oder Effizienz>\"\n" +
            "  ],\n" +
            "  \"explanation\": \"<Kurze Begründung, warum die Formulierung überzeugt>\"\n" +
            "}";

        sb.AppendLine();
        sb.AppendLine(isEn ? "=== REQUIRED JSON OUTPUT SCHEMA ===" : "=== GEFORDERTES JSON-SCHEMA ===");
        sb.AppendLine(jsonSchema);

        var userPrompt = sb.ToString();
        var copyPaste = BuildCopyPasteText(systemPrompt, userPrompt);
        return (systemPrompt, userPrompt, copyPaste);
    }

    private static (string SystemPrompt, string UserPrompt, string FullCopyPasteText) BuildTranslatePrompt(
        AiPromptRequest req,
        bool isEn
    )
    {
        var targetLang = isEn ? "English" : "German";
        var systemPrompt = $"You are a bilingual career translation expert. Translate the provided resume content into professional, natural {targetLang}. " +
                           "Preserve formatting and technical terms accurately. Respond strictly with the requested JSON schema.";

        var sb = new StringBuilder();
        sb.AppendLine($"Target Language: {targetLang}");
        sb.AppendLine("Source Content to translate:");
        sb.AppendLine(req.InputText ?? "");

        var jsonSchema = "{\n" +
            "  \"translatedText\": \"<Full translated text>\",\n" +
            "  \"items\": [\n" +
            "    { \"key\": \"content\", \"translation\": \"<Translated text>\" }\n" +
            "  ]\n" +
            "}";

        sb.AppendLine();
        sb.AppendLine("=== REQUIRED JSON OUTPUT SCHEMA ===");
        sb.AppendLine(jsonSchema);

        var userPrompt = sb.ToString();
        var copyPaste = BuildCopyPasteText(systemPrompt, userPrompt);
        return (systemPrompt, userPrompt, copyPaste);
    }

    private static void AppendProfileSummary(StringBuilder sb, UserProfile? profile, bool isEn)
    {
        sb.AppendLine();
        sb.AppendLine(isEn ? "=== CANDIDATE PROFILE & BACKGROUND ===" : "=== PROFIL & QUALIFIKATIONEN DES KANDIDATEN ===");

        if (profile is null)
        {
            sb.AppendLine(isEn ? "(No master profile stored)" : "(Kein Stammprofil hinterlegt)");
            return;
        }

        var candidateName = $"{profile.FirstName} {profile.LastName}".Trim();
        if (!string.IsNullOrWhiteSpace(candidateName))
        {
            sb.AppendLine(isEn ? $"Candidate: {candidateName}" : $"Kandidat: {candidateName}");
        }

        if (!string.IsNullOrWhiteSpace(profile.Email))
        {
            sb.AppendLine($"E-Mail: {profile.Email}");
        }

        if (!string.IsNullOrWhiteSpace(profile.Phone))
        {
            sb.AppendLine(isEn ? $"Phone: {profile.Phone}" : $"Telefon: {profile.Phone}");
        }

        if (!string.IsNullOrWhiteSpace(profile.ProfessionalTitle))
        {
            sb.AppendLine(isEn ? $"Title: {profile.ProfessionalTitle}" : $"Berufsbezeichnung: {profile.ProfessionalTitle}");
        }

        var addressParts = new List<string>();
        if (!string.IsNullOrWhiteSpace(profile.Street)) addressParts.Add(profile.Street);
        var cityLine = $"{profile.PostalCode} {profile.City}".Trim();
        if (!string.IsNullOrWhiteSpace(cityLine)) addressParts.Add(cityLine);
        if (addressParts.Count > 0)
        {
            var fullAddr = string.Join(", ", addressParts);
            sb.AppendLine(isEn ? $"Address: {fullAddr}" : $"Anschrift: {fullAddr}");
        }

        if (profile.Experiences.Count > 0)
        {
            sb.AppendLine(isEn ? "\nWork Experience:" : "\nBerufserfahrung:");
            foreach (var exp in profile.Experiences.OrderByDescending(x => x.StartDate))
            {
                var period = $"{exp.StartDate} - {(exp.IsCurrent ? (isEn ? "Present" : "heute") : exp.EndDate)}";
                sb.AppendLine($"- {exp.JobTitle} @ {exp.Employer} ({period})");
                if (!string.IsNullOrWhiteSpace(exp.Description))
                {
                    sb.AppendLine($"  {exp.Description.Trim()}");
                }
            }
        }

        if (profile.Educations.Count > 0)
        {
            sb.AppendLine(isEn ? "\nEducation:" : "\nAusbildung / Studium:");
            foreach (var edu in profile.Educations.OrderByDescending(x => x.StartDate))
            {
                var period = $"{edu.StartDate} - {(edu.IsCurrent ? (isEn ? "Present" : "heute") : edu.EndDate)}";
                sb.AppendLine($"- {edu.Degree} in {edu.FieldOfStudy} @ {edu.Institution} ({period})");
            }
        }

        if (profile.Skills.Count > 0)
        {
            sb.AppendLine(isEn ? "\nSkills:" : "\nKenntnisse & Fähigkeiten:");
            var skills = string.Join(", ", profile.Skills.Select(s => $"{s.Name} ({s.Level}/5)"));
            sb.AppendLine(skills);
        }

        if (profile.Languages.Count > 0)
        {
            sb.AppendLine(isEn ? "\nLanguages:" : "\nSprachen:");
            var langs = string.Join(", ", profile.Languages.Select(l => $"{l.Language} ({l.Level})"));
            sb.AppendLine(langs);
        }

        if (profile.Certificates.Count > 0)
        {
            sb.AppendLine(isEn ? "\nCertificates:" : "\nZertifikate:");
            foreach (var cert in profile.Certificates)
            {
                sb.AppendLine($"- {cert.Title} ({cert.Issuer}, {cert.IssueDate})");
            }
        }
    }

    private static string BuildCopyPasteText(string systemPrompt, string userPrompt)
    {
        var sb = new StringBuilder();
        sb.AppendLine("=== SYSTEM INSTRUCTION / ANWEISUNG AN DIE KI ===");
        sb.AppendLine(systemPrompt);
        sb.AppendLine();
        sb.AppendLine("=== AUFGABE & DATEN ===");
        sb.AppendLine(userPrompt);
        return sb.ToString();
    }
}
