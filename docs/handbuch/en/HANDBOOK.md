---
title: Vitafolio
subtitle: Handbook
tagline: Install, configure, secure, and create perfect job applications – how to use Vitafolio step by step.
version: Beta (v2026.11)
date: 2026-11-06
status: Beta
classification: Public
copyright: © 2026 SushiFlux Develop
lang: en
---

# 1 What is Vitafolio?

Vitafolio is a modern, privacy-first complete solution for your job applications. It is **open source**: the "recipe"
of the program is public for everyone to inspect, and anyone may use the software for free indefinitely.

This handbook describes the **current release** of Vitafolio. Here is what you can do with it:

- **Master Profile & CV:** Maintain your personal data, work history, education, skills, and certifications once in a single central place.
  Generate tailored, professional curriculum vitae with native Typst in-memory PDF compilation (Classic, Modern, Plain) and Word (.docx) export.
- **DIN 5008 Cover Letters:** Draft standardized German and international cover letters (DIN 5008 Form B) with fold and punch marks,
  proper address windows for envelope mailing, rich formatting, and handwritten signatures.
- **Application Tracker & Dossier Portfolios:** Track every active application on an interactive Kanban board, monitor timeline events,
  receive automatic 14-day follow-up reminders, and archive submitted portfolios (cover sheet + cover letter + CV) as immutable PDF snapshots.
- **Privacy-First AI Assistance:** Leverage optional AI helpers for drafting cover letters, analyzing job postings (fit check & gap analysis),
  formulating executive summaries, polishing bullet points (STAR/XYZ method), and translating content – available 100% free in Copy & Paste mode
  or via custom API keys and local offline models (Ollama), protected by zero-trust PII pseudonymization.
- **Flexible Self-Hosting & Desktop:** Run Vitafolio as a lightweight standalone Windows desktop application or as a hardened Docker container
  on your home server (Unraid, Synology NAS, Linux).
- **Security & Backups:** Benefit from two-factor authentication (TOTP 2FA), role-based permissions, administrator emergency recovery tokens,
  and automated online SQLite backup schedules.

## 1.1 How to use this handbook

You do not have to read it from start to finish. Pick your goal:

| I want to … | Read |
|---|---|
| install Vitafolio on my Windows PC | Chapters 2 and 3, then 7 to 11 and 16 |
| run Vitafolio on my home server (Docker, Unraid, NAS) | Chapters 2 and 4, then 5 to 15 |
| build my master profile and curriculum vitae | Chapter 8 |
| write a cover letter according to DIN 5008 | Chapter 9 |
| track applications and archive dossier portfolios | Chapter 10 |
| use privacy-friendly AI assistance | Chapter 11 |
| protect my account (password, 2FA, sessions) | Chapter 12 |
| adjust appearance and interface language | Chapter 13 |
| manage accounts and activity logs as an administrator | Chapter 14 |
| back up or restore my data | Chapter 15 |
| troubleshoot problems or understand error messages | Chapter 17 |
| learn about data privacy and confidentiality | Chapter 18 |

Technical terms are explained where they first appear. At the end, Chapter 19 contains a glossary of key terms.

# 2 The two versions at a glance

Vitafolio comes in two forms. Both have the same interface. They differ in how you use them.

| | Windows program | Docker version |
|---|---|---|
| How do you use it? | Like any program: its own window | In a web browser, at an address |
| For whom? | one person at one PC | one or more people, at home or – with your own HTTPS – on the road |
| Sign-in? | no, your Windows account protects it | yes, with username and password |
| Two-factor, user management, log? | no | yes |
| Reachable from | this PC only | everybody who can reach the server and has an account |
| Data lives | in a folder on this PC | in the data folder of the container |

In short:

- **Docker** is a technique that lets a program run, together with everything it needs, in a closed package. The package
  is called a **container**. It runs the same on any computer.
- **Unraid** is an operating system for home servers. A **NAS** is a network storage device in your home network, for
  example from Synology. Containers run on both.
- The **browser** is the program you use to look at web pages, for example Edge, Chrome or Firefox.

> [!NOTE]
> There is no phone layout. Vitafolio is made for computer screens. The narrowest supported window width is 1024 pixels.

# 3 Installing the Windows program

## 3.1 Requirements

- A 64-bit Windows.
- The Windows program needs the "Microsoft Edge WebView2 Runtime". This is a building block from Microsoft that
  displays the program window. Windows 11 includes it, some Windows 10 PCs do not. If it is missing, Vitafolio tells you
  at start and offers the official download page (see Chapter 13).
- You need **no administrator rights**. Vitafolio is installed for your user account only.

## 3.2 Installing

1. Download the setup file `Vitafolio-win-Setup.exe` from the project's download page (the "Releases" area of the
   project on GitHub).
2. Start the file with a double-click.
3. Wait until the installation is finished.
4. Start Vitafolio from the Start menu or the Windows search.

<!-- Final pass: confirm the location and name of the setup file once a published version exists. -->

> [!NOTE]
> At the first start Windows may show a warning ("SmartScreen"). The reason: the program is not digitally signed yet. A
> signature is a confirmation that a publisher can buy from Microsoft. It is not a sign of a fault. If you trust the
> source of the file, let the program start despite the warning.

## 3.3 The first start

At start you first see a loading view with the text "Starting the local server …" (in German Windows: "Der lokale Server
wird gestartet …"). Then the app opens. You do not have to sign in. Continue with Chapter 7.

If Vitafolio is already running and you start it again, no second window opens. Instead the running window comes to the
front.

## 3.4 Updating and removing

The program does **not** look for new versions by itself. You install a new version with the new setup file.

You can uninstall Vitafolio like any program in the Windows settings under "Apps".

**Your data stays when you uninstall.** It is kept apart from the program in a folder of its own (see Chapter 12). If you
install Vitafolio again later, you find your data again. If you want to **get rid of the data completely**, delete this
folder after uninstalling: `%LOCALAPPDATA%\SushiFlux Develop\Vitafolio`.

> [!TIP]
> Before a reinstall or an uninstall, download a backup anyway and keep it **outside** the Vitafolio data folder (for
> example in "Documents"). How to do it is in Chapter 11.

# 4 Installing with Docker (Unraid, NAS, Linux server)

## 4.1 What you need

- A computer that runs Docker (Unraid, a NAS with container support, or a Linux server).
- A folder for the data on a **local drive** of that computer. Do not put it on a network share. Vitafolio's database is a
  single file, and file locks are not reliable over the network. On Unraid, a folder on the cache or in a pool is suitable,
  for example `/mnt/cache/appdata/vitafolio`.
- You do not need an account to start. You create the first account in the browser (Chapter 5).

## 4.2 With Docker Compose (Linux, NAS)

**Docker Compose** reads a small text file that says how the container should run.

1. Create a folder for Vitafolio on the computer, for example `vitafolio`.
2. In it, create a file `docker-compose.yml` with this content:

```
services:
  vitafolio:
    image: ghcr.io/sushifluxdevelop/vitafolio:latest
    container_name: vitafolio
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      PUID: "1000"
      PGID: "1000"
      TZ: "Europe/Berlin"
    volumes:
      - ./daten:/data
    stop_grace_period: 40s
```

3. Adjust `PUID` and `PGID` (see Section 4.5) and set `TZ` to your time zone.
4. Start the container in this folder with `docker compose up -d`.
5. In the browser, open `http://` and the address of the computer, then `:8080`. Example: `http://192.168.1.20:8080`.

<!-- Final pass: confirm the image name and the tag "latest" once the image is public. -->

The page for creating the first account appears. Continue with Chapter 5.

## 4.3 On Unraid

1. In Unraid, open the "Docker" page and create a new container.
2. Enter:
   - **Name:** `vitafolio`
   - **Repository:** `ghcr.io/sushifluxdevelop/vitafolio:latest`
   - **Port:** container port `8080`, as host port for example also `8080`
   - **Path:** container path `/data`, host path `/mnt/cache/appdata/vitafolio`
   - **Variables:** `PUID` = `99`, `PGID` = `100`, `TZ` = your time zone, for example `Europe/Berlin`
3. Confirm. Unraid downloads the package and starts the container.
4. In the browser, open `http://` and the address of your Unraid server, then `:8080`.

The values 99 and 100 are the numbers Unraid uses for the user "nobody" and the group "users". They are also the
default of Vitafolio. There is no ready-made template for the Unraid app store in this version.

## 4.4 The settings at a glance

You enter these settings as **environment variables**. These are named values that a container receives at start. You
only need the ones you want to change.

| Variable | Meaning | Default |
|---|---|---|
| `PUID`, `PGID` | number of the user and the group Vitafolio runs as and that own the data folder | 99 and 100 |
| `TZ` | your time zone. It decides the times of the backup schedule and the times in the log. | the container's time zone, usually UTC |
| `ALLOWED_HOSTS` | names under which Vitafolio may be reached (see 4.6) | empty: only IP addresses and `localhost` |
| `TRUSTED_PROXIES` | addresses of your reverse proxy (see 4.6) | empty |
| `BACKUP_DIR` | folder for the backups | `backups` inside the data folder |

Inside the container the data folder is always called `/data`. Mount your folder there, as in the examples above.

> [!TIP]
> Put the backups on a **different drive** than the data. To do so, set `BACKUP_DIR` to a path that you additionally mount
> into the container. A backup on the same drive does not help if the hard disk fails.

## 4.5 Data folder and permissions

Vitafolio never runs with administrator rights. The container starts briefly as administrator, hands the data folder to
the user from `PUID` and `PGID`, and from then on runs only as that user. The container does this by itself.

- On **Unraid** the default values 99 and 100 fit.
- On an **ordinary Linux computer** use your own user and group number. The command `id` shows them. Usually they are
  1000 and 1000.
- The number `0` is not allowed. Vitafolio then does not start and says so in the container's log.

## 4.6 Making it reachable: HTTPS and reverse proxy

**Never make Vitafolio reachable from the internet without HTTPS.** **HTTPS** is the encrypted form of the connection
between browser and server. You recognise it by the padlock in the address bar. Without encryption anybody on the network
can read along, including your password.

Vitafolio itself only speaks unencrypted (HTTP). Encryption is done by a service placed in front of it, a **reverse
proxy**. It accepts requests from the internet, encrypts them and passes them on to Vitafolio. Set up such a service if
you want to use Vitafolio from outside your home network.

Two settings make Vitafolio ready for this:

1. **`ALLOWED_HOSTS`**: Enter the name under which you open Vitafolio, for example `vitafolio.example.com`. Separate
   several names with commas. With `*.example.com` every sub-domain is allowed. Without this entry Vitafolio only answers
   IP addresses and `localhost`. This protects against a trick where a foreign web page addresses your server by its own
   name.
2. **`TRUSTED_PROXIES`**: Enter the address of your reverse proxy (or a network such as `172.18.0.0/16`). Vitafolio then
   takes the visitor's real address from the proxy, and the information that the connection was encrypted. Without this
   entry all visitors look like the proxy: the brake against password guessing then applies to all of them together, the
   log shows wrong addresses, and the sign-in cookies do not get the "HTTPS only" mark.

Also make sure that your reverse proxy **sets** the headers `X-Forwarded-Host` and `X-Forwarded-Proto` **itself** and
**overwrites** any values a visitor sends along. Otherwise the check of the name depends on what the visitor claims, and the
cookies do not get the "HTTPS only" mark. Most reverse proxies have a setting for this; read their manual.
<!-- Final pass: confirm the behaviour once the pentest changes are built. -->

A typo in these two settings stops the start with a message in the log, in German. That way it does not lock anybody out
unnoticed.

## 4.7 Starting, stopping, updating

- **Stop** the container always normally (do not kill it). At shutdown Vitafolio still makes a backup and needs up to
  40 seconds for it.
- **Updating:** Download the new package and restart the container (on Unraid via "Check for Updates" and "Update" in
  the Docker area). At start the database adapts itself to the new version. Download a backup first (Chapter 11).
- Start **only one container per data folder**.
- Going back to an **older** version is not simply possible: the app does not accept a backup from a newer version.
- Docker shows you whether Vitafolio is "healthy". To find out, it asks the status page every 30 seconds.

# 5 The first start: creating the first account

This chapter applies to the Docker version. The Windows program does not have this step.

At the very first visit Vitafolio wants to know who the manager is. The account you create now automatically becomes
**administrator**. An administrator manages accounts and the settings of the app.

1. Open the address of Vitafolio in the browser (see Chapter 4).
2. You see the page "Welcome to Vitafolio" (see Figure 1).
3. Read the **setup code** from the container's log. It is shown there at every start as long as there is no account yet.
   On Unraid, open the menu of the container "Vitafolio" in the Docker area and choose "Logs". With Docker Compose,
   `docker compose logs vitafolio` shows the log.
4. Enter the setup code in the field **Setup code**.
5. Enter a **username**. It has 3 to 32 characters: letters, digits, dot, underscore or hyphen. Example: `mira`.
6. Enter your **display name**, the way it should appear in the app. It has 1 to 64 characters.
7. Enter a **password** with at least 12 and at most 128 characters. There are no further rules. A long sentence is
   better than a short word with special characters.
8. Enter the password once more under "Repeat password".
9. Click **Create account**.

<!-- Final pass: confirm steps 3 and 4 (setup code) once the server's setup asks for the code; check the field name and texts. -->

You are signed in right away and see the main window (Chapter 7).

![Creating the first account](bilder/setup.png)

Vitafolio checks your input while you type. A problem appears right below the field, for example "Too short: 5 of at
least 12 characters." The button does not send anything as long as something is marked red.

> [!NOTE]
> The setup code protects you from a stranger who happens to reach the page before you creating the first account and
> thereby becoming administrator: only somebody who can read the server's log knows the code. The setup works only once.
> Still, finish it **before** you make Vitafolio reachable for others.

> [!NOTE]
> Write the administrator's password down in a safe place, for example in a password manager. If you ever forget the password
> of the only administrator, you can reset it via the emergency reset using a one-time code from the server logs (see Chapter 13).

# 6 Signing in and out

This chapter applies to the Docker version.

## 6.1 Signing in

1. Open the address of Vitafolio in the browser. If you are not signed in, you see the sign-in page (see Figure 2). The
   form is on the left, the features of the app are on the right.
2. Enter your **username** and your **password**.
3. Click **Sign in**.

If two-factor sign-in is switched on for your account, a second step follows (Section 6.2).

![Signing in with username and password](bilder/anmeldung.png)

At the bottom left of the sign-in page you choose the language: **Deutsch** or **English**.

## 6.2 The second step: the code

**Two-factor sign-in** asks for a second proof in addition to the password. You set it up in Chapter 8. The second proof
is a six-digit code from an **authenticator app** on your phone. It changes every 30 seconds.

1. After the password you see the page "Second step" (see Figure 3).
2. Open your authenticator app and read the current code.
3. Enter it in the field **Code**.
4. Click **Confirm**.

If you do not have the phone at hand, enter a **recovery code** instead (Section 8.3). Each one works only once.

You have **5 minutes and 5 attempts** for the code. After that you start again with username and password. "Back to
sign-in" takes you there sooner.

![Second step of the sign-in: the code](bilder/anmeldung-code.png)

## 6.3 Registering

Normally the sign-in page offers no way to create an account yourself. The administrator creates accounts (Chapter 10).
If the administrator switches registration on, "No account yet?" appears below the form with the link **Register**. There
you enter username, display name and password, as in Chapter 5. New accounts are ordinary users, not administrators.

## 6.4 Signing out

Click **Sign out** at the bottom left of the sidebar.

## 6.5 How long do I stay signed in?

As long as you use Vitafolio, you stay signed in. Vitafolio renews your sign-in in the background without you noticing.
Whoever does not visit for 30 days has to sign in again. You are also signed out when an administrator disables your
account or sets a new password for you, when you change your password (on all other devices), or when a backup is
restored.

# 7 The Main Window and Navigation

After signing in (or right after launching the Windows desktop application) you see the main window (see Figure 4).

![The main window of Vitafolio](bilder/hauptfenster.png)

On the left is the **sidebar**, serving as your central navigation hub:

1. **The Navigation:**
   - **Overview:** Your personal dashboard with quick stats, account status, and backup indicators.
   - **Master Profile:** Your central resume profile with all building blocks, portrait photos, signatures, live preview, and export tools (Chapter 8).
   - **Cover Letters:** Management of individual DIN 5008 cover letters with dedicated editor and live preview (Chapter 9).
   - **Applications:** The interactive application tracker featuring a Kanban board, chronological timeline, and compiled dossier portfolios (Chapter 10).
   - **App Administration:** (administrators of the Docker/server version only) Manage user accounts, activity audit logs, and system settings (Chapter 14).
2. **Your User Area:**
   - Displays your display name and role (in the Windows program, "Local Account").
   - Clicking your user card opens **Settings** (security, backups) and **AI Settings** (Chapter 11).
3. **The Theme Switcher:** Fast toggle between "System", "Light", and "Dark" modes (Chapter 13).
4. **The Footer:** Displays the "Made with ♥" brand seal and the exact version number of the running instance. In the Docker version, the sign-out button is located here.

On the right is your primary workspace displaying the selected page.

# 8 Master Profile & Curriculum Vitae

The **Master Profile** is the foundational core of your job applications in Vitafolio. You enter your personal data, career history, education, and credentials once completely. From this single source of truth, Vitafolio generates beautifully formatted, publication-ready CVs in milliseconds.

## 8.1 Resume Building Blocks

Using the organized tabs in the Master Profile, fill in your background details:

- **Personal Information:**
  - Full name, academic titles, email, phone number, address (street, postal code, city, country), date and place of birth, and nationality.
  - **Executive Summary / Elevator Pitch:** A concise 2–4 line summary highlighting your unique value proposition, strengths, and career direction (can be generated with AI assistance).
- **Work Experience:**
  - Job title / role, employer / company, location, employment period (month/year from–to or "present").
  - Accomplishment bullets: Frame your tasks and achievements using action verbs and measurable metrics (e.g. the STAR/XYZ method).
- **Education & Training:**
  - Degree / qualification (Bachelor, Master, Apprenticeship, Secondary School), institution / university, location, period, graduation grade, and study focus areas.
- **Skills & Competencies:**
  - Technical skills, soft skills, or tool competencies with customizable proficiency levels (e.g. Beginner, Intermediate, Advanced, Expert).
- **Languages:**
  - Language and proficiency rating according to the Common European Framework of Reference (CEFR A1 through C2) or native speaker.
- **Certifications & Licenses:**
  - Certificate title, issuing organization, issue date, and optional expiration date.
- **Interests & Volunteering:**
  - Hobbies, community volunteering, and personal pursuits that round out your profile.
- **Custom Sections:**
  - Add arbitrary custom sections with custom headings (e.g. "Publications", "Key Projects", "Patents", or "Awards").

## 8.2 Profile Photo and Handwritten Signature

Vitafolio seamlessly incorporates portrait imagery and vector signatures into your documents:

1. **Uploading a Portrait Photo:**
   - Upload a headshot photo (JPG, PNG, or WebP) directly in the Master Profile.
   - Toggle visibility and choose from three crop styles:
     - **Rectangle:** Classic portrait format with a subtle shadow.
     - **Rounded:** Contemporary soft rounded corners.
     - **Circle:** Modern circular headshot crop.
2. **Handwritten Signature:**
   - Upload a scan or photo of your handwritten signature (ideally with a white or transparent background).
   - Vitafolio places your signature beneath the curriculum vitae and at the close of your cover letters.

## 8.3 Typographic Designs and Accent Colours

Vitafolio does not rely on fragile HTML-to-PDF converters. Instead, it embeds the cutting-edge **Typst** typesetting engine natively in-memory on the server, generating crisp, publication-grade vector PDFs in under 600 ms.

Under **Design & Layout**, customize your visual styling:

- **Templates:**
  - **Classic:** Proven single-column layout with clear divider rules. Ideal for traditional industries, administration, finance, and legal roles.
  - **Modern:** Elegant two-column layout featuring an accent-tinted sidebar for contact details, languages, and competencies. Perfect for tech, marketing, media, and creative professions.
  - **Plain:** Clean, minimalist Swiss typography with generous white space and understated sophistication.
- **8 Curated Accent Colours:**
  - Navy Blue, Slate Grey, Emerald Green, Burgundy Red, Teal, Purple, Amber, and Graphite.
- **Font Families:**
  - Four typographic pairings: *Outfit* (contemporary, confident), *Inter* (neutral, ultra-readable), *Playfair Display* (editorial serif), and *Source Sans*.
- **Document Language:**
  - Switch between **German** and **English**. Section headings ("Berufserfahrung" vs. "Work Experience", "Ausbildung" vs. "Education", etc.) are translated automatically.

## 8.4 Live Preview and Export (PDF & Word)

An interactive **Live Preview** renders right next to your form fields:

- With every modification, Typst produces an updated print-ready PDF in real time.
- Zoom, pan, inspect page breaks, and evaluate layout density directly in your browser.
- **Download PDF:** Exports the final vector PDF (PDF/A compliant, searchable, accessible).
- **Download Word (.docx):** Generates a clean Microsoft Word file via the native Open XML SDK. Invaluable when recruiters or applicant tracking systems (ATS) specifically require an editable document.

## 8.5 JSON Resume Import & Export (Schema v1.0.0)

Vitafolio supports the open industry standard **JSON Resume** (schema v1.0.0), widely used by developers and modern recruitment tooling:

- **1-Click Export:** Download your entire profile data as a structured `resume.json` via the **JSON Resume** button in the profile header. You retain full ownership of your data without vendor lock-in.
- **Flexible Import:** Upload an existing `resume.json`. Vitafolio offers two distinct modes:
  - **Merge:** Existing stations and skills are preserved; new records from the JSON file are seamlessly added.
  - **Replace:** The master profile is cleanly replaced with the imported JSON content (ideal when migrating from another platform).
- **Comprehensive Field Mapping:** Master basics, work experience, education, certificates, skills, languages, interests, and custom sections are mapped bi-directionally.

## 8.6 Career Gap Analyzer

Recruiters pay close attention to chronological continuity in CVs. Vitafolio includes a built-in, non-judgmental **Gap Analyzer**:

- **Automated Detection:** The system chronologically scans your work experience and education for gaps greater than 30 to 45 days.
- **Supportive Guidance:** Instead of harsh error messages, Vitafolio offers friendly recommendations on how to constructively frame sabbatical, career transition, parental leave, or further education periods.
- **1-Click Quick Actions:** Buttons like **"+ Career transition"** or **"+ Further training"** create a new station pre-filled with the exact gap dates.

## 8.7 Guided Profile Wizard

For users building their first CV or those who prefer step-by-step guidance, switch to **Wizard Mode** with one click:

- **5 Guided Steps:**
  1. *Personal Details:* Contact information, photo, and elevator pitch.
  2. *Experience:* Career history, roles, and STAR-based accomplishments.
  3. *Education:* Degrees, universities, and specializations.
  4. *Skills & Languages:* Professional competencies and proficiency levels.
  5. *Preview & Finish:* Design templates, fine-tuning, and export.
- **Seamless Toggling:** Switch freely between the classic tabbed view and the wizard mode at any time without losing any input.

# 9 Cover Letters according to DIN 5008

Under **Cover Letters**, craft and manage tailored application letters. Vitafolio adheres strictly to the German business standard **DIN 5008 (Form B)**.

## 9.1 Standardized Structure (Form B)

The letter layout precisely matches standard window envelopes (C4 and C5):

- **Sender Return Line:** Single-line sender address (Name, Street, Postal Code City) positioned directly in the address window envelope header.
- **Recipient Address Field:** 45 mm standardized address window block (Form B) accommodating company name, contact person, street/P.O. box, postal code, and city.
- **Fold and Punch Marks:** Discreet marks along the left margin (two fold marks for three-fold envelopes and one center punch mark) ensuring precise folding and binder archiving.
- **Date and City:** Right-aligned header positioning.
- **Subject Line:** Prominent bold subject line (e.g. *"Application for Senior Software Engineer – Ref. 2026-X"*), positioned two lines above the salutation.
- **Personal Salutation:** Customized greeting (e.g. *"Dear Dr. Schneider,"*).
- **Structured Letter Body:** Introduction, experience and key qualifications, company connection and motivation, salary expectations / notice period, and polite sign-off.
- **Handwritten Signature:** Automatic inclusion of your signature from the Master Profile.
- **Enclosure Notation:** Standardized attachment note at the bottom (e.g. *"Enclosures: Curriculum Vitae, Diplomas"*).

## 9.2 Managing and Exporting Cover Letters

- Create distinct cover letters for each target company and opportunity.
- Utilize the rich text editor with instant markdown and formatting controls.
- Export individual letters as standalone **PDF** or **Word (.docx)** files.
- Link cover letters directly into the Application Tracker to produce full candidate dossiers.

# 10 Application Tracker & Dossier Portfolios

Under **Applications**, oversee your entire job hunt. Vitafolio unites workflow tracking with immutable document snapshotting.

## 10.1 Creating a New Application

Click **New Application** and enter the role details:
- **Position & Company:** Job title, organization name, work location.
- **Terms:** Desired salary, target starting date.
- **Contacts:** Primary contact person, email address, phone number.
- **Job Posting:** Paste the full job description and URL (used by the AI fit check).
- **Portfolio Composition:** Link a specific cover letter and choose whether to prepend a formal cover sheet.

## 10.2 Kanban Board and Table Views

Toggle effortlessly between two viewing modes:

1. **Kanban Board:**
   - Six lifecycle columns track your progression:
     1. **Draft:** Application in preparation.
     2. **Applied:** Materials submitted to the company.
     3. **Acknowledged:** Confirmation of receipt received.
     4. **Interview:** Phone screen, technical interview, or on-site rounds.
     5. **Offer:** Contract or written offer extended.
     6. **Closed:** Offer accepted, rejected, or application withdrawn.
2. **List and Table View:**
   - High-density view with status filters, sorting, and full-text search across job titles and organizations.

## 10.3 Chronological Timeline

Open any application to inspect its **History (Timeline)** tab:
- Status changes are logged automatically with date stamps.
- Record custom milestones and interactions (e.g. *"Follow-up phone call with hiring manager"*, salary negotiation notes, feedback).

## 10.4 Automated Follow-Up Alarm

Job seekers often wait weeks for replies. Vitafolio ensures you never miss the right moment to follow up:
- If 14 days elapse after submission while in *Applied* or *Acknowledged* status, Vitafolio highlights the application with a distinct orange **Follow-up Due banner**.
- You can also set a custom follow-up deadline date for any application.
- One click on the alert banner filters the dashboard to show all pending follow-ups.

## 10.5 Combined Dossier & Immutable Archiving

Vitafolio bundles all components into a cohesive, single PDF portfolio:
1. **Cover Sheet:** Prominent display of your name, target position, portrait photo, contact coordinates, and table of contents.
2. **DIN 5008 Cover Letter:** Tailored to the organization.
3. **Curriculum Vitae:** Formatted with harmonious fonts and accent colours.

> [!IMPORTANT]
> **Immutable Snapshot Archiving:** The moment you transition an application status to **"Applied"**, Vitafolio captures an immutable PDF snapshot and permanently stores it in the data directory.
> When you subsequently modify your master profile for other opportunities, historical dossiers remain permanently intact. Before stepping into an interview, one click retrieves the exact document the hiring committee received.

## 10.6 Document Attachments & Credentials (Dossier Annex)

A complete application package typically requires supporting documentation, including reference letters, university certificates, and work samples:

- **Centralized Attachment Repository:** Open **Manage Attachments** on the applications screen to upload documents (supports PDF and high-resolution image formats such as PNG, JPEG, and WebP up to 20 MB per file).
- **Categorization & Labeling:** Assign clear titles and categories (e.g. *Work Certificate*, *Degree Certificate*, *Training*, *Other*).
- **Per-Application Selection:** In each application, simply check the boxes for the specific credentials required for that position.
- **Embedded Dossier Inclusion:** When generating the application dossier, image credentials (PNG, JPEG, WebP) are rendered onto dedicated high-resolution pages via Typst, while PDF attachments are catalogued in the structured dossier index.

# 11 Privacy-First AI Assistance

Vitafolio offers an intelligent pair-writing assistant to refine phrasing, analyze job specifications, and polish bullet points. AI usage is **100% voluntary** – the application remains completely functional without connecting to any AI service.

## 11.1 Three Flexible Integration Modes

Choose the workflow that fits your privacy preferences and budget:

| Mode | How it works | Requirements & Cost |
|---|---|---|
| **Copy & Paste (Default)** | Vitafolio prepares a fully structured, task-specific prompt with a strict JSON schema. Copy it with one click into your favorite chatbot (ChatGPT, Claude.ai, Gemini, Perplexity) and paste the response back. | **100% free**, zero API key required, works with any free or subscription account. |
| **Custom Cloud API Key** | Connect directly to **OpenAI** (e.g. GPT-4o), **Anthropic Claude** (Claude 3.5 Sonnet), or **Google Gemini** (Gemini 2.5 Flash/Pro). Requests are processed in the background and results populate in one click. | Requires your own provider API key; billed directly by the provider per token (typically fractions of a cent). |
| **Local Offline Models (Ollama)** | Connect to a local instance of **Ollama** or **LM Studio** running on your computer or home server. | Free, requires sufficient hardware; **zero bytes ever leave your private local network**. |

Under **AI Settings** (accessible via the user menu), configure your preferred provider, model identifier, and test the connection with a live health check.

## 11.2 Zero-Trust Candidate Privacy & Pseudonymization

Candidate CVs contain sensitive Personally Identifiable Information (PII). Vitafolio protects your privacy with strict **Zero-Trust Tokenization**:

1. Before any prompt is sent to an external LLM (or copied to clipboard), Vitafolio tokenizes personal identity data:
   - Name → `[BEWERBER_NAME]`
   - Email → `[BEWERBER_EMAIL]`
   - Phone → `[BEWERBER_TELEFON]`
   - Address → `[BEWERBER_ANSCHRIFT]`
   - Date of Birth → `[BEWERBER_GEBURTSDATUM]`
   - City → `[BEWERBER_ORT]`
2. The AI model operates exclusively on your career milestones and competencies, never learning your true identity or contact channels.
3. Upon parsing the AI response, Vitafolio automatically de-pseudonymizes the content in server memory.
4. **Key Encryption:** Cloud API keys are stored encrypted using ASP.NET Core Data Protection (`Cv.Server.AiApiKey.v1`). The web client never receives the decrypted key.

## 11.3 Five Specialized AI Tasks

Launch the AI Assistant modal via the magic wand button for five tailored tasks:

1. **Draft Cover Letter (`generate_cover_letter`):**
   - Synthesizes job posting requirements with your profile background to draft a compelling DIN 5008 letter.
2. **Analyze Job Posting (`analyze_job`):**
   - Evaluates requirements, calculates a fit percentage score, highlights qualification gaps, and suggests interview preparation pointers.
3. **Executive Summary (`generate_summary`):**
   - Distills your career accomplishments into a persuasive elevator pitch for your CV or cover sheet.
4. **Improve Achievement Bullets (`improve_bullet`):**
   - Reframes responsibilities using the proven **STAR/XYZ formula** (*"Accomplished [X], measured by [Y], by doing [Z]"*).
5. **Bilingual Translation (`translate_content`):**
   - Translates resume sections or cover letters between German and English while maintaining professional industry terminology.

## 11.4 Fault-Tolerant Preview and 1-Click Apply

- The built-in JSON parser extracts structured outputs reliably, even if the model encloses text in markdown fences or prepends conversational greetings.
- Review results in a structured preview and apply either the full suggestion or individual fields selectively.

## 11.5 Shared Server Key for Administrators

In multi-user deployments (e.g. Unraid Docker or shared family/office setups), administrators can configure a shared default AI provider:

- **Simplified Provisioning:** Under **Settings → Administration**, administrators specify the default provider (e.g. OpenAI or Claude), model identifier, and server-wide API key.
- **Secure DPAPI Protection:** Keys are encrypted at rest via ASP.NET Core Data Protection and never exposed in plaintext to the user interface.
- **Automatic Fallback:** If an individual user has not configured their own API credentials in their personal profile, Vitafolio automatically utilizes the shared server configuration. When a user does provide their own personal key, it always overrides the shared server configuration.

# 12 Protecting your account

This chapter applies to the Docker version. The Windows program has no account that would need protecting.

For this, open **Settings** in the sidebar and then the tab **Security**. It has three areas: "Change password",
"Two-factor sign-in" and "Signed-in devices".

## 12.1 Changing the password

1. Under **Current password**, enter your present password.
2. Under **New password**, enter the new password (at least 12 characters).
3. Enter it once more under **Repeat new password**.
4. Click **Change password**.

You see the message "The password was changed." You stay signed in on this device. On all other devices you are signed
out.

## 12.2 Switching on two-factor sign-in

For this you need an **authenticator app** on your phone. This is an app that creates a new six-digit code every 30
seconds. Install it before you begin.

1. Under "Two-factor sign-in", click **Start setup**.
2. A **QR code** appears (see Figure 5). This is a square of black and white dots that the app reads with the phone
   camera.
3. Scan the QR code with your authenticator app. If that does not work, type the **Key to type in** below the picture
   into the app by hand. The "Copy" button next to it helps.
4. The app now shows a six-digit code. Enter it in the field **Code from the app**.
5. Click **Turn on**.

![Setting up two-factor sign-in: QR code and code](bilder/zwei-faktor-einrichten.png)

After that Vitafolio shows **ten recovery codes** (see Figure 6). These are emergency codes in case you lose your phone.

1. Click **Copy** and paste the codes into your password manager, or write them down.
2. Keep them safe, **apart from the phone**.
3. Click **Done, codes saved**.

![The ten recovery codes](bilder/wiederherstellungscodes.png)

> [!WARNING]
> The recovery codes are shown **this one time only**. Each code works only once.

From now on Vitafolio asks for the code at every sign-in (Section 6.2).

## 12.3 Signing in with a recovery code

If you do not have the phone with you, enter a recovery code in the second step instead of the code. It looks like this:
`abcde-fghij`. Hyphen, spaces and upper or lower case do not matter. The code is used up afterwards. The remaining codes
stay valid.

## 12.4 Switching off two-factor sign-in

1. In the area "Two-factor sign-in", enter your **Current password**.
2. Enter a **Code or recovery code**.
3. Click **Turn off two-factor**.

If the administrator requires two-factor sign-in for everybody (Section 14.5), you cannot switch it off.

## 12.5 Viewing and ending signed-in devices

Under "Signed-in devices" you find every sign-in of your account (see Figure 7): the device (for example "Chrome ·
Windows"), the IP address, since when you are signed in there and when it was last used. Your present device carries the
mark "This device".

Do you not recognise a sign-in? End it:

1. In its row, click **End**.
2. Confirm the question "End session?" with **End**.

The device is signed out at once. Then change your password.

![Signed-in devices](bilder/geraete.png)

# 13 Look and language

Open **Settings** and the tab **Appearance** (see Figure 8).

- **Colour scheme:** "System" follows the setting of your computer, "Light" and "Dark" are fixed. You also find the switch
  at the bottom of the sidebar.
- **Language:** "Deutsch" or "English".

Both apply at once. In the Docker version your choice is also saved in your account and then applies on every device.

![Choosing colour scheme and language](bilder/darstellung.png)

The messages of the Windows program itself (for example at start) follow the language of your Windows, not this setting.

# 14 App administration

This chapter applies to **administrators** of the Docker version. The app administration holds everything that concerns
the whole app for everybody. Your personal settings are kept apart from it under "Settings". You find the app
administration in the sidebar. It has four tabs: "Users", "Settings", "Activity log" and "Backups" (Chapter 15).

An administrator manages accounts and the app. They see **no application data** of other people.

## 14.1 Users

The tab "Users" shows all accounts (see Figure 9) with name, role ("Administrator" or "User"), status ("Active" or
"Disabled"), two-factor ("On" or "Off") and the last sign-in.

At the end of each row are four symbols. They show their name when you point at them. The numbers in the figure belong to these points:

1. **Edit**: change display name, role and "Account active".
2. **Set a new password**: assign a new password for this person.
3. **Reset two-factor**: switch off this person's two-factor sign-in (selectable only when it is on).
4. **Delete**: remove the account.

![Managing users](bilder/benutzer.png)

## 14.2 Adding a new user

1. Click **Add user**.
2. Enter username, display name and password, as in Chapter 5 (see Figure 10).
3. Choose the **role**: "User" works with their own data. "Administrator" manages accounts and the app.
4. Click **Add**.
5. Pass the password on to the person in a safe way. They can change it themselves afterwards (Section 12.1).

![Adding a new user](bilder/benutzer-anlegen.png)

## 14.3 Changing, disabling and deleting accounts

- **Disabling:** Open "Edit" and switch "Account active" off. A disabled account can no longer sign in and is signed out
  everywhere at once.
- **Setting a new password:** You never see the old password. Here too, all devices of the person are signed out.
- **Resetting two-factor:** This helps when somebody has lost the phone and the recovery codes. The person can set up
  two-factor sign-in again afterwards.
- **Deleting:** The account is deleted with all its data. This cannot be undone.

Two protective rules keep anybody from locking themselves out:

- The **last active administrator** cannot be deleted, disabled or demoted to user.
- Nobody can disable or delete their **own account** or take away their own administrator role.

## 14.4 Same names

A username is unique. Upper and lower case do not matter: "Mira" and "mira" are the same name.

## 14.5 Settings: registration and two-factor for everybody

The tab "Settings" has the area "Access" with two switches (see Figure 11). Every change applies to the whole app at once
and saves itself. A green switch with "On" is on, a red one with "Off" is off.

- **Registration open:** If it is on, everybody who reaches the page can create an account. Normally it stays **off**.
  The administrator then creates accounts.
- **Require two-factor for everybody:** If it is on, everybody has to set up two-factor sign-in. Whoever does not have it
  yet is guided through the setup at the next sign-in and cannot do anything else before. For safety Vitafolio asks again
  ("Require two-factor for everybody?") before you switch it on.

![Registration and two-factor for everybody](bilder/admin-einstellungen.png)

## 14.6 The activity log

The activity log records **who did what and when** (see Figure 12). It includes sign-ins and failed sign-ins, sign-outs,
changes to accounts and settings, two-factor sign-in, and everything around backups (the automatic ones too). Nobody can change or delete
entries.

Each entry has the time (in your local time), who did it, the action, whom or what it concerns, the IP address and, if you
like, details (button "Show").

- With the selection fields **Action** and **User** you narrow the list down.
- The list shows 25 entries per page, newest first. Use the arrows to page through.

![The activity log](bilder/aktivitaetsprotokoll.png)

> [!TIP]
> Many "Sign-in failed" entries in a short time, also for an account that does not exist, point to somebody trying out
> passwords. Vitafolio slows this down automatically (Chapter 17). Check whether your server needs to be reachable from
> the internet.

# 15 Backups

A **backup** is a copy of your data. With it you get your data back if something goes wrong.

You find the backups:

- in the **Docker version** in the app administration (administrators only), tab "Backups",
- in the **Windows program** under "Settings", tab "Backups".

The page has three parts: "Back up automatically", "The next 7 days" and "Backups".

## 15.1 Backing up automatically

Here you decide when Vitafolio backs up on its own (see Figure 13). The numbers in the figure belong to the points of the list below it.

![Back up automatically: the schedule](bilder/zeitplan.png)

1. **Automatic backup** (master switch): Switches **all** automatic backups on or off. Switch it off if you already have
   your own backup system, for example the appdata backup of your NAS. Backing up, downloading and restoring by button
   always work.
2. **At start** and **Before shutdown:** A backup as soon as Vitafolio starts, and a last one before it shuts down. Both
   are on by default.
3. **Schedule:** Choose a kind:
   - **Off:** only at start and at shutdown.
   - **Every … hours:** every 1 to 168 hours. Counting starts at midnight of a Monday. With 6 hours that makes 0, 6, 12
     and 18 o'clock. This is the default.
   - **At fixed times:** Choose the **weekdays** (Mon to Sun) and up to 12 **times**. "Add time" adds a row, the
     wastebasket symbol removes one.
4. **Catch up missed backups:** If Vitafolio was not running at the planned time, the backup is made at the next start.
   This is especially useful in the Windows program: it can only back up while it is open.
5. **Retention:** Here you decide how many backups stay:
   - **Keep the latest backups:** the newest 5 to 500 (default 20).
   - **Keep one per day (days):** the first backup of each day, for that many days, 0 to 3650 (default 60; 0 = none).

Then click **Save**. "Discard" takes your changes back.

What you should know:

- A backup is **kept only if something has changed since the last one**. That way an empty database after a data loss
  does not push out the good, old backups. Sign-ins and sessions do not count as a change, only real content. Automatic
  backups appear in the activity log, even when they were skipped ("no change") or failed.
- Every backup is checked after it is made. A faulty one is discarded.
- The schedule uses the time zone of the computer Vitafolio runs on (in the container the setting `TZ`).

## 15.2 The week preview

The area "The next 7 days" shows when backups will be made next week (see Figure 14). Each row is a day, each bar a planned
backup, with the exact times beside it. The preview changes live while you edit the schedule. As long as you have not
saved, it says "Preview, not saved".

Below it you find the time zone and the backup folder.

![The week preview](bilder/vorschau.png)

## 15.3 Viewing, making, downloading, uploading backups

The area "Backups" shows all backups, newest first (see Figure 15). Each has a time, a **kind** and a size. The kinds are:

| Kind | Meaning |
|---|---|
| At start | made automatically at start |
| Before shutdown | made automatically at shutdown |
| Scheduled | made automatically after your schedule |
| Manual | made with the button "Back up now" |
| Before restore | the safety copy Vitafolio makes before every restore |
| Uploaded | uploaded by you |

Above are three buttons (numbered in the figure):

1. **Back up now:** makes a backup at once. If nothing has changed since the last one, Vitafolio says so in a friendly way
   and does not make a new one.
2. **Download current state:** first makes a fresh backup and then downloads it as a file.
3. **Upload backup:** accepts a backup file from your computer (up to 512 MB).

Each row has **Download** and **Restore**.

![Backups: list and buttons](bilder/sicherungen.png)

**Downloading:** The file is called, for example, `vitafolio-backup-2026-11-04-0200.db`. It contains the data of **all
accounts**, including the protected passwords. Keep it safe. In the Docker version Vitafolio therefore first asks for your
**current password** (and the two-factor code if it is on for you).

**Uploading:** Vitafolio checks the file: it has to be an undamaged backup of **this app**, and it must not come from a
newer version. Here too the Docker version asks for password and code. Afterwards it appears as "Uploaded" in the list.
Nothing is restored until you trigger that there. Uploaded backups are **never deleted automatically**.

## 15.4 Restoring a backup

When restoring, you replace the present data with the state of a backup.

1. In the row of the backup you want, click **Restore**.
2. Read what happens (see Figure 16).
3. In the Docker version, enter your current password (and the code if needed).
4. Click **Restore**.

![Restoring a backup](bilder/wiederherstellen.png)

This is what happens:

- The **present state is saved as a backup first** ("Before restore"). So you can get it back.
- Everything created after the backup is no longer in the running app afterwards.
- In the Docker version **everybody is signed out** and has to sign in again. You land on the sign-in page. In the Windows
  program the window reloads.
- The settings of the backups themselves also come from the backup.

For a short time Vitafolio answers "The app is being maintained right now". Wait a moment.

If the restore fails, the previous state is written back automatically. You then see the message "The restore failed. The
running app was not changed; the previous state is saved as the backup “Before restore”. Details are in the server’s log."

## 15.5 Moving to another computer

A backup file contains your data, but **not the secret keys** in the subfolder `keys` of the data folder. This concerns the
two-factor sign-in and encrypted AI credentials of the Docker version.

- If you restore the backup into a **new, empty data folder** without taking the `keys` folder along, Vitafolio can no
  longer check the codes from the authenticator app. You then see the message "The key of the two-factor sign-in cannot be
  read. Have the administrator reset it and set it up again."
- The **recovery codes** keep working, and an administrator can reset the two-factor sign-in of an account (Section 14.3).
- The easiest way is to take the whole data folder along when moving.

For a restore into the same data folder on the same computer this does not matter.

## 15.6 Where are the backups?

In the **backup folder** that you see in Figure 14. It has subfolders: `recent` (the newest backups), `daily` (one per day)
and `uploaded` (uploaded ones). The files are called, for example, `app-20261104-020000-scheduled.db` (date, time, kind).

When tidying up, Vitafolio deletes only files with this name pattern. It leaves everything else in the folder alone. Note:
the `recent` folder counts all kinds alike. The safety copy "Before restore" is also tidied up at some point when many newer
backups are added. If you want to keep a backup for good, download it.

# 16 The Windows program in daily use

The Windows program differs from the Docker version in these points:

- **No sign-in.** Your Windows account protects your data. Whoever sits at your Windows account can open Vitafolio. The
  sidebar says "Local account". As the display name Vitafolio uses your Windows user name.
- **No sign-out, no users, no log, no two-factor sign-in.** There is no app administration either.
- **The settings** have two tabs: "Appearance" and "Backups".
- **The backups** work as in Chapter 15, but **without a password prompt**. They run only while the program is open.
  What was missed is caught up at the next start, unless you switched that off.
- **Closing:** When you close the window you briefly see "Closing – the backup is running …". Wait until the window
  disappears. One more backup is made then. If Windows shuts down while Vitafolio is open, the program waits only briefly
  (at most 5 seconds) for this last backup.
- **Your PC only:** The program is not reachable from any other device on the network. Other programs on your PC cannot
  access your data.
- **Links:** A link to another web page opens in the default browser, not in the program window.
- **Smallest window size:** 1024 × 700. The program remembers the size and position of the window.

**Where is your data?** In a folder on your PC:

`%LOCALAPPDATA%\SushiFlux Develop\Vitafolio`

This folder is kept **apart from the program**. That is why your data stays when you uninstall and when you reinstall.

You open the folder like this:

1. Press the Windows key and the R key at the same time.
2. Enter `%LOCALAPPDATA%\SushiFlux Develop\Vitafolio` and press Enter.

The folder holds the database, the secret keys (`keys`), the backups (`backups`), generated dossiers, and program logs.
Do not delete or change anything there by hand as long as you want to keep the data. Do not copy the folder while the
program is running. Download a backup in the app instead (Chapter 15). If you want to **delete all data for good**,
close Vitafolio and delete this folder.

# 17 Solving problems

## 17.1 Copying error messages

Vitafolio shows error messages **in full** and in understandable words (see Figure 17). Every message has a **Copy**
button. It copies the whole message with the technical details, the error code, the program version and the time. Paste
the text into your message when you look for help. With "Details" you open the technical details.

![An error message with a Copy button](bilder/fehlermeldung.png)

## 17.2 Common problems

| What you see | Cause | What to do |
|---|---|---|
| Instead of the app, the browser shows a short text message in English: "This server is not reachable under this host name. The operator can allow it with the setting ALLOWED_HOSTS." | You open Vitafolio under a name that is not in `ALLOWED_HOSTS`. | Enter the name in `ALLOWED_HOSTS` (Section 4.6) and restart the container. With the server's IP address it always works. The log contains the line "Anfrage mit nicht erlaubtem Hostnamen … abgewiesen" (in German). |
| "Username or password is wrong." | Wrong input. Vitafolio deliberately does not reveal which. | Check both. Mind the keyboard layout and the caps lock key. |
| "Too many attempts. Please try again in … seconds." | Too many sign-ins or codes in a short time from the same address. This is a protective brake. Default: 10 sign-ins per minute. | Wait the stated time. Behind a reverse proxy: check `TRUSTED_PROXIES` (Section 4.6), otherwise all visitors count together. |
| "This account is disabled. Contact the administrator." | An administrator disabled the account. | Ask an administrator to enable it again (Section 14.3). |
| "The code is wrong or was already used." | Wrong code, or an old code. | Check the time on your phone: it has to be right. Enter the current code. Or use a recovery code. |
| "This code was already used. Wait for the next code of the app or use a recovery code." | The code was right, but you had just used it. Each code works only once. | Wait up to 30 seconds for the next code of the app, or use a recovery code. |
| "The key of the two-factor sign-in cannot be read. …" | The backup was restored into a new data folder without the `keys` folder (Section 15.5). | Sign in with a recovery code, or have an administrator reset the two-factor sign-in. |
| "The sign-in has expired. Please start again with username and password." | The second step took longer than 5 minutes or had more than 5 attempts. | Sign in again. |
| Phone and recovery codes lost | – | Ask an administrator to reset your two-factor sign-in (Section 14.3). As the sole administrator, use the emergency reset, which also disables 2FA. |
| Forgotten password | – | Another administrator sets a new password for you (Section 14.3). For the **only** administrator, use the link "Forgot password? (Administrator emergency reset)" on the sign-in page: it prints a one-time code to the server logs (Docker/Unraid logs) that lets you set a new password. |
| "Registration is closed. Ask the administrator for an account." | Registration is off. | Have an account created for you. |
| "Two-factor sign-in has to be set up first." | The administrator requires it for everybody. | Set it up (Section 12.2). Nothing else works before. |
| "AI response could not be parsed as valid JSON." | Language model returned conversational commentary or truncated the output. | Click "Copy Correction Prompt" and resend it to the model, or switch models. |
| "Connection to AI service failed." | Invalid API key or unreachable custom BaseUrl (e.g. Ollama service not running). | Verify your API key in AI Settings and click "Test Connection". Ensure `ollama serve` is active. |
| "The request was refused for security reasons. Please reload the page." | The page was old or was called from a foreign page. | Reload the page. |
| "The server cannot be reached. Check the connection and try again." | Vitafolio is not running, or the connection is gone. | Check whether the container is running, and the connection to the server. |
| "The app is being maintained right now (e.g. a backup is being restored)." | A restore is running. | Wait a moment and try again. |
| When uploading: "The file is not a valid backup of this app." | It is not a backup file from Vitafolio, or it is damaged. | Choose a file that you downloaded from Vitafolio. |
| When uploading or restoring: "This backup is from a newer version of the app and cannot be restored here." | The backup was made with a newer Vitafolio version. | Update Vitafolio first. |
| "The file is too large: … (at most 512 MB allowed)." | The backup is larger than 512 MB. | – (this limit applies to uploading). |
| "Password or code does not match. Nothing was changed." | For a backup action (download, upload, restore) your confirmation was wrong. | Enter your current password and, if switched on, a fresh code. |

## 17.3 Problems at start in the container

These messages are in the container's log (on Unraid: the "Logs" icon at the container). They are in German.

| Message (beginning) | What it means | What to do |
|---|---|---|
| "Kein Schreibzugriff auf den Datenordner …" (no write access to the data folder) | The data folder belongs to another user. | Check `PUID` and `PGID` (Section 4.5) and the folder you mounted. |
| "Der Datenordner … ist eine Datei und kein Ordner." (the data folder is a file, not a folder) | The path points to a file. | Mount a folder. |
| "PUID=0 (root) ist nicht erlaubt …" (PUID=0 is not allowed) | `PUID` is set to 0. | Set an ordinary number (Unraid: 99). |
| "ALLOWED_HOSTS: … ist kein gültiger Hostname" or "TRUSTED_PROXIES: … ist keine gültige IP-Adresse" (not a valid host name / IP address) | Typo in the setting. | Write only names without `http://` and without a port, or valid IP addresses or networks. |
| "Datenbankprüfung (integrity_check) … fehlgeschlagen … Der Server startet nicht; nichts wurde verändert. Bitte eine Sicherung wiederherstellen." (database check failed, the server does not start, nothing was changed, please restore a backup) | The database file is damaged. Vitafolio changes nothing in this case. | See below. |

**Database damaged:** Vitafolio does not start and changes nothing. The backup files are in the backup folder (subfolders
`recent`, `daily`, `uploaded`) and are ordinary SQLite files. For an emergency:

1. Stop the container.
2. Save the whole data folder to another place.
3. In the data folder, delete the files `app.db`, `app.db-wal` and `app.db-shm`.
4. Copy the backup you want into the data folder and name it `app.db`.
5. Start the container. The database is brought up to date at start.

## 17.4 Problems in the Windows program

| What you see | What to do |
|---|---|
| The window "WebView2 is missing". It says Vitafolio needs the "Microsoft Edge WebView2 Runtime". | Click "Open download page", download the "Evergreen Bootstrapper" from Microsoft there and install it. Then start Vitafolio again. |
| "Vitafolio could not be started" with the addition "The program's internal server could not be started." | Click "Copy" and keep the text. Among the most common reasons is a data folder that your Windows account may not write to. Start the program again. |
| "The display was terminated" | The display part (WebView2) ended unexpectedly. Start Vitafolio again. Your data is not affected. |
| Windows warns before the start (SmartScreen) | See Section 3.2. |

The program writes a log into its data folder (subfolder `logs`). Its messages appear in the language of your Windows:
English if Windows is English, otherwise German.

# 18 Privacy

Vitafolio sends **no data or telemetry to the publisher**. There are no usage statistics and no remote monitoring. The app also does not
load fonts, CDNs, or scripts from the internet: everything is bundled and served locally from Vitafolio itself.

**What is stored where:**

| What | Where |
|---|---|
| Accounts (username, display name, role, password hash) | in the data folder. The password is never stored in plain text, only as a secure cryptographic hash. |
| Master profile (career history, education, skills, custom sections) | in the data folder inside the SQLite database. |
| Portrait photos and signatures | in the data folder (`data/profiles/...`). |
| Cover letters & Application tracker workflows | in the data folder inside the SQLite database. |
| Archived application dossier snapshots (PDF) | in the data folder (`data/applications/...`). |
| AI configuration & API keys | API keys are stored encrypted in the database via ASP.NET Core Data Protection (`keys/`). |
| AI queries & candidate privacy | External AI providers never receive real names or contact details (Zero-Trust Pseudonymization). |
| Your choice of colour scheme and language | in the browser and in your account. |
| Two-factor secret | encrypted in the database. The keys for it are in the `keys` folder. |
| Recovery codes | only as check values, not readable. |
| Signed-in devices | name of the browser, IP address, times, in the data folder. Ended or expired sessions are deleted after 30 days. |
| Activity log | in the data folder: who, when, what, from which IP address. |
| Backups | in the backup folder. They contain all data of all accounts. |
| Windows program: window profile, window position, program log | in the data folder on your PC. |

**Cookies:** The Docker version uses two small secure cookies (HttpOnly) that hold your sign-in. The browser sends them by
itself with every request. Scripts of the page cannot read them, and they go only to Vitafolio. The Windows program
instead uses a mark that is created anew at every start and exists only between window and program.

**Who sees what?** An administrator sees accounts, the activity audit log, and backups. Administrators cannot browse other
users' resumes or cover letters in the UI. However, because backup archives contain the full database, grant the
administrator role only to people you fully trust.

**Deleting:** A deleted account disappears from the database with all its resumes, applications, and documents. To permanently
remove data from historical backups, delete the corresponding backup files in the data directory.

# 19 Terms

| Term | Meaning |
|---|---|
| Administrator | Account that manages other accounts and the settings of the app. The first account automatically becomes administrator. |
| API Key | Confidential access token for cloud AI providers (OpenAI, Anthropic, Gemini). Encrypted at rest in Vitafolio. |
| Authenticator App | Mobile smartphone app that creates a six-digit code every 30 seconds (TOTP RFC 6238). |
| Container | Closed package in which a program runs together with everything it needs (Docker). |
| Data Folder | Folder that holds the database, keys, dossiers, and backup archives. |
| DIN 5008 | German industrial standard governing business correspondence layout (including Form B window envelopes). |
| Docker | Technique for running programs in lightweight, portable containers. |
| Dossier | Comprehensive job application portfolio unifying cover sheet, DIN 5008 cover letter, and typographic CV into a single PDF. |
| HTTPS | Encrypted connection between browser and server (padlock icon in the address bar). |
| Ollama / LM Studio | Local runner tools executing large language models directly on your hardware (100% offline, zero cloud reliance). |
| Open Source | The source code is public; anyone may look at the program and use it freely under copyleft terms. |
| Open XML SDK | Library enabling native Microsoft Word (.docx) document compilation without requiring Office desktop installations. |
| Prompt | Structured instructions and task context provided to an AI model. Vitafolio constructs these with strict JSON schemas. |
| Pseudonymization | Tokenizing candidate PII with generic placeholders (`[BEWERBER_*]`) so external models never learn real identities. |
| Reverse Proxy | Service placed in front that accepts requests from the internet, encrypts them, and passes them on to Vitafolio. |
| Backup Archive | Consistent online snapshot of the SQLite database enabling complete data recovery. |
| Typst | Modern high-speed typesetting engine compiling publisher-grade vector PDF documents in server memory. |
| Environment Variable | Named value that you give a program or container at start (e.g. `PUID`, `PGID`, `TZ`). |
| Velopack | Installation and auto-update packaging framework for the Windows desktop application. |
| Recovery Code | Emergency code for signing in when the phone is not available. Each works only once. |
| Two-Factor Sign-In | Security procedure where a second proof (code from an authenticator app) is required alongside the password. |
