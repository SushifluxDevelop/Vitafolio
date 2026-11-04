---
title: Vitafolio
subtitle: Handbuch
tagline: Installieren, einrichten, absichern – so benutzen Sie Vitafolio Schritt für Schritt.
version: Vorabversion
date: 2026-11-04
status: Vorabversion
classification: Öffentlich
copyright: © 2026 SushiFlux Develop
lang: de
---

# 1 Was ist Vitafolio?

Vitafolio ist eine kostenlose App für Bewerbungen. Sie ist **Open Source**: Die „Bauanleitung“ des Programms ist öffentlich
einsehbar, und jeder darf das Programm kostenlos nutzen.

Dieses Handbuch beschreibt die **Vorabversion**. Sie bildet das Fundament der App. Das können Sie damit schon tun:

- Vitafolio auf Windows installieren oder als Docker-Container auf einem Heimserver betreiben (zum Beispiel Unraid).
- Konten anlegen und sich sicher anmelden, auf Wunsch mit einem zweiten Nachweis (Zwei-Faktor).
- Das Aussehen wählen: hell, dunkel oder wie Ihr System, auf Deutsch oder Englisch.
- Als Administrator Konten und Einstellungen verwalten und nachlesen, wer wann was getan hat.
- Ihre Daten sichern: automatisch nach Zeitplan, per Knopfdruck, zum Herunterladen und zum Wiederherstellen.

Die Funktionen zum Schreiben von Bewerbungen selbst – Lebenslauf, Anschreiben, Export – sind in dieser Version noch
**nicht enthalten**. Dieses Handbuch beschreibt sie deshalb nicht.

## 1.1 Wie Sie dieses Handbuch benutzen

Sie müssen es nicht von vorn bis hinten lesen. Suchen Sie sich Ihr Ziel aus:

| Ich möchte … | Lesen Sie |
|---|---|
| Vitafolio auf meinem Windows-PC benutzen | Kapitel 2 und 3, dann 7, 9, 11 und 12 |
| Vitafolio auf meinem Heimserver (Docker, Unraid, NAS) betreiben | Kapitel 2 und 4, dann 5 bis 11 |
| mein Konto sicherer machen | Kapitel 8 |
| Konten anderer Personen verwalten | Kapitel 10 |
| meine Daten sichern oder zurückholen | Kapitel 11 |
| eine Fehlermeldung verstehen | Kapitel 13 |

Fachwörter werden beim ersten Auftreten erklärt. Am Ende steht in Kapitel 15 eine kurze Liste der Begriffe.

# 2 Die zwei Versionen im Überblick

Es gibt Vitafolio in zwei Formen. Beide haben dieselbe Oberfläche. Sie unterscheiden sich darin, wie man sie benutzt.

| | Windows-Programm | Docker-Version |
|---|---|---|
| Wie benutzt man sie? | Wie jedes Programm: eigenes Fenster | Im Webbrowser, unter einer Adresse |
| Für wen? | eine Person an einem PC | eine oder mehrere Personen, im Heimnetz oder – mit eigenem HTTPS – von unterwegs |
| Anmeldung? | nein, das Windows-Konto schützt | ja, mit Benutzername und Passwort |
| Zwei-Faktor, Benutzerverwaltung, Protokoll? | nein | ja |
| Erreichbar von | nur diesem PC | von allen, die den Server erreichen und ein Konto haben |
| Daten liegen | in einem Ordner auf diesem PC | im Datenordner des Containers |

Kurz erklärt:

- **Docker** ist eine Technik, mit der ein Programm samt allem, was es braucht, in einem abgeschlossenen Paket läuft.
  Das Paket heißt **Container**. Es läuft auf jedem Rechner gleich.
- **Unraid** ist ein Betriebssystem für Heimserver. Ein **NAS** ist ein Netzwerkspeicher im Heimnetz, zum Beispiel von
  Synology. Auf beiden laufen Container.
- Der **Browser** ist das Programm, mit dem Sie Webseiten ansehen, zum Beispiel Edge, Chrome oder Firefox.

> [!HINWEIS]
> Ein Handy-Layout gibt es nicht. Vitafolio ist für Computer-Bildschirme gemacht. Die kleinste unterstützte Fensterbreite
> ist 1024 Pixel.

# 3 Das Windows-Programm installieren

## 3.1 Voraussetzungen

- Ein 64-Bit-Windows.
- Das Windows-Programm braucht die „Microsoft Edge WebView2 Runtime“. Das ist ein Baustein von Microsoft, der das
  Programmfenster darstellt. Windows 11 bringt ihn mit, einzelne Windows-10-PCs nicht. Fehlt er, sagt Ihnen Vitafolio das
  beim Start und bietet die offizielle Download-Seite an (siehe Kapitel 13).
- Sie brauchen **keine Administrator-Rechte**. Vitafolio wird nur für Ihr Benutzerkonto installiert.

## 3.2 Installieren

1. Laden Sie die Setup-Datei `Vitafolio-win-Setup.exe` von der Download-Seite des Projekts herunter (der Bereich
   „Releases“ des Projekts auf GitHub).
2. Starten Sie die Datei mit einem Doppelklick.
3. Warten Sie, bis die Installation fertig ist.
4. Starten Sie Vitafolio über das Startmenü oder die Windows-Suche.

<!-- Schlusslauf: Ort und Name der Setup-Datei bestätigen, sobald es eine veröffentlichte Version gibt. -->

> [!HINWEIS]
> Windows zeigt beim ersten Start möglicherweise eine Warnung („SmartScreen“). Der Grund: Das Programm ist noch nicht
> digital signiert. Das ist eine Bestätigung, die ein Hersteller bei Microsoft kaufen kann. Es ist kein Hinweis auf einen
> Fehler. Wenn Sie der Quelle der Datei vertrauen, lassen Sie das Programm trotz der Warnung starten.

## 3.3 Der erste Start

Beim Start sehen Sie zuerst eine Ladeansicht mit dem Text „Der lokale Server wird gestartet …“. Danach öffnet sich die
App. Eine Anmeldung ist nicht nötig. Weiter geht es mit Kapitel 7.

Läuft Vitafolio schon und Sie starten es noch einmal, öffnet sich kein zweites Fenster. Stattdessen kommt das laufende
Fenster nach vorn.

## 3.4 Aktualisieren und entfernen

Das Programm sucht **nicht von selbst** nach neuen Versionen. Eine neue Version installieren Sie mit der neuen
Setup-Datei.

Deinstallieren können Sie Vitafolio wie jedes Programm in den Windows-Einstellungen unter „Apps“.

**Ihre Daten bleiben beim Deinstallieren erhalten.** Sie liegen getrennt vom Programm in einem eigenen Ordner (siehe
Kapitel 12). Installieren Sie Vitafolio später neu, finden Sie Ihre Daten wieder vor. Wollen Sie die Daten **ganz
loswerden**, löschen Sie nach dem Deinstallieren diesen Ordner: `%LOCALAPPDATA%\SushiFlux Develop\Vitafolio`.

> [!TIPP]
> Laden Sie vor einer Neuinstallation oder Deinstallation trotzdem eine Sicherung herunter und legen Sie sie **außerhalb**
> des Vitafolio-Datenordners ab (zum Beispiel in „Dokumente“). Wie das geht, steht in Kapitel 11.

# 4 Mit Docker installieren (Unraid, NAS, Linux-Server)

## 4.1 Was Sie brauchen

- Einen Rechner, auf dem Docker läuft (Unraid, ein NAS mit Container-Unterstützung oder ein Linux-Server).
- Einen Ordner für die Daten auf einem **lokalen Datenträger** des Rechners. Legen Sie ihn nicht auf eine Netzfreigabe.
  Die Datenbank von Vitafolio ist eine einzelne Datei. Dateisperren funktionieren über das Netzwerk nicht verlässlich.
  Auf Unraid ist ein Ordner auf dem Cache oder in einem Pool geeignet, zum Beispiel `/mnt/cache/appdata/vitafolio`.
- Ein Konto ist für den Start nicht nötig. Das erste Konto legen Sie im Browser an (Kapitel 5).

## 4.2 Mit Docker Compose (Linux, NAS)

**Docker Compose** liest eine kleine Textdatei, in der steht, wie der Container laufen soll.

1. Legen Sie auf dem Rechner einen Ordner für Vitafolio an, zum Beispiel `vitafolio`.
2. Legen Sie darin eine Datei `docker-compose.yml` mit diesem Inhalt an:

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

3. Passen Sie `PUID` und `PGID` an (siehe Abschnitt 4.5) und `TZ` an Ihre Zeitzone.
4. Starten Sie den Container in diesem Ordner mit `docker compose up -d`.
5. Öffnen Sie im Browser `http://` und die Adresse des Rechners, dann `:8080`. Beispiel: `http://192.168.1.20:8080`.

<!-- Schlusslauf: Image-Name und Kennung "latest" bestätigen, sobald das Image öffentlich ist. -->

Es erscheint die Seite zur Einrichtung des ersten Kontos. Weiter mit Kapitel 5.

## 4.3 Auf Unraid

1. Öffnen Sie in Unraid die Seite „Docker“ und legen Sie einen neuen Container an.
2. Tragen Sie ein:
   - **Name:** `vitafolio`
   - **Repository:** `ghcr.io/sushifluxdevelop/vitafolio:latest`
   - **Port:** Container-Port `8080`, als Host-Port zum Beispiel ebenfalls `8080`
   - **Pfad:** Container-Pfad `/data`, Host-Pfad `/mnt/cache/appdata/vitafolio`
   - **Variablen:** `PUID` = `99`, `PGID` = `100`, `TZ` = Ihre Zeitzone, zum Beispiel `Europe/Berlin`
3. Bestätigen Sie. Unraid lädt das Paket und startet den Container.
4. Öffnen Sie im Browser `http://` und die Adresse Ihres Unraid-Servers, dann `:8080`.

Die Werte 99 und 100 sind die Nummern, die Unraid für den Benutzer „nobody“ und die Gruppe „users“ verwendet.
Sie sind auch der Standard von Vitafolio. Eine fertige Vorlage für den Unraid-App-Store gibt es in dieser Version nicht.

## 4.4 Die Einstellungen im Überblick

Diese Einstellungen tragen Sie als **Umgebungsvariablen** ein. Das sind benannte Werte, die ein Container beim Start
bekommt. Sie brauchen nur die, die Sie ändern wollen.

| Variable | Bedeutung | Standard |
|---|---|---|
| `PUID`, `PGID` | Nummer des Benutzers und der Gruppe, unter denen Vitafolio läuft und denen der Datenordner gehört | 99 und 100 |
| `TZ` | Ihre Zeitzone. Sie bestimmt die Uhrzeiten des Sicherungs-Zeitplans und die Zeiten im Protokoll. | die Zeitzone des Containers, meist UTC |
| `ALLOWED_HOSTS` | Namen, unter denen Vitafolio erreichbar sein darf (siehe 4.6) | leer: nur IP-Adressen und `localhost` |
| `TRUSTED_PROXIES` | Adressen Ihres Reverse-Proxys (siehe 4.6) | leer |
| `BACKUP_DIR` | Ordner für die Sicherungen | `backups` im Datenordner |

Der Datenordner heißt im Container immer `/data`. Binden Sie dort Ihren Ordner ein, wie in den Beispielen oben.

> [!TIPP]
> Legen Sie die Sicherungen auf einen **anderen Datenträger** als die Daten. Setzen Sie dazu `BACKUP_DIR` auf einen Pfad,
> den Sie zusätzlich in den Container einbinden. Eine Sicherung auf demselben Laufwerk schützt nicht, wenn die Festplatte
> kaputtgeht.

## 4.5 Datenordner und Berechtigungen

Vitafolio läuft nie mit Administrator-Rechten. Der Container startet kurz als Administrator, übergibt den Datenordner dem
Benutzer aus `PUID` und `PGID` und läuft danach nur noch als dieser Benutzer. Das erledigt der Container selbst.

- Auf **Unraid** passen die Standardwerte 99 und 100.
- Auf einem **normalen Linux-Rechner** nehmen Sie Ihre eigene Benutzer- und Gruppennummer. Mit dem Befehl `id` sehen Sie
  sie. Meist sind es 1000 und 1000.
- Die Nummer `0` ist nicht erlaubt. Vitafolio startet dann nicht und sagt das im Protokoll des Containers.

## 4.6 Erreichbar machen: HTTPS und Reverse-Proxy

**Machen Sie Vitafolio nie ohne HTTPS aus dem Internet erreichbar.** **HTTPS** ist die verschlüsselte Form der
Verbindung zwischen Browser und Server. Man erkennt sie am Schloss in der Adresszeile. Ohne Verschlüsselung kann im Netz
jeder mitlesen, auch Ihr Passwort.

Vitafolio selbst spricht nur unverschlüsselt (HTTP). Die Verschlüsselung übernimmt ein vorgeschalteter Dienst, ein
**Reverse-Proxy**. Er nimmt die Anfragen aus dem Internet entgegen, verschlüsselt sie und reicht sie an Vitafolio weiter.
Richten Sie sich einen solchen Dienst ein, wenn Sie Vitafolio von außerhalb Ihres Heimnetzes benutzen wollen.

Zwei Einstellungen machen Vitafolio dafür bereit:

1. **`ALLOWED_HOSTS`**: Tragen Sie den Namen ein, unter dem Sie Vitafolio aufrufen, zum Beispiel
   `vitafolio.example.com`. Mehrere Namen trennen Sie durch Kommas. Mit `*.example.com` ist jede Unterdomain erlaubt.
   Ohne diesen Eintrag antwortet Vitafolio nur auf IP-Adressen und `localhost`. Das schützt vor einem Trick, bei dem eine
   fremde Webseite Ihren Server über ihren eigenen Namen anspricht.
2. **`TRUSTED_PROXIES`**: Tragen Sie die Adresse Ihres Reverse-Proxys ein (oder ein Netz wie `172.18.0.0/16`). Dann
   übernimmt Vitafolio vom Proxy die echte Adresse des Besuchers und die Information, dass die Verbindung verschlüsselt
   war. Ohne diesen Eintrag sehen alle Besucher aus wie der Proxy: Die Bremse gegen Passwort-Raten gilt dann für alle
   gemeinsam, das Protokoll zeigt falsche Adressen, und die Anmelde-Cookies bekommen nicht das Kennzeichen „nur über HTTPS“.

Stellen Sie außerdem sicher, dass Ihr Reverse-Proxy die Kopfzeilen `X-Forwarded-Host` und `X-Forwarded-Proto` **selbst
setzt** und Werte, die ein Besucher mitschickt, **überschreibt**. Sonst richtet sich die Prüfung des Namens nach dem, was
der Besucher behauptet, und die Cookies bekommen das Kennzeichen „nur über HTTPS“ nicht. Die meisten Reverse-Proxys
bieten dafür eine Einstellung; lesen Sie in deren Anleitung nach.
<!-- Schlusslauf: Verhalten bestätigen, sobald die Pentest-Anpassungen eingebaut sind. -->

Ein Tippfehler in diesen beiden Einstellungen verhindert den Start mit einer deutschen Meldung im Protokoll. So sperrt er
niemanden unbemerkt aus.

## 4.7 Starten, stoppen, aktualisieren

- **Stoppen** Sie den Container immer normal (nicht abwürgen). Vitafolio macht beim Beenden noch eine Sicherung und
  braucht dafür bis zu 40 Sekunden.
- **Aktualisieren:** Laden Sie das neue Paket und starten Sie den Container neu (auf Unraid über „Check for Updates“ und
  „Update“ im Docker-Bereich). Die Datenbank passt sich beim Start selbst an die neue Version an. Laden Sie vorher eine
  Sicherung herunter (Kapitel 11).
- Starten Sie **nur einen Container pro Datenordner**.
- Zurück zu einer **älteren** Version geht nicht ohne Weiteres: Eine Sicherung aus einer neueren Version nimmt die
  App nicht an.
- Docker zeigt Ihnen, ob Vitafolio „gesund“ („healthy“) ist. Dafür fragt es alle 30 Sekunden die Seite für den
  Zustand ab.

# 5 Der erste Start: das erste Konto anlegen

Dieses Kapitel gilt für die Docker-Version. Im Windows-Programm gibt es diesen Schritt nicht.

Beim allerersten Aufruf will Vitafolio wissen, wer der Verwalter ist. Das Konto, das Sie jetzt anlegen, wird automatisch
**Administrator**. Ein Administrator verwaltet Konten und die Einstellungen der App.

1. Öffnen Sie die Adresse von Vitafolio im Browser (siehe Kapitel 4).
2. Sie sehen die Seite „Willkommen bei Vitafolio“ (siehe Abbildung 1).
3. Lesen Sie den **Einrichtungscode** aus dem Protokoll des Containers ab. Er steht dort bei jedem Start, solange es noch
   kein Konto gibt. Auf Unraid öffnen Sie dazu im Docker-Bereich das Menü des Containers „Vitafolio“ und wählen „Logs“.
   Bei Docker Compose zeigt `docker compose logs vitafolio` das Protokoll.
4. Geben Sie den Einrichtungscode im Feld **Einrichtungscode** ein.
5. Geben Sie einen **Benutzernamen** ein. Er hat 3 bis 32 Zeichen: Buchstaben, Ziffern, Punkt, Unterstrich oder
   Bindestrich. Beispiel: `mira`.
6. Geben Sie Ihren **Anzeigenamen** ein, so wie er in der App erscheinen soll. Er hat 1 bis 64 Zeichen.
7. Geben Sie ein **Passwort** mit mindestens 12 und höchstens 128 Zeichen ein. Weitere Regeln gibt es nicht. Ein langer
   Satz ist besser als ein kurzes Wort mit Sonderzeichen.
8. Geben Sie das Passwort unter „Passwort wiederholen“ noch einmal ein.
9. Klicken Sie auf **Konto anlegen**.

<!-- Schlusslauf: Schritte 3 und 4 (Einrichtungscode) erst bestätigen, wenn die Einrichtung im Server den Code verlangt; Feldname und Texte prüfen. -->

Sie sind danach gleich angemeldet und sehen das Hauptfenster (Kapitel 7).

![Das erste Konto anlegen](bilder/setup.png)

Vitafolio prüft Ihre Eingaben schon beim Tippen. Ein Problem erscheint sofort unter dem Feld, zum Beispiel „Zu kurz:
5 von mindestens 12 Zeichen.“ Der Knopf sendet nichts ab, solange etwas rot markiert ist.

> [!HINWEIS]
> Der Einrichtungscode schützt Sie davor, dass ein Fremder, der die Seite zufällig vor Ihnen erreicht, das erste Konto
> anlegt und damit Administrator wird: Nur wer das Protokoll des Servers lesen kann, kennt den Code. Die Einrichtung geht
> nur einmal. Schließen Sie sie trotzdem ab, **bevor** Sie Vitafolio für andere erreichbar machen.

> [!HINWEIS]
> Notieren Sie das Passwort des Administrators an einem sicheren Ort, zum Beispiel in einem Passwort-Manager. In dieser
> Version gibt es keinen Weg, das Passwort des **einzigen** Administrators zurückzusetzen (siehe Kapitel 13).

# 6 Anmelden und Abmelden

Dieses Kapitel gilt für die Docker-Version.

## 6.1 Anmelden

1. Öffnen Sie die Adresse von Vitafolio im Browser. Wenn Sie nicht angemeldet sind, sehen Sie die Anmeldeseite (siehe
   Abbildung 2). Links ist das Formular, rechts stehen die Merkmale der App.
2. Geben Sie Ihren **Benutzernamen** und Ihr **Passwort** ein.
3. Klicken Sie auf **Anmelden**.

Ist bei Ihrem Konto die Zwei-Faktor-Anmeldung eingeschaltet, folgt ein zweiter Schritt (Abschnitt 6.2).

![Anmeldung mit Benutzername und Passwort](bilder/anmeldung.png)

Unten links auf der Anmeldeseite wählen Sie die Sprache: **Deutsch** oder **English**.

## 6.2 Der zweite Schritt: der Code

Die **Zwei-Faktor-Anmeldung** verlangt zum Passwort einen zweiten Nachweis. Sie richten sie in Kapitel 8 ein. Der zweite
Nachweis ist ein sechsstelliger Code aus einer **Authenticator-App** auf Ihrem Handy. Er ändert sich alle 30 Sekunden.

1. Nach dem Passwort sehen Sie die Seite „Zweiter Schritt“ (siehe Abbildung 3).
2. Öffnen Sie Ihre Authenticator-App und lesen Sie den aktuellen Code ab.
3. Geben Sie ihn im Feld **Code** ein.
4. Klicken Sie auf **Bestätigen**.

Haben Sie das Handy nicht zur Hand, geben Sie stattdessen einen **Wiederherstellungscode** ein (Abschnitt 8.3). Jeder
gilt nur einmal.

Sie haben für den Code **5 Minuten und 5 Versuche**. Danach beginnen Sie wieder mit Benutzername und Passwort. Über
„Zurück zur Anmeldung“ kommen Sie früher dorthin.

![Zweiter Schritt der Anmeldung: der Code](bilder/anmeldung-code.png)

## 6.3 Registrieren

Normalerweise gibt es auf der Anmeldeseite keine Möglichkeit, sich selbst ein Konto anzulegen. Konten legt der
Administrator an (Kapitel 10). Schaltet der Administrator die Registrierung ein, erscheint unter dem Formular „Noch kein
Konto?“ mit dem Verweis **Registrieren**. Dort geben Sie Benutzername, Anzeigename und Passwort ein, wie in Kapitel 5.
Neue Konten sind normale Benutzer, keine Administratoren.

## 6.4 Abmelden

Klicken Sie links unten in der Seitenleiste auf **Abmelden**.

## 6.5 Wie lange bleibe ich angemeldet?

Solange Sie Vitafolio benutzen, bleiben Sie angemeldet. Vitafolio erneuert Ihre Anmeldung im Hintergrund, ohne dass Sie
etwas merken. Wer 30 Tage lang gar nicht vorbeischaut, muss sich neu anmelden. Außerdem werden Sie abgemeldet, wenn ein
Administrator Ihr Konto sperrt oder Ihnen ein neues Passwort setzt, wenn Sie Ihr Passwort ändern (auf allen anderen
Geräten) oder wenn eine Sicherung wiederhergestellt wird.

# 7 Das Hauptfenster

Nach der Anmeldung (im Windows-Programm gleich nach dem Start) sehen Sie das Hauptfenster (siehe Abbildung 4).

![Das Hauptfenster von Vitafolio](bilder/hauptfenster.png)

Links ist die **Seitenleiste**. Die Zahlen in Abbildung 4 gehören zu den Punkten dieser Liste:

1. **Das Menü:** „Übersicht“ führt zur Startseite. „App-Administration“ erscheint nur für Administratoren der
   Docker-Version.
2. **Ihr Bereich:** Ihr Name und Ihre Rolle (im Windows-Programm steht dort „Lokales Konto“), darunter „Einstellungen“.
3. **Der Schalter fürs Farbschema** mit den Symbolen für „System“, „Hell“ und „Dunkel“ (Kapitel 9).
4. **Die Fußzeile** mit der Zeile „Mit ♥ gemacht“ und der Versionsnummer. Nennen Sie diese Nummer, wenn Sie einen
   Fehler melden.

In der Docker-Version steht in der Seitenleiste außerdem der Knopf „Abmelden“.

Rechts ist die **Übersicht**. Sie begrüßt Sie und zeigt Karten:

- **Ihr Konto:** Name, Benutzername und Rolle.
- **Zwei-Faktor-Anmeldung** (nur Docker-Version): ob sie aktiv ist, mit einem Verweis zu den Einstellungen.
- **Betrieb:** ob Sie die Server-Version oder das Windows-Programm benutzen.
- **Datensicherung** (nur für Administratoren, im Windows-Programm für Sie): wann die letzte Sicherung gemacht wurde,
  mit einem Verweis zur Datensicherung.

# 8 Ihr Konto schützen

Dieses Kapitel gilt für die Docker-Version. Im Windows-Programm gibt es kein Konto, das man schützen müsste.

Öffnen Sie dazu in der Seitenleiste **Einstellungen** und dann den Reiter **Sicherheit**. Dort stehen drei Bereiche:
„Passwort ändern“, „Zwei-Faktor-Anmeldung“ und „Angemeldete Geräte“.

## 8.1 Das Passwort ändern

1. Geben Sie unter **Aktuelles Passwort** Ihr heutiges Passwort ein.
2. Geben Sie unter **Neues Passwort** das neue Passwort ein (mindestens 12 Zeichen).
3. Geben Sie es unter **Neues Passwort wiederholen** noch einmal ein.
4. Klicken Sie auf **Passwort ändern**.

Sie sehen die Meldung „Das Passwort wurde geändert.“ Sie bleiben auf diesem Gerät angemeldet. Auf allen anderen Geräten
werden Sie abgemeldet.

## 8.2 Die Zwei-Faktor-Anmeldung einschalten

Dafür brauchen Sie eine **Authenticator-App** auf Ihrem Handy. Das ist eine App, die alle 30 Sekunden einen neuen
sechsstelligen Code erzeugt. Installieren Sie sie, bevor Sie anfangen.

1. Klicken Sie unter „Zwei-Faktor-Anmeldung“ auf **Einrichtung starten**.
2. Es erscheint ein **QR-Code** (siehe Abbildung 5). Das ist ein Quadrat aus schwarzen und weißen Punkten, das die App mit
   der Handy-Kamera einliest.
3. Scannen Sie den QR-Code mit Ihrer Authenticator-App. Geht das nicht, tippen Sie den **Schlüssel zum Eintippen** unter
   dem Bild von Hand in die App ein. Der Knopf „Kopieren“ daneben hilft dabei.
4. Die App zeigt jetzt einen sechsstelligen Code. Geben Sie ihn im Feld **Code aus der App** ein.
5. Klicken Sie auf **Aktivieren**.

![Zwei-Faktor-Anmeldung einrichten: QR-Code und Code](bilder/zwei-faktor-einrichten.png)

Danach zeigt Vitafolio **zehn Wiederherstellungscodes** (siehe Abbildung 6). Das sind Notfall-Codes für den Fall, dass
Sie das Handy verlieren.

1. Klicken Sie auf **Kopieren** und fügen Sie die Codes in Ihren Passwort-Manager ein, oder schreiben Sie sie auf.
2. Bewahren Sie sie sicher auf, **getrennt vom Handy**.
3. Klicken Sie auf **Fertig, Codes gespeichert**.

![Die zehn Wiederherstellungscodes](bilder/wiederherstellungscodes.png)

> [!WARNUNG]
> Die Wiederherstellungscodes werden **nur dieses eine Mal** angezeigt. Jeder Code gilt nur einmal.

Von jetzt an fragt Vitafolio bei jeder Anmeldung nach dem Code (Abschnitt 6.2).

## 8.3 Mit einem Wiederherstellungscode anmelden

Haben Sie das Handy nicht dabei, geben Sie im zweiten Schritt statt des Codes einen Wiederherstellungscode ein. Er sieht
so aus: `abcde-fghij`. Bindestrich, Leerzeichen und Groß- oder Kleinschreibung spielen keine Rolle. Der Code ist danach
verbraucht. Die übrigen Codes bleiben gültig.

## 8.4 Die Zwei-Faktor-Anmeldung ausschalten

1. Geben Sie im Bereich „Zwei-Faktor-Anmeldung“ Ihr **Aktuelles Passwort** ein.
2. Geben Sie einen **Code oder Wiederherstellungscode** ein.
3. Klicken Sie auf **Zwei-Faktor ausschalten**.

Verlangt der Administrator die Zwei-Faktor-Anmeldung für alle (Abschnitt 10.5), können Sie sie nicht ausschalten.

## 8.5 Angemeldete Geräte ansehen und beenden

Unter „Angemeldete Geräte“ steht jede Anmeldung Ihres Kontos (siehe Abbildung 7): das Gerät (zum Beispiel „Chrome ·
Windows“), die IP-Adresse, seit wann Sie dort angemeldet sind und wann es zuletzt benutzt wurde. Ihr jetziges Gerät
trägt die Markierung „Dieses Gerät“.

Erkennen Sie eine Anmeldung nicht? Beenden Sie sie:

1. Klicken Sie in der Zeile auf **Beenden**.
2. Bestätigen Sie die Frage „Sitzung beenden?“ mit **Beenden**.

Das Gerät ist sofort abgemeldet. Ändern Sie dann Ihr Passwort.

![Angemeldete Geräte](bilder/geraete.png)

# 9 Aussehen und Sprache

Öffnen Sie **Einstellungen** und den Reiter **Darstellung** (siehe Abbildung 8).

- **Farbschema:** „System“ folgt der Einstellung Ihres Computers, „Hell“ und „Dunkel“ sind fest. Den Schalter finden Sie
  auch unten in der Seitenleiste.
- **Sprache:** „Deutsch“ oder „English“.

Beides gilt sofort. In der Docker-Version wird Ihre Wahl auch in Ihrem Konto gespeichert und gilt dann auf jedem Gerät.

![Farbschema und Sprache wählen](bilder/darstellung.png)

Die Meldungen des Windows-Programms selbst (zum Beispiel beim Start) richten sich nach der Sprache Ihres Windows, nicht nach
dieser Einstellung.

# 10 App-Administration

Dieses Kapitel gilt für **Administratoren** der Docker-Version. Die App-Administration enthält alles, was die ganze App für
alle betrifft. Ihre persönlichen Einstellungen stehen getrennt davon unter „Einstellungen“. Die App-Administration finden
Sie in der Seitenleiste. Sie hat vier Reiter: „Benutzer“, „Einstellungen“, „Aktivitätsprotokoll“ und „Datensicherung“
(Kapitel 11).

Ein Administrator verwaltet Konten und die App. Er sieht **keine Bewerbungsdaten** anderer Personen.

## 10.1 Benutzer

Der Reiter „Benutzer“ zeigt alle Konten (siehe Abbildung 9) mit Name, Rolle („Administrator“ oder „Benutzer“), Status
(„Aktiv“ oder „Gesperrt“), Zwei-Faktor („Ein“ oder „Aus“) und der letzten Anmeldung.

Am Ende jeder Zeile stehen vier Symbole. Sie zeigen beim Daraufzeigen ihren Namen. Die Zahlen in der Abbildung gehören zu diesen Punkten:

1. **Bearbeiten**: Anzeigename, Rolle und „Konto aktiv“ ändern.
2. **Neues Passwort setzen**: ein neues Passwort für diese Person vergeben.
3. **Zwei-Faktor zurücksetzen**: die Zwei-Faktor-Anmeldung dieser Person ausschalten (nur wählbar, wenn sie an ist).
4. **Löschen**: das Konto entfernen.

![Benutzer verwalten](bilder/benutzer.png)

## 10.2 Einen neuen Benutzer anlegen

1. Klicken Sie auf **Benutzer anlegen**.
2. Geben Sie Benutzername, Anzeigename und Passwort ein, wie in Kapitel 5 (siehe Abbildung 10).
3. Wählen Sie die **Rolle**: „Benutzer“ arbeitet mit den eigenen Daten. „Administrator“ verwaltet Konten und die App.
4. Klicken Sie auf **Anlegen**.
5. Geben Sie der Person das Passwort auf einem sicheren Weg weiter. Sie kann es danach selbst ändern (Abschnitt 8.1).

![Einen neuen Benutzer anlegen](bilder/benutzer-anlegen.png)

## 10.3 Konten ändern, sperren und löschen

- **Sperren:** Öffnen Sie „Bearbeiten“ und schalten Sie „Konto aktiv“ aus. Ein gesperrtes Konto kann sich nicht mehr
  anmelden und ist sofort überall abgemeldet.
- **Neues Passwort setzen:** Sie sehen das alte Passwort nie. Auch hier werden alle Geräte der Person abgemeldet.
- **Zwei-Faktor zurücksetzen:** Das hilft, wenn jemand Handy und Wiederherstellungscodes verloren hat. Die Person kann die
  Zwei-Faktor-Anmeldung danach neu einrichten.
- **Löschen:** Das Konto wird mit allen Daten gelöscht. Das lässt sich nicht rückgängig machen.

Zwei Schutzregeln verhindern, dass sich jemand aussperrt:

- Der **letzte aktive Administrator** kann nicht gelöscht, gesperrt oder zum Benutzer herabgestuft werden.
- Niemand kann das **eigene Konto** sperren, löschen oder sich selbst die Administrator-Rolle nehmen.

## 10.4 Gleiche Namen

Ein Benutzername ist einmalig. Dabei spielt Groß- und Kleinschreibung keine Rolle: „Mira“ und „mira“ sind derselbe Name.

## 10.5 Einstellungen: Registrierung und Zwei-Faktor für alle

Im Reiter „Einstellungen“ gibt es den Bereich „Zugang“ mit zwei Schaltern (siehe Abbildung 11). Jede Änderung gilt sofort
für die ganze App und speichert sich selbst. Ein grüner Schalter mit „Ein“ ist an, ein roter mit „Aus“ ist aus.

- **Registrierung offen:** Ist er an, kann sich jeder, der die Seite erreicht, ein Konto anlegen. Normalerweise bleibt er
  **aus**. Konten legt dann der Administrator an.
- **Zwei-Faktor für alle verlangen:** Ist er an, muss jeder die Zwei-Faktor-Anmeldung einrichten. Wer noch keine hat,
  wird bei der nächsten Anmeldung durch die Einrichtung geführt und kann vorher nichts anderes tun. Vitafolio fragt zur
  Sicherheit nach („Zwei-Faktor für alle verlangen?“), bevor Sie ihn einschalten.

![Registrierung und Zwei-Faktor für alle](bilder/admin-einstellungen.png)

## 10.6 Das Aktivitätsprotokoll

Das Aktivitätsprotokoll hält fest, **wer wann was getan hat** (siehe Abbildung 12). Dazu gehören Anmeldungen und
fehlgeschlagene Anmeldungen, Abmeldungen, Änderungen an Konten und Einstellungen, die Zwei-Faktor-Anmeldung, und alles
rund um Sicherungen (auch die automatischen). Niemand kann Einträge ändern oder löschen.

Zu jedem Eintrag gehören die Zeit (in Ihrer Ortszeit), wer es getan hat, die Aktion, wen oder was sie betrifft, die
IP-Adresse und auf Wunsch Details (Knopf „Anzeigen“).

- Mit den Auswahlfeldern **Aktion** und **Benutzer** engen Sie die Liste ein.
- Die Liste zeigt 25 Einträge pro Seite, die neuesten zuerst. Mit den Pfeilen blättern Sie.

![Das Aktivitätsprotokoll](bilder/aktivitaetsprotokoll.png)

> [!TIPP]
> Viele „Anmeldung fehlgeschlagen“-Einträge kurz hintereinander, auch für ein Konto, das es nicht gibt, deuten auf
> jemanden hin, der Passwörter durchprobiert. Vitafolio bremst das automatisch (Kapitel 13). Prüfen Sie, ob Ihr Server
> aus dem Internet erreichbar sein muss.

# 11 Datensicherung

Eine **Sicherung** ist eine Kopie Ihrer Daten. Mit ihr holen Sie Ihre Daten zurück, wenn etwas schiefgeht.

Sie finden die Datensicherung:

- in der **Docker-Version** in der App-Administration (nur Administratoren), Reiter „Datensicherung“,
- im **Windows-Programm** unter „Einstellungen“, Reiter „Datensicherung“.

Die Seite hat drei Teile: „Automatisch sichern“, „Die nächsten 7 Tage“ und „Sicherungen“.

## 11.1 Automatisch sichern

Hier legen Sie fest, wann Vitafolio von allein sichert (siehe Abbildung 13). Die Zahlen in der Abbildung gehören zu den Punkten der Liste darunter.

![Automatisch sichern: der Zeitplan](bilder/zeitplan.png)

1. **Automatische Sicherung** (Hauptschalter): Schaltet **alle** automatischen Sicherungen ein oder aus. Schalten Sie ihn aus,
   wenn Sie schon ein eigenes Sicherungssystem haben, zum Beispiel die Appdata-Sicherung Ihres NAS. Sichern, Herunterladen
   und Wiederherstellen per Knopf funktionieren immer.
2. **Beim Start** und **Vor dem Beenden:** Eine Sicherung, sobald Vitafolio startet, und eine letzte, bevor es sich beendet.
   Beide sind standardmäßig an.
3. **Zeitplan:** Wählen Sie eine Art:
   - **Aus:** nur beim Start und beim Beenden.
   - **Alle … Stunden:** alle 1 bis 168 Stunden. Gezählt wird ab Mitternacht eines Montags. Bei 6 Stunden sind das also
     0, 6, 12 und 18 Uhr. Das ist die Voreinstellung.
   - **Zu festen Zeiten:** Wählen Sie die **Wochentage** (Mo bis So) und bis zu 12 **Uhrzeiten**. Mit „Uhrzeit
     hinzufügen“ kommt eine Zeile dazu, mit dem Papierkorb-Symbol fällt eine weg.
4. **Verpasste Sicherungen nachholen:** War Vitafolio zur geplanten Zeit nicht an, wird die Sicherung beim nächsten Start
   nachgeholt. Das ist besonders im Windows-Programm nützlich: Es kann nur sichern, solange es geöffnet ist.
5. **Aufbewahrung:** Hier legen Sie fest, wie viele Sicherungen bleiben:
   - **Letzte Sicherungen behalten:** die neuesten 5 bis 500 (Standard 20).
   - **Eine pro Tag behalten (Tage):** die erste Sicherung jedes Tages, so viele Tage lang, 0 bis 3650 (Standard 60;
     0 = keine).

Klicken Sie danach auf **Speichern**. „Verwerfen“ nimmt Ihre Änderungen zurück.

Was Sie wissen sollten:

- Eine Sicherung wird **nur behalten, wenn sich seit der letzten etwas geändert hat**. So verdrängt eine leere
  Datenbank nach einem Datenverlust nicht die guten, alten Sicherungen. Anmeldungen und Sitzungen zählen dabei nicht als
  Änderung, nur echte Inhalte. Automatische Sicherungen erscheinen im Aktivitätsprotokoll, auch wenn sie übersprungen
  wurden („keine Änderung“) oder fehlgeschlagen sind.
- Jede Sicherung wird nach dem Anlegen geprüft. Eine fehlerhafte wird verworfen.
- Der Zeitplan rechnet in der Zeitzone des Rechners, auf dem Vitafolio läuft (im Container die Einstellung `TZ`).

## 11.2 Die Wochenvorschau

Der Bereich „Die nächsten 7 Tage“ zeigt, wann in der nächsten Woche gesichert wird (siehe Abbildung 14). Jede Zeile ist ein
Tag, jeder Strich eine geplante Sicherung, daneben stehen die genauen Uhrzeiten. Die Vorschau ändert sich live, während
Sie den Zeitplan bearbeiten. Solange Sie nicht gespeichert haben, steht dort „Vorschau, nicht gespeichert“.

Darunter stehen die Zeitzone und der Sicherungsordner.

![Die Wochenvorschau](bilder/vorschau.png)

## 11.3 Sicherungen ansehen, machen, herunterladen, hochladen

Der Bereich „Sicherungen“ zeigt alle Sicherungen, die neueste zuerst (siehe Abbildung 15). Jede hat einen Zeitpunkt, eine
**Art** und eine Größe. Die Arten sind:

| Art | Bedeutung |
|---|---|
| Beim Start | automatisch beim Start gemacht |
| Vor dem Beenden | automatisch beim Beenden gemacht |
| Nach Zeitplan | automatisch nach Ihrem Zeitplan gemacht |
| Von Hand | per Knopf „Jetzt sichern“ gemacht |
| Vor Wiederherstellung | die Sicherheitskopie, die Vitafolio vor jeder Wiederherstellung anlegt |
| Hochgeladen | von Ihnen hochgeladen |

Darüber stehen drei Knöpfe (in der Abbildung nummeriert):

1. **Jetzt sichern:** macht sofort eine Sicherung. Hat sich seit der letzten nichts geändert, sagt Vitafolio das freundlich
   und legt keine neue an.
2. **Aktuellen Stand herunterladen:** macht erst eine frische Sicherung und lädt sie dann als Datei herunter.
3. **Sicherung hochladen:** nimmt eine Sicherungsdatei von Ihrem Computer entgegen (bis 512 MB).

In jeder Zeile gibt es **Herunterladen** und **Wiederherstellen**.

![Sicherungen: Liste und Knöpfe](bilder/sicherungen.png)

**Herunterladen:** Die Datei heißt zum Beispiel `vitafolio-backup-2026-11-04-0200.db`. Sie enthält die Daten **aller Konten**,
auch die geschützten Passwörter. Bewahren Sie sie sicher auf. In der Docker-Version fragt Vitafolio deshalb vorher nach
Ihrem **aktuellen Passwort** (und dem Zwei-Faktor-Code, falls bei Ihnen eingeschaltet).

**Hochladen:** Vitafolio prüft die Datei: Es muss eine unbeschädigte Sicherung **dieser App** sein, und sie darf nicht
aus einer neueren Version stammen. Auch hier fragt die Docker-Version nach Passwort und Code. Danach steht sie als
„Hochgeladen“ in der Liste. Wiederhergestellt wird erst, wenn Sie es dort auslösen. Hochgeladene Sicherungen werden
**nie automatisch gelöscht**.

## 11.4 Eine Sicherung wiederherstellen

Beim Wiederherstellen ersetzen Sie die jetzigen Daten durch den Stand einer Sicherung.

1. Klicken Sie in der Zeile der gewünschten Sicherung auf **Wiederherstellen**.
2. Lesen Sie, was passiert (siehe Abbildung 16).
3. Geben Sie in der Docker-Version Ihr aktuelles Passwort ein (und den Code, falls nötig).
4. Klicken Sie auf **Wiederherstellen**.

![Eine Sicherung wiederherstellen](bilder/wiederherstellen.png)

Das passiert dabei:

- Der **jetzige Stand wird vorher selbst als Sicherung gespeichert** („Vor Wiederherstellung“). Sie können ihn also
  zurückholen.
- Alles, was nach der Sicherung entstanden ist, ist danach nicht mehr in der laufenden App.
- In der Docker-Version werden **alle abgemeldet** und müssen sich neu anmelden. Sie landen auf der Anmeldeseite. Im
  Windows-Programm lädt sich das Fenster neu.
- Die Einstellungen der Datensicherung selbst kommen ebenfalls aus der Sicherung.

Für kurze Zeit antwortet Vitafolio mit „Die App wird gerade gewartet“. Warten Sie einen Moment.

Misslingt die Wiederherstellung, wird der Stand von vorher automatisch zurückgeschrieben. Sie sehen dann die Meldung
„Die Wiederherstellung ist fehlgeschlagen. Die laufende App wurde nicht verändert; der vorherige Stand ist als Sicherung
„Vor Wiederherstellung“ gespeichert. Einzelheiten stehen im Protokoll des Servers.“

## 11.5 Umzug auf einen anderen Rechner

Eine Sicherungsdatei enthält Ihre Daten, aber **nicht die geheimen Schlüssel** im Unterordner `keys` des Datenordners.
Das betrifft die Zwei-Faktor-Anmeldung der Docker-Version.

- Spielen Sie die Sicherung in einen **neuen, leeren Datenordner** ein, ohne den Ordner `keys` mitzunehmen, kann
  Vitafolio die Codes aus der Authenticator-App nicht mehr prüfen. Sie sehen dann die Meldung „Der Schlüssel der
  Zwei-Faktor-Anmeldung kann nicht gelesen werden. Lassen Sie sie vom Administrator zurücksetzen und richten Sie sie neu ein.“
- Die **Wiederherstellungscodes** funktionieren weiter, und ein Administrator kann die Zwei-Faktor-Anmeldung eines Kontos
  zurücksetzen (Abschnitt 10.3).
- Am einfachsten ist es, beim Umzug den ganzen Datenordner mitzunehmen.

Bei einer Wiederherstellung im selben Datenordner auf demselben Rechner spielt das keine Rolle.

## 11.6 Wo liegen die Sicherungen?

Im **Sicherungsordner**, den Sie in Abbildung 14 sehen. Er hat Unterordner: `recent` (die neuesten Sicherungen), `daily`
(je eine pro Tag) und `uploaded` (hochgeladene). Die Dateien heißen zum Beispiel `app-20261104-020000-scheduled.db`
(Datum, Uhrzeit, Art).

Vitafolio löscht beim Aufräumen nur Dateien mit diesem Namensmuster. Alles andere im Ordner lässt es in Ruhe. Beachten Sie:
Der Ordner `recent` zählt alle Arten gleich. Auch die Sicherheitskopie „Vor Wiederherstellung“ wird irgendwann aufgeräumt,
wenn viele neuere Sicherungen dazukommen. Wollen Sie eine Sicherung dauerhaft behalten, laden Sie sie herunter.

# 12 Das Windows-Programm im Alltag

Das Windows-Programm unterscheidet sich in diesen Punkten von der Docker-Version:

- **Keine Anmeldung.** Das Windows-Konto schützt Ihre Daten. Wer an Ihrem Windows-Konto sitzt, kann Vitafolio öffnen.
  In der Seitenleiste steht „Lokales Konto“. Als Anzeigename verwendet Vitafolio Ihren Windows-Benutzernamen.
- **Kein Abmelden, keine Benutzer, kein Protokoll, keine Zwei-Faktor-Anmeldung.** Es gibt auch keine App-Administration.
- **Die Einstellungen** haben zwei Reiter: „Darstellung“ und „Datensicherung“.
- **Die Datensicherung** funktioniert wie in Kapitel 11, aber **ohne Passwort-Abfrage**. Sie läuft nur, solange das Programm
  geöffnet ist. Verpasstes holt es beim nächsten Start nach, wenn Sie das nicht ausgeschaltet haben.
- **Beenden:** Wenn Sie das Fenster schließen, sehen Sie kurz „Wird beendet – die Datensicherung läuft …“. Warten Sie, bis
  das Fenster verschwindet. Dabei wird noch einmal gesichert. Fährt Windows herunter, während Vitafolio offen ist,
  wartet das Programm nur kurz (höchstens 5 Sekunden) auf diese letzte Sicherung.
- **Nur Ihr PC:** Das Programm ist von keinem anderen Gerät im Netzwerk erreichbar. Andere Programme auf Ihrem PC können
  nicht auf Ihre Daten zugreifen.
- **Links:** Ein Link auf eine andere Webseite öffnet sich im Standardbrowser, nicht im Programmfenster.
- **Kleinste Fenstergröße:** 1024 × 700. Größe und Lage des Fensters merkt sich das Programm.

**Wo liegen Ihre Daten?** In einem Ordner auf Ihrem PC:

`%LOCALAPPDATA%\SushiFlux Develop\Vitafolio`

Dieser Ordner liegt **getrennt vom Programm**. Deshalb bleiben Ihre Daten beim Deinstallieren und beim Neuinstallieren
erhalten.

Den Ordner öffnen Sie so:

1. Drücken Sie die Windows-Taste und die Taste R gleichzeitig.
2. Geben Sie `%LOCALAPPDATA%\SushiFlux Develop\Vitafolio` ein und drücken Sie die Eingabetaste.

Im Ordner liegen die Datenbank, die geheimen Schlüssel (`keys`), die Sicherungen (`backups`) und Programm-Protokolle.
Löschen oder verändern Sie dort nichts von Hand, solange Sie die Daten behalten wollen. Kopieren Sie den Ordner nicht,
während das Programm läuft. Laden Sie stattdessen in der App eine Sicherung herunter (Kapitel 11). Wollen Sie alle Daten
**endgültig löschen**, beenden Sie Vitafolio und löschen Sie diesen Ordner.

# 13 Probleme lösen

## 13.1 Fehlermeldungen kopieren

Vitafolio zeigt Fehlermeldungen **vollständig** und in verständlichen Worten (siehe Abbildung 17). Jede Meldung hat einen
Knopf **Kopieren**. Er kopiert die ganze Meldung mit den technischen Einzelheiten, dem Fehlercode, der Programmversion
und der Zeit. Fügen Sie den Text in Ihre Nachricht ein, wenn Sie Hilfe suchen. Mit „Details“ klappen Sie die technischen
Einzelheiten auf.

![Eine Fehlermeldung mit Kopieren-Knopf](bilder/fehlermeldung.png)

## 13.2 Häufige Probleme

| Was Sie sehen | Ursache | Was Sie tun |
|---|---|---|
| Im Browser erscheint statt der App eine kurze Textmeldung auf Englisch: „This server is not reachable under this host name. The operator can allow it with the setting ALLOWED_HOSTS.“ | Sie rufen Vitafolio unter einem Namen auf, der nicht in `ALLOWED_HOSTS` steht. | Tragen Sie den Namen in `ALLOWED_HOSTS` ein (Abschnitt 4.6) und starten Sie den Container neu. Mit der IP-Adresse des Servers geht es immer. Im Protokoll steht die Zeile „Anfrage mit nicht erlaubtem Hostnamen … abgewiesen“. |
| „Benutzername oder Passwort ist falsch.“ | Eingabe falsch. Vitafolio verrät absichtlich nicht, was davon. | Prüfen Sie beides. Achten Sie auf Tastaturbelegung und Feststelltaste. |
| „Zu viele Versuche. Bitte in … Sekunden noch einmal probieren.“ | Zu viele Anmeldungen oder Codes in kurzer Zeit von derselben Adresse. Das ist eine Schutzbremse. Standard: 10 Anmeldungen pro Minute. | Warten Sie die genannte Zeit. Hinter einem Reverse-Proxy: Prüfen Sie `TRUSTED_PROXIES` (Abschnitt 4.6), sonst zählen alle Besucher gemeinsam. |
| „Dieses Konto ist gesperrt. Wenden Sie sich an den Administrator.“ | Ein Administrator hat das Konto gesperrt. | Bitten Sie einen Administrator, es wieder zu aktivieren (Abschnitt 10.3). |
| „Der Code ist falsch oder wurde schon verwendet.“ | Falscher Code, oder ein alter Code. | Prüfen Sie die Uhrzeit auf Ihrem Handy: Sie muss stimmen. Geben Sie den aktuellen Code ein. Oder benutzen Sie einen Wiederherstellungscode. |
| „Dieser Code wurde schon verwendet. Warten Sie auf den nächsten Code der App oder nehmen Sie einen Wiederherstellungscode.“ | Der Code war richtig, aber Sie haben ihn gerade schon benutzt. Jeder Code gilt nur einmal. | Warten Sie bis zu 30 Sekunden auf den nächsten Code der App oder nehmen Sie einen Wiederherstellungscode. |
| „Der Schlüssel der Zwei-Faktor-Anmeldung kann nicht gelesen werden. …“ | Die Sicherung wurde in einen neuen Datenordner eingespielt, ohne den Ordner `keys` (Abschnitt 11.5). | Melden Sie sich mit einem Wiederherstellungscode an oder lassen Sie die Zwei-Faktor-Anmeldung von einem Administrator zurücksetzen. |
| „Die Anmeldung ist abgelaufen. Bitte beginnen Sie noch einmal mit Benutzername und Passwort.“ | Der zweite Schritt dauerte länger als 5 Minuten oder hatte mehr als 5 Versuche. | Melden Sie sich neu an. |
| Handy und Wiederherstellungscodes verloren | – | Bitten Sie einen Administrator, Ihre Zwei-Faktor-Anmeldung zurückzusetzen (Abschnitt 10.3). |
| Passwort vergessen | – | Ein anderer Administrator setzt Ihnen ein neues Passwort (Abschnitt 10.3). Für den **einzigen** Administrator gibt es in dieser Version keinen Weg in der App. Notieren Sie das Passwort darum sicher. |
| „Die Registrierung ist geschlossen. Bitten Sie den Administrator um ein Konto.“ | Registrierung ist aus. | Lassen Sie sich ein Konto anlegen. |
| „Die Zwei-Faktor-Anmeldung muss zuerst eingerichtet werden.“ | Der Administrator verlangt sie für alle. | Richten Sie sie ein (Abschnitt 8.2). Vorher geht nichts anderes. |
| „Die Anfrage wurde aus Sicherheitsgründen abgelehnt. Bitte laden Sie die Seite neu.“ | Die Seite war alt oder wurde von einer fremden Seite aufgerufen. | Laden Sie die Seite neu. |
| „Der Server ist nicht erreichbar. Prüfen Sie die Verbindung und versuchen Sie es noch einmal.“ | Vitafolio läuft nicht, oder die Verbindung ist weg. | Prüfen Sie, ob der Container läuft, und die Verbindung zum Server. |
| „Die App wird gerade gewartet (z. B. wird eine Sicherung wiederhergestellt).“ | Eine Wiederherstellung läuft. | Warten Sie einen Moment und versuchen Sie es noch einmal. |
| Beim Hochladen: „Die Datei ist keine gültige Sicherung dieser App.“ | Es ist keine Sicherungsdatei von Vitafolio oder sie ist beschädigt. | Wählen Sie eine Datei, die Sie aus Vitafolio heruntergeladen haben. |
| Beim Hochladen oder Wiederherstellen: „Diese Sicherung stammt aus einer neueren Version der App und kann hier nicht wiederhergestellt werden.“ | Die Sicherung wurde mit einer neueren Vitafolio-Version gemacht. | Aktualisieren Sie zuerst Vitafolio. |
| „Die Datei ist zu groß: … (erlaubt sind höchstens 512 MB).“ | Die Sicherung ist größer als 512 MB. | – (diese Grenze gilt für das Hochladen). |
| „Passwort oder Code stimmt nicht. Es wurde nichts verändert.“ | Bei einer Sicherung (Herunterladen, Hochladen, Wiederherstellen) war Ihre Bestätigung falsch. | Geben Sie Ihr aktuelles Passwort und, falls eingeschaltet, einen frischen Code ein. |

## 13.3 Probleme beim Start im Container

Diese Meldungen stehen im Protokoll des Containers (auf Unraid: Symbol „Logs“ beim Container). Sie sind deutsch.

| Meldung (Anfang) | Was sie bedeutet | Was Sie tun |
|---|---|---|
| „Kein Schreibzugriff auf den Datenordner …“ | Der Datenordner gehört einem anderen Benutzer. | Prüfen Sie `PUID` und `PGID` (Abschnitt 4.5) und den Ordner, den Sie eingebunden haben. |
| „Der Datenordner … ist eine Datei und kein Ordner.“ | Der Pfad zeigt auf eine Datei. | Binden Sie einen Ordner ein. |
| „PUID=0 (root) ist nicht erlaubt …“ | `PUID` steht auf 0. | Setzen Sie eine normale Nummer (Unraid: 99). |
| „ALLOWED_HOSTS: … ist kein gültiger Hostname“ oder „TRUSTED_PROXIES: … ist keine gültige IP-Adresse“ | Tippfehler in der Einstellung. | Schreiben Sie nur Namen ohne `http://` und ohne Port, bzw. gültige IP-Adressen oder Netze. |
| „Datenbankprüfung (integrity_check) … fehlgeschlagen … Der Server startet nicht; nichts wurde verändert. Bitte eine Sicherung wiederherstellen.“ | Die Datenbank-Datei ist beschädigt. Vitafolio ändert in diesem Fall nichts. | Siehe unten. |

**Datenbank beschädigt:** Vitafolio startet nicht und verändert nichts. Die Sicherungsdateien liegen im Sicherungsordner
(Unterordner `recent`, `daily`, `uploaded`) und sind gewöhnliche SQLite-Dateien. Für den Notfall:

1. Stoppen Sie den Container.
2. Sichern Sie den ganzen Datenordner an einen anderen Ort.
3. Löschen Sie im Datenordner die Dateien `app.db`, `app.db-wal` und `app.db-shm`.
4. Kopieren Sie die gewünschte Sicherung in den Datenordner und nennen Sie sie `app.db`.
5. Starten Sie den Container. Die Datenbank wird beim Start auf den neuesten Stand gebracht.
<!-- Schlusslauf: Notfall-Handgriff (Schritte 3 bis 5) mit einer echten Sicherung ausprobieren und bestätigen; bisher nur aus dem Code abgeleitet. -->

## 13.4 Probleme im Windows-Programm

| Was Sie sehen | Was Sie tun |
|---|---|
| Das Fenster „WebView2 fehlt“. Es sagt, dass Vitafolio die „Microsoft Edge WebView2 Runtime“ braucht. | Klicken Sie auf „Download-Seite öffnen“, laden Sie dort den „Evergreen Bootstrapper“ von Microsoft herunter und installieren Sie ihn. Starten Sie Vitafolio danach neu. |
| „Vitafolio konnte nicht gestartet werden“ mit dem Zusatz „Der interne Server des Programms konnte nicht gestartet werden.“ | Klicken Sie auf „Kopieren“ und heben Sie den Text auf. Zu den häufigsten Gründen gehört ein Datenordner, in den Ihr Windows-Konto nicht schreiben darf. Starten Sie das Programm neu. |
| „Die Anzeige wurde beendet“ | Der Anzeige-Teil (WebView2) wurde unerwartet beendet. Starten Sie Vitafolio neu. Ihre Daten sind nicht betroffen. |
| Windows warnt vor dem Start (SmartScreen) | Siehe Abschnitt 3.2. |

Das Programm schreibt ein Protokoll in seinen Datenordner (Unterordner `logs`). Seine Meldungen erscheinen in der
Sprache Ihres Windows: Englisch, wenn Windows Englisch ist, sonst Deutsch.

# 14 Datenschutz

Vitafolio sendet **keine Daten an den Hersteller**. Es gibt keine Nutzungsstatistik und keine Fernüberwachung. Die App
lädt auch keine Schriften oder Programmteile aus dem Internet nach: Alles kommt von Vitafolio selbst.

**Was wo gespeichert wird:**

| Was | Wo |
|---|---|
| Konten (Benutzername, Anzeigename, Rolle, Passwort) | im Datenordner. Das Passwort wird nie im Klartext gespeichert, nur als Prüfwert (Hash). |
| Ihre Wahl von Farbschema und Sprache | im Browser und in Ihrem Konto |
| Zwei-Faktor-Geheimnis | verschlüsselt in der Datenbank. Die Schlüssel dazu liegen im Ordner `keys`. |
| Wiederherstellungscodes | nur als Prüfwerte, nicht lesbar |
| Angemeldete Geräte | Name des Browsers, IP-Adresse, Zeiten, im Datenordner. Beendete oder abgelaufene Sitzungen werden nach 30 Tagen gelöscht. |
| Aktivitätsprotokoll | im Datenordner: wer, wann, was, von welcher IP-Adresse |
| Sicherungen | im Sicherungsordner. Sie enthalten alle Daten aller Konten. |
| Windows-Programm: Fensterprofil, Fensterlage, Programm-Protokoll | im Datenordner auf Ihrem PC |

**Cookies:** Die Docker-Version benutzt zwei kleine Textmarken (Cookies), die Ihre Anmeldung halten. Der Browser sendet sie
bei jeder Anfrage selbst mit. Skripte der Seite können sie nicht lesen, und sie gehen nur an Vitafolio. Das
Windows-Programm benutzt statt dessen eine Marke, die bei jedem Start neu erzeugt wird und nur zwischen Fenster und
Programm besteht.

**Wer sieht was?** Ein Administrator sieht die Konten, das Aktivitätsprotokoll und die Sicherungen. Mit den Sicherungen
liegen aber alle Daten offen. Geben Sie die Administrator-Rolle deshalb nur an Personen, denen Sie vertrauen.

**Löschen:** Ein gelöschtes Konto verschwindet mit seinen Daten aus der Datenbank. In älteren Sicherungen steckt es noch.
Wollen Sie wirklich alles loswerden, löschen Sie auch die Sicherungen und den Datenordner (im Windows-Programm der Ordner
aus Kapitel 12).

# 15 Begriffe

| Begriff | Bedeutung |
|---|---|
| Administrator | Konto, das andere Konten und die Einstellungen der App verwaltet. Das erste Konto wird automatisch Administrator. |
| Authenticator-App | App auf dem Handy, die alle 30 Sekunden einen sechsstelligen Code erzeugt. |
| Container | Abgeschlossenes Paket, in dem ein Programm samt allem Nötigen läuft (Docker). |
| Datenordner | Ordner, in dem Datenbank, Schlüssel und (standardmäßig) Sicherungen liegen. |
| Docker | Technik, Programme in Containern zu betreiben. |
| HTTPS | Verschlüsselte Verbindung zwischen Browser und Server. Erkennbar am Schloss in der Adresszeile. |
| Open Source | Der Quelltext ist öffentlich; jeder darf das Programm einsehen und nutzen. |
| Reverse-Proxy | Vorgeschalteter Dienst, der Anfragen aus dem Internet annimmt, verschlüsselt und an Vitafolio weiterreicht. |
| Sicherung | Kopie Ihrer Daten, mit der Sie sie wiederherstellen können. |
| Umgebungsvariable | Benannter Wert, den man einem Programm oder Container beim Start mitgibt. |
| Wiederherstellungscode | Notfall-Code für die Anmeldung, wenn das Handy nicht da ist. Jeder gilt nur einmal. |
| Zwei-Faktor-Anmeldung | Zum Passwort kommt ein zweiter Nachweis, zum Beispiel ein Code aus einer App. |
