---
title: Vitafolio
subtitle: Handbook
tagline: Install, set up, protect – how to use Vitafolio step by step.
version: Pre-release
date: 2026-11-04
status: Pre-release
classification: Public
copyright: © 2026 SushiFlux Develop
lang: en
---

# 1 What is Vitafolio?

Vitafolio is a free app for job applications. It is **open source**: the "recipe" of the program is public for everyone
to read, and anyone may use the program for free.

This handbook describes the **pre-release**. It is the foundation of the app. This is what you can already do with it:

- Install Vitafolio on Windows, or run it as a Docker container on a home server (for example Unraid).
- Create accounts and sign in safely, optionally with a second proof (two-factor).
- Choose the look: light, dark or like your system, in German or English.
- As an administrator, manage accounts and settings and read who did what and when.
- Back up your data: automatically on a schedule, by button, to download and to restore.

The functions for writing applications themselves – CV, cover letter, export – are **not included** in this version yet.
This handbook therefore does not describe them.

## 1.1 How to use this handbook

You do not have to read it from start to finish. Pick your goal:

| I want to … | Read |
|---|---|
| use Vitafolio on my Windows PC | Chapters 2 and 3, then 7, 9, 11 and 12 |
| run Vitafolio on my home server (Docker, Unraid, NAS) | Chapters 2 and 4, then 5 to 11 |
| make my account more secure | Chapter 8 |
| manage the accounts of other people | Chapter 10 |
| back up or restore my data | Chapter 11 |
| understand an error message | Chapter 13 |

Technical terms are explained where they first appear. At the end, Chapter 15 has a short list of terms.

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
> Write the administrator's password down in a safe place, for example in a password manager. In this version there is no
> way to reset the password of the **only** administrator (see Chapter 13).

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

# 7 The main window

After signing in (in the Windows program right after the start) you see the main window (see Figure 4).

![The main window of Vitafolio](bilder/hauptfenster.png)

On the left is the **sidebar**. The numbers in Figure 4 belong to the points of this list:

1. **The menu:** "Overview" leads to the start page. "App administration" appears only for administrators of the Docker
   version.
2. **Your area:** your name and your role (in the Windows program it says "Local account"), below it "Settings".
3. **The colour scheme switch** with the symbols for "System", "Light" and "Dark" (Chapter 9).
4. **The footer** with the line "Made with ♥" and the version number. Quote this number when you report a problem.

In the Docker version the sidebar also holds the button "Sign out".

On the right is the **overview**. It welcomes you and shows cards:

- **Your account:** name, username and role.
- **Two-factor sign-in** (Docker version only): whether it is active, with a link to the settings.
- **Operation:** whether you use the server version or the Windows program.
- **Backups** (administrators only, in the Windows program you): when the last backup was made, with a link to the
  backups.

# 8 Protecting your account

This chapter applies to the Docker version. The Windows program has no account that would need protecting.

For this, open **Settings** in the sidebar and then the tab **Security**. It has three areas: "Change password",
"Two-factor sign-in" and "Signed-in devices".

## 8.1 Changing the password

1. Under **Current password**, enter your present password.
2. Under **New password**, enter the new password (at least 12 characters).
3. Enter it once more under **Repeat new password**.
4. Click **Change password**.

You see the message "The password was changed." You stay signed in on this device. On all other devices you are signed
out.

## 8.2 Switching on two-factor sign-in

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

## 8.3 Signing in with a recovery code

If you do not have the phone with you, enter a recovery code in the second step instead of the code. It looks like this:
`abcde-fghij`. Hyphen, spaces and upper or lower case do not matter. The code is used up afterwards. The remaining codes
stay valid.

## 8.4 Switching off two-factor sign-in

1. In the area "Two-factor sign-in", enter your **Current password**.
2. Enter a **Code or recovery code**.
3. Click **Turn off two-factor**.

If the administrator requires two-factor sign-in for everybody (Section 10.5), you cannot switch it off.

## 8.5 Viewing and ending signed-in devices

Under "Signed-in devices" you find every sign-in of your account (see Figure 7): the device (for example "Chrome ·
Windows"), the IP address, since when you are signed in there and when it was last used. Your present device carries the
mark "This device".

Do you not recognise a sign-in? End it:

1. In its row, click **End**.
2. Confirm the question "End session?" with **End**.

The device is signed out at once. Then change your password.

![Signed-in devices](bilder/geraete.png)

# 9 Look and language

Open **Settings** and the tab **Appearance** (see Figure 8).

- **Colour scheme:** "System" follows the setting of your computer, "Light" and "Dark" are fixed. You also find the switch
  at the bottom of the sidebar.
- **Language:** "Deutsch" or "English".

Both apply at once. In the Docker version your choice is also saved in your account and then applies on every device.

![Choosing colour scheme and language](bilder/darstellung.png)

The messages of the Windows program itself (for example at start) follow the language of your Windows, not this setting.

# 10 App administration

This chapter applies to **administrators** of the Docker version. The app administration holds everything that concerns
the whole app for everybody. Your personal settings are kept apart from it under "Settings". You find the app
administration in the sidebar. It has four tabs: "Users", "Settings", "Activity log" and "Backups" (Chapter 11).

An administrator manages accounts and the app. They see **no application data** of other people.

## 10.1 Users

The tab "Users" shows all accounts (see Figure 9) with name, role ("Administrator" or "User"), status ("Active" or
"Disabled"), two-factor ("On" or "Off") and the last sign-in.

At the end of each row are four symbols. They show their name when you point at them. The numbers in the figure belong to these points:

1. **Edit**: change display name, role and "Account active".
2. **Set a new password**: assign a new password for this person.
3. **Reset two-factor**: switch off this person's two-factor sign-in (selectable only when it is on).
4. **Delete**: remove the account.

![Managing users](bilder/benutzer.png)

## 10.2 Adding a new user

1. Click **Add user**.
2. Enter username, display name and password, as in Chapter 5 (see Figure 10).
3. Choose the **role**: "User" works with their own data. "Administrator" manages accounts and the app.
4. Click **Add**.
5. Pass the password on to the person in a safe way. They can change it themselves afterwards (Section 8.1).

![Adding a new user](bilder/benutzer-anlegen.png)

## 10.3 Changing, disabling and deleting accounts

- **Disabling:** Open "Edit" and switch "Account active" off. A disabled account can no longer sign in and is signed out
  everywhere at once.
- **Setting a new password:** You never see the old password. Here too, all devices of the person are signed out.
- **Resetting two-factor:** This helps when somebody has lost the phone and the recovery codes. The person can set up
  two-factor sign-in again afterwards.
- **Deleting:** The account is deleted with all its data. This cannot be undone.

Two protective rules keep anybody from locking themselves out:

- The **last active administrator** cannot be deleted, disabled or demoted to user.
- Nobody can disable or delete their **own account** or take away their own administrator role.

## 10.4 Same names

A username is unique. Upper and lower case do not matter: "Mira" and "mira" are the same name.

## 10.5 Settings: registration and two-factor for everybody

The tab "Settings" has the area "Access" with two switches (see Figure 11). Every change applies to the whole app at once
and saves itself. A green switch with "On" is on, a red one with "Off" is off.

- **Registration open:** If it is on, everybody who reaches the page can create an account. Normally it stays **off**.
  The administrator then creates accounts.
- **Require two-factor for everybody:** If it is on, everybody has to set up two-factor sign-in. Whoever does not have it
  yet is guided through the setup at the next sign-in and cannot do anything else before. For safety Vitafolio asks again
  ("Require two-factor for everybody?") before you switch it on.

![Registration and two-factor for everybody](bilder/admin-einstellungen.png)

## 10.6 The activity log

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
> passwords. Vitafolio slows this down automatically (Chapter 13). Check whether your server needs to be reachable from
> the internet.

# 11 Backups

A **backup** is a copy of your data. With it you get your data back if something goes wrong.

You find the backups:

- in the **Docker version** in the app administration (administrators only), tab "Backups",
- in the **Windows program** under "Settings", tab "Backups".

The page has three parts: "Back up automatically", "The next 7 days" and "Backups".

## 11.1 Backing up automatically

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

## 11.2 The week preview

The area "The next 7 days" shows when backups will be made next week (see Figure 14). Each row is a day, each bar a planned
backup, with the exact times beside it. The preview changes live while you edit the schedule. As long as you have not
saved, it says "Preview, not saved".

Below it you find the time zone and the backup folder.

![The week preview](bilder/vorschau.png)

## 11.3 Viewing, making, downloading, uploading backups

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

## 11.4 Restoring a backup

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

## 11.5 Moving to another computer

A backup file contains your data, but **not the secret keys** in the subfolder `keys` of the data folder. This concerns the
two-factor sign-in of the Docker version.

- If you restore the backup into a **new, empty data folder** without taking the `keys` folder along, Vitafolio can no
  longer check the codes from the authenticator app. You then see the message "The key of the two-factor sign-in cannot be
  read. Have the administrator reset it and set it up again."
- The **recovery codes** keep working, and an administrator can reset the two-factor sign-in of an account (Section 10.3).
- The easiest way is to take the whole data folder along when moving.

For a restore into the same data folder on the same computer this does not matter.

## 11.6 Where are the backups?

In the **backup folder** that you see in Figure 14. It has subfolders: `recent` (the newest backups), `daily` (one per day)
and `uploaded` (uploaded ones). The files are called, for example, `app-20261104-020000-scheduled.db` (date, time, kind).

When tidying up, Vitafolio deletes only files with this name pattern. It leaves everything else in the folder alone. Note:
the `recent` folder counts all kinds alike. The safety copy "Before restore" is also tidied up at some point when many newer
backups are added. If you want to keep a backup for good, download it.

# 12 The Windows program in daily use

The Windows program differs from the Docker version in these points:

- **No sign-in.** Your Windows account protects your data. Whoever sits at your Windows account can open Vitafolio. The
  sidebar says "Local account". As the display name Vitafolio uses your Windows user name.
- **No sign-out, no users, no log, no two-factor sign-in.** There is no app administration either.
- **The settings** have two tabs: "Appearance" and "Backups".
- **The backups** work as in Chapter 11, but **without a password prompt**. They run only while the program is open.
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

The folder holds the database, the secret keys (`keys`), the backups (`backups`) and program logs. Do not delete or change
anything there by hand as long as you want to keep the data. Do not copy the folder while the program is running. Download
a backup in the app instead (Chapter 11). If you want to **delete all data for good**, close Vitafolio and delete this
folder.

# 13 Solving problems

## 13.1 Copying error messages

Vitafolio shows error messages **in full** and in understandable words (see Figure 17). Every message has a **Copy**
button. It copies the whole message with the technical details, the error code, the program version and the time. Paste
the text into your message when you look for help. With "Details" you open the technical details.

![An error message with a Copy button](bilder/fehlermeldung.png)

## 13.2 Common problems

| What you see | Cause | What to do |
|---|---|---|
| Instead of the app, the browser shows a short text message in English: "This server is not reachable under this host name. The operator can allow it with the setting ALLOWED_HOSTS." | You open Vitafolio under a name that is not in `ALLOWED_HOSTS`. | Enter the name in `ALLOWED_HOSTS` (Section 4.6) and restart the container. With the server's IP address it always works. The log contains the line "Anfrage mit nicht erlaubtem Hostnamen … abgewiesen" (in German). |
| "Username or password is wrong." | Wrong input. Vitafolio deliberately does not reveal which. | Check both. Mind the keyboard layout and the caps lock key. |
| "Too many attempts. Please try again in … seconds." | Too many sign-ins or codes in a short time from the same address. This is a protective brake. Default: 10 sign-ins per minute. | Wait the stated time. Behind a reverse proxy: check `TRUSTED_PROXIES` (Section 4.6), otherwise all visitors count together. |
| "This account is disabled. Contact the administrator." | An administrator disabled the account. | Ask an administrator to enable it again (Section 10.3). |
| "The code is wrong or was already used." | Wrong code, or an old code. | Check the time on your phone: it has to be right. Enter the current code. Or use a recovery code. |
| "This code was already used. Wait for the next code of the app or use a recovery code." | The code was right, but you had just used it. Each code works only once. | Wait up to 30 seconds for the next code of the app, or use a recovery code. |
| "The key of the two-factor sign-in cannot be read. …" | The backup was restored into a new data folder without the `keys` folder (Section 11.5). | Sign in with a recovery code, or have an administrator reset the two-factor sign-in. |
| "The sign-in has expired. Please start again with username and password." | The second step took longer than 5 minutes or had more than 5 attempts. | Sign in again. |
| Phone and recovery codes lost | – | Ask an administrator to reset your two-factor sign-in (Section 10.3). |
| Forgotten password | – | Another administrator sets a new password for you (Section 10.3). For the **only** administrator there is no way in the app in this version. So keep the password safe. |
| "Registration is closed. Ask the administrator for an account." | Registration is off. | Have an account created for you. |
| "Two-factor sign-in has to be set up first." | The administrator requires it for everybody. | Set it up (Section 8.2). Nothing else works before. |
| "The request was refused for security reasons. Please reload the page." | The page was old or was called from a foreign page. | Reload the page. |
| "The server cannot be reached. Check the connection and try again." | Vitafolio is not running, or the connection is gone. | Check whether the container is running, and the connection to the server. |
| "The app is being maintained right now (e.g. a backup is being restored)." | A restore is running. | Wait a moment and try again. |
| When uploading: "The file is not a valid backup of this app." | It is not a backup file from Vitafolio, or it is damaged. | Choose a file that you downloaded from Vitafolio. |
| When uploading or restoring: "This backup is from a newer version of the app and cannot be restored here." | The backup was made with a newer Vitafolio version. | Update Vitafolio first. |
| "The file is too large: … (at most 512 MB allowed)." | The backup is larger than 512 MB. | – (this limit applies to uploading). |
| "Password or code does not match. Nothing was changed." | For a backup action (download, upload, restore) your confirmation was wrong. | Enter your current password and, if switched on, a fresh code. |

## 13.3 Problems at start in the container

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
<!-- Final pass: try the emergency steps (3 to 5) with a real backup and confirm; so far only derived from the code. -->

## 13.4 Problems in the Windows program

| What you see | What to do |
|---|---|
| The window "WebView2 is missing". It says Vitafolio needs the "Microsoft Edge WebView2 Runtime". | Click "Open download page", download the "Evergreen Bootstrapper" from Microsoft there and install it. Then start Vitafolio again. |
| "Vitafolio could not be started" with the addition "The program's internal server could not be started." | Click "Copy" and keep the text. Among the most common reasons is a data folder that your Windows account may not write to. Start the program again. |
| "The display was terminated" | The display part (WebView2) ended unexpectedly. Start Vitafolio again. Your data is not affected. |
| Windows warns before the start (SmartScreen) | See Section 3.2. |

The program writes a log into its data folder (subfolder `logs`). Its messages appear in the language of your Windows:
English if Windows is English, otherwise German.

# 14 Privacy

Vitafolio sends **no data to the publisher**. There are no usage statistics and no remote monitoring. The app also does not
load fonts or program parts from the internet: everything comes from Vitafolio itself.

**What is stored where:**

| What | Where |
|---|---|
| Accounts (username, display name, role, password) | in the data folder. The password is never stored in plain text, only as a check value (hash). |
| Your choice of colour scheme and language | in the browser and in your account |
| Two-factor secret | encrypted in the database. The keys for it are in the `keys` folder. |
| Recovery codes | only as check values, not readable |
| Signed-in devices | name of the browser, IP address, times, in the data folder. Ended or expired sessions are deleted after 30 days. |
| Activity log | in the data folder: who, when, what, from which IP address |
| Backups | in the backup folder. They contain all data of all accounts. |
| Windows program: window profile, window position, program log | in the data folder on your PC |

**Cookies:** The Docker version uses two small text marks (cookies) that hold your sign-in. The browser sends them by
itself with every request. Scripts of the page cannot read them, and they go only to Vitafolio. The Windows program
instead uses a mark that is created anew at every start and exists only between window and program.

**Who sees what?** An administrator sees the accounts, the activity log and the backups. With the backups, however, all
data lies open. Give the administrator role only to people you trust.

**Deleting:** A deleted account disappears from the database with its data. It is still in older backups. If you really
want to get rid of everything, delete the backups and the data folder as well (in the Windows program the folder from
Chapter 12).

# 15 Terms

| Term | Meaning |
|---|---|
| Administrator | Account that manages other accounts and the settings of the app. The first account automatically becomes administrator. |
| Authenticator app | App on the phone that creates a six-digit code every 30 seconds. |
| Backup | Copy of your data with which you can restore it. |
| Container | Closed package in which a program runs together with everything it needs (Docker). |
| Data folder | Folder that holds the database, keys and (by default) the backups. |
| Docker | Technique for running programs in containers. |
| Environment variable | Named value that you give a program or container at start. |
| HTTPS | Encrypted connection between browser and server. Recognisable by the padlock in the address bar. |
| Open source | The source code is public; anyone may look at the program and use it. |
| Recovery code | Emergency code for signing in when the phone is not there. Each works only once. |
| Reverse proxy | Service placed in front that accepts requests from the internet, encrypts them and passes them on to Vitafolio. |
| Two-factor sign-in | In addition to the password there is a second proof, for example a code from an app. |
