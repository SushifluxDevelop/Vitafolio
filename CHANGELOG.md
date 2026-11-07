# Changelog

**[English](#english) · [Deutsch](#deutsch)**

---

<a name="english"></a>
## English

## v2026.11.6 (0.1978 α)

Complete suite for modern job applications: visual resume builder with Typst typesetting and Open XML Word export, DIN 5008 cover letters, Kanban application tracker with revision-safe dossier snapshots, privacy-first AI assistance with PII pseudonymization and server-wide admin keys, JSON Resume data portability, career gap analysis, guided wizard mode, and centralized credential attachment management.

### ✨ New

- **Full Application Portfolio & Dossier Snapshots:** combine cover sheet, DIN 5008 cover letter, resume, and credential attachments into a single, cohesive vector PDF portfolio. Setting an application status to "Applied" automatically archives an immutable PDF snapshot for permanent auditability.
- **Application Tracker & Kanban Pipeline:** visual 6-stage pipeline (Draft, Applied, Acknowledged, Interview, Offer, Concluded) with timeline events, custom follow-up dates, and an automatic 14-day inactivity reminder alert.
- **DIN 5008 Cover Letters & Word (.docx) Export:** business-standard letters (Form B) with window envelope return address line, 45 mm recipient field, fold and punch marks, handwritten signature support, live preview, and editable Word export.
- **Privacy-First AI Assistance:** 5 dedicated assistants (cover letter drafting, job description match analysis, elevator pitch summary, STAR-method bullet refinement, and bilingual translations) with zero-trust PII pseudonymization (`[BEWERBER_*]`) and support for copy-paste, cloud API keys, and offline local models (Ollama, LM Studio).
- **Server-wide Shared AI Configuration:** administrators can configure a shared default AI provider and API key encrypted at rest via ASP.NET Core Data Protection, enabling instant team access with automatic fallback for users without individual keys.
- **JSON Resume Import & Export (Schema v1.0.0):** 1-click export of the entire profile as `resume.json` and flexible import with merge or clean replacement modes.
- **Career Gap Analyzer:** automatically identifies chronological career gaps (> 30–45 days) with constructive, non-judgmental guidance and 1-click quick actions to insert career transition, sabbatical, or further training periods.
- **Guided Profile Wizard:** 5-step guided walkthrough for creating profiles from scratch, freely toggleable with the classic tab view.
- **Credential & Attachment Management:** centralized document storage for reference letters, university certificates, and samples (PDF, PNG, JPEG, WebP up to 20 MB) with automatic high-resolution page rendering in the dossier PDF.
- **Unraid CA Template & CI/CD Pipeline:** official Community Applications XML template for Unraid Docker installations and automated multi-stage GitHub Actions release workflow.

## v2026.11.1 (19.31258 β)

Vitafolio is a free, open-source app for job applications. This first beta lays the foundation: a Windows program and a
Docker image (Unraid, NAS, Linux servers) with accounts, settings and a complete data backup. The features for CVs, cover
letters and the application tracker build on it in the next versions.

### ✨ New

- **Two versions from one app:** a Windows program with its own window (your data stays on your PC and survives
  uninstalling) and a Docker container with a web interface for your server.
- **Secure sign-in (Docker):** the first account is created with a one-time setup code from the server log; two-factor
  sign-in with an authenticator app and recovery codes; overview of signed-in devices; protection against password guessing.
- **App administration:** manage users and roles, turn self-registration on or off, require two-factor sign-in for
  everyone, and an activity log of what happened.
- **Data backup:** back up now, download, upload and restore by button; automatic backups at start, before shutdown, every
  few hours or at fixed times on chosen weekdays, with a week preview - and a master switch if you already have your own
  backup system.
- **Light and dark design, German and English**, readable contrast in both.

---

<a name="deutsch"></a>
## Deutsch

## v2026.11.6 (0.1978 α)

Vollständige Suite für professionelle Bewerbungen: Visueller Lebenslauf-Editor mit Typst-Setzmaschine und Word-Export (.docx), normgerechte DIN-5008-Anschreiben, Kanban-Bewerbungs-Tracker mit revisionssicherer Dossier-Archivierung, datenschutzfreundliche KI-Unterstützung mit automatischer Pseudonymisierung und geteiltem Server-Schlüssel, JSON-Resume-Datenportabilität, Lücken-Analyse im Werdegang, geführter Profil-Assistent und zentrale Anlagen- und Zeugnisverwaltung.

### ✨ Neu

- **Vollständige Bewerbungsmappe & Revisionssichere Dossiers:** Schnürt Deckblatt, DIN-5008-Anschreiben, Lebenslauf und Zeugnis-Nachweise zu einer einzigen, gestochen scharfen PDF-Mappe zusammen. Beim Wechsel auf den Status „Beworben“ wird automatisch ein unveränderlicher PDF-Snapshot fest im Datenordner archiviert.
- **Bewerbungs-Tracker & Kanban-Board:** 6-Phasen-Pipeline (Entwurf, Beworben, Bestätigt, Gespräch, Angebot, Abgeschlossen) mit chronologischer Timeline, Wiedervorlage-Terminen und automatischem 14-Tage-Nachfass-Alarm.
- **DIN-5008-Anschreiben & nativer Word-Export (.docx):** Normgerechte Geschäftsbriefe (Form B) mit Falt- und Lochmarken, Sichtfenster-Absenderzeile, handschriftlicher digitaler Unterschrift, Live-Vorschau und editierbarem Word-Download.
- **Datenschutzfreundliche KI-Unterstützung:** 5 spezialisierte Assistenten (Anschreiben, Stellenanzeigen-Analyse, Elevator Pitch, Lebenslauf-Erfolge nach STAR/XYZ-Methode und bilinguale Übersetzung) mit Zero-Trust PII-Pseudonymisierung (`[BEWERBER_*]`), sicherem Key-Schutz und Offline-Unterstützung (Ollama, LM Studio).
- **Zentraler Server-Schlüssel für Administratoren:** Administratoren können einen geteilten Standard-KI-Schlüssel (verschlüsselt via ASP.NET Core Data Protection) hinterlegen, der Benutzern ohne eigenen Key automatisch zur Verfügung steht.
- **JSON Resume Import & Export (Schema v1.0.0):** 1-Klick-Export des Profils als `resume.json` und flexibler Import (Zusammenführen bestehender Daten oder vollständiges Ersetzen) zur herstellerunabhängigen Datenportabilität.
- **Lücken-Analyse im Werdegang (Gap Analyzer):** Automatische Erkennung zeitlicher Unterbrechungen (> 30–45 Tage) mit wertschätzenden Empfehlungen und 1-Klick-Schnellaktionen (*„+ Neuorientierung“*, *„+ Weiterbildung“*, *„+ Elternzeit / Auszeit“*).
- **Geführter Profil-Assistent (Wizard):** 5-stufiger Schritt-für-Schritt-Modus für Einsteiger, nahtlos und verlustfrei mit der gewohnten Reiter-Ansicht umschaltbar.
- **Zentrale Anlagen- und Zeugnis-Verwaltung:** Dokumentenablage für Arbeitszeugnisse, Diplome und Zertifikate (PDF, PNG, JPEG, WebP bis 20 MB) mit automatischer Einbettung von Bildnachweisen auf eigenen Seiten im Bewerbungsdossier.
- **Unraid-Vorlage & Automatisierter Release-Workflow:** Offizielle Unraid Community Applications Vorlage sowie GitHub-Actions-Pipeline für Docker- und Windows-Builds.

## v2026.11.1 (19.31258 β)

Vitafolio ist eine kostenlose Open-Source-App für Bewerbungen. Diese erste Beta legt das Fundament: ein Windows-Programm
und ein Docker-Image (Unraid, NAS, Linux-Server) mit Konten, Einstellungen und einer vollständigen Datensicherung. Die
Funktionen für Lebenslauf, Anschreiben und den Bewerbungs-Tracker bauen in den nächsten Versionen darauf auf.

### ✨ Neu

- **Zwei Versionen aus einer App:** ein Windows-Programm mit eigenem Fenster (Ihre Daten bleiben auf Ihrem PC und
  überstehen auch das Deinstallieren) und ein Docker-Container mit Weboberfläche für Ihren Server.
- **Sichere Anmeldung (Docker):** Das erste Konto wird mit einem einmaligen Einrichtungscode aus dem Server-Protokoll
  angelegt; Zwei-Faktor-Anmeldung mit Authenticator-App und Wiederherstellungscodes; Übersicht der angemeldeten Geräte;
  Schutz gegen Passwort-Raten.
- **App-Administration:** Benutzer und Rollen verwalten, Selbst-Registrierung ein- oder ausschalten, Zwei-Faktor-Anmeldung
  für alle verlangen, Aktivitätsprotokoll.
- **Datensicherung:** jetzt sichern, herunterladen, hochladen und wiederherstellen per Knopf; automatisch beim Start, vor
  dem Beenden, alle paar Stunden oder zu festen Zeiten an gewählten Wochentagen, mit Wochenvorschau – und einem
  Hauptschalter, falls Sie schon ein eigenes Backup-System haben.
- **Hell und Dunkel, Deutsch und Englisch**, in beiden gut lesbar.
