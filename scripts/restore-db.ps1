<#
  Restores a backup into the DEVELOPMENT database (.data\app.db). Windows PowerShell 5.1 compatible (needs Node for the database helper
  scripts\sqlite-tool.ts), console output is German and ASCII-only.

  .\scripts\restore-db.ps1                      lists the backups (.backups\auto\recent, daily, uploaded) and asks which one to restore
  .\scripts\restore-db.ps1 -List                only list them
  .\scripts\restore-db.ps1 -Backup <name|path|number|latest>
  .\scripts\restore-db.ps1 -Backup latest -Offline      never use the server, even when it runs (it must be stopped then)

  Server running: the server's own restore function is used (the same as the "Wiederherstellen" button): the script signs in as an
  administrator (asks for the user name, the password and, if turned on, the 2FA code - twice: the restore step needs a fresh code), the server makes the safety backup of the current
  state itself (kind "pre-restore"), restores, rotates the signing key and ends every session.
  Server stopped: the script makes the safety backup itself (.backups\auto\recent\app-<time>-pre-restore.db, SQLite online backup),
  replaces the database with SQLite's online backup API, ends every session, removes the token signing key (a new one is created at
  the next start) and writes an activity log entry. A backup from a newer schema than the database is refused (-Force overrides).
  Before and after, the row counts of every table are shown; the restored counts are compared with the backup's.
  -Yes skips the confirmation question. For automation the administrator sign-in of the server path can come from the environment
  variables CV_RESTORE_USER, CV_RESTORE_PASSWORD, CV_RESTORE_CODE (sign-in 2FA code) and CV_RESTORE_STEPUP_CODE (a fresh 2FA code for
  the restore step: a used code cannot be replayed).
#>
param(
    [string]$Backup,
    [switch]$List,
    [switch]$Offline,
    [switch]$Force,
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'dev-common.ps1')
Set-Location $script:RootDir

$serverPort = [int]$Ports['backend']
$baseUrl = "http://127.0.0.1:$serverPort"
$dataDir = Join-Path $RootDir '.data'
$database = Join-Path $dataDir 'app.db'
$backupRoot = Join-Path $RootDir '.backups\auto'
$tool = Join-Path $PSScriptRoot 'sqlite-tool.ts'

function Invoke-Tool([string[]]$Arguments) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $output = @(& node $tool @Arguments 2>&1 | ForEach-Object { "$_" }); $code = $LASTEXITCODE }
    finally { $ErrorActionPreference = $previous }
    return [pscustomobject]@{ Code = $code; Output = $output }
}

function Get-Counts([string]$File) {
    $result = Invoke-Tool @('counts', $File)
    if ($result.Code -ne 0) { throw "Zeilenzahlen von '$File' nicht lesbar: $($result.Output -join ' ')" }
    return ($result.Output[-1] | ConvertFrom-Json)
}

function Show-Counts([string]$Title, $Counts) {
    Write-Host "   $Title" -ForegroundColor Cyan
    foreach ($property in $Counts.PSObject.Properties) { Write-Host ('     {0,-24} {1,8}' -f $property.Name, $property.Value) }
}

function Get-AvailableBackups {
    $files = foreach ($tier in 'recent', 'daily', 'uploaded') {
        Get-ChildItem -LiteralPath (Join-Path $backupRoot $tier) -Filter 'app-*.db' -ErrorAction SilentlyContinue | ForEach-Object {
            [pscustomobject]@{ Tier = $tier; Name = $_.Name; Path = $_.FullName; Time = $_.LastWriteTime; Size = $_.Length }
        }
    }
    return @($files | Sort-Object Time -Descending)
}

function Show-Backups($Backups) {
    if ($Backups.Count -eq 0) { Write-Host "   Keine Sicherungen in $backupRoot." -ForegroundColor Yellow; return }
    for ($i = 0; $i -lt $Backups.Count; $i++) {
        $b = $Backups[$i]
        Write-Host ('   {0,3}  {1:yyyy-MM-dd HH:mm:ss}  {2,8:N0} KB  {3,-8} {4}' -f ($i + 1), $b.Time, ($b.Size / 1KB), $b.Tier, $b.Name)
    }
}

function Resolve-Backup($Backups) {
    $choice = $Backup
    if (-not $choice) {
        Show-Backups $Backups
        $choice = Read-Host 'Nummer der Sicherung (oder Name/latest, Enter = Abbruch)'
        if (-not $choice) { return $null }
    }
    if ($choice -eq 'latest') { return $Backups[0] }
    if ($choice -match '^\d+$' -and [int]$choice -ge 1 -and [int]$choice -le $Backups.Count) { return $Backups[[int]$choice - 1] }
    $byName = @($Backups | Where-Object { $_.Name -eq $choice -or $_.Path -eq $choice })
    if ($byName.Count -gt 0) { return $byName[0] }
    if (Test-Path -LiteralPath $choice) {
        $item = Get-Item -LiteralPath $choice
        return [pscustomobject]@{ Tier = 'extern'; Name = $item.Name; Path = $item.FullName; Time = $item.LastWriteTime; Size = $item.Length }
    }
    throw "Sicherung '$choice' nicht gefunden (Name, Pfad, Nummer oder latest)."
}

function Read-PlainPassword([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Invoke-Api([string]$Method, [string]$Path, $Body, $Session) {
    $arguments = @{ Method = $Method; Uri = "$baseUrl$Path"; WebSession = $Session; Headers = @{ 'X-Cv-Request' = '1' }; TimeoutSec = 120 }
    if ($null -ne $Body) { $arguments.Body = ($Body | ConvertTo-Json -Compress); $arguments.ContentType = 'application/json' }
    try { return (Invoke-RestMethod @arguments) }
    catch {
        $detail = $_.ErrorDetails.Message
        if (-not $detail) { $detail = $_.Exception.Message }
        throw "Der Server hat die Anfrage $Method $Path abgelehnt: $detail"
    }
}

# Restore through the running server's own function (administrator password, optional 2FA code).
function Restore-ThroughServer($Chosen) {
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $bootstrap = Invoke-RestMethod -Uri "$baseUrl/api/bootstrap" -TimeoutSec 10
    if ($bootstrap.mode -ne 'server') { throw 'Der laufende Server ist im Programm-Modus (ohne Anmeldung); bitte mit -Offline arbeiten (Programm beenden).' }
    $user = if ($env:CV_RESTORE_USER) { $env:CV_RESTORE_USER } else { Read-Host 'Administrator (Benutzername)' }
    $password = if ($env:CV_RESTORE_PASSWORD) { $env:CV_RESTORE_PASSWORD } else { Read-PlainPassword 'Passwort' }
    $login = Invoke-Api 'POST' '/api/auth/login' @{ username = $user; password = $password } $session
    $twoFactor = [bool]$login.twoFactorRequired
    if ($twoFactor) {
        $loginCode = if ($env:CV_RESTORE_CODE) { $env:CV_RESTORE_CODE } else { Read-Host '2FA-Code fuer die Anmeldung (oder Wiederherstellungscode)' }
        $null = Invoke-Api 'POST' '/api/auth/login/2fa' @{ challengeId = $login.challengeId; code = $loginCode } $session
    }
    $entries = @(Invoke-Api 'GET' '/api/admin/backups' $null $session)
    $entry = $entries | Where-Object { $_.file -eq $Chosen.Name } | Select-Object -First 1
    if (-not $entry) { throw "Der Server kennt die Sicherung '$($Chosen.Name)' nicht (nicht in seinem Sicherungsordner). Server beenden und mit -Offline wiederholen." }
    $body = @{ password = $password }
    if ($twoFactor) {
        # A used code cannot be replayed (a time step counts once, a recovery code works once): the step-up needs a fresh one
        if ($env:CV_RESTORE_STEPUP_CODE) { $stepUpCode = $env:CV_RESTORE_STEPUP_CODE }
        else {
            Write-Warn 'Der Code der Anmeldung kann nicht noch einmal benutzt werden. Bitte auf den naechsten Code der Authenticator-App warten (ca. 30 Sekunden).'
            $stepUpCode = Read-Host 'Neuer 2FA-Code fuer die Wiederherstellung'
        }
        $body.code = $stepUpCode
    }
    Write-Step 'Der Server stellt wieder her (Sicherheitskopie, Wiederherstellung, alle Anmeldungen enden)...'
    try { $null = Invoke-Api 'POST' "/api/admin/backups/$($entry.id)/restore" $body $session }
    catch {
        if ($_.Exception.Message -match 'twofactor\.code_already_used') {
            throw "$($_.Exception.Message) Hinweis: Dieser 2FA-Code wurde schon benutzt. Bitte den Befehl wiederholen und den naechsten Code der Authenticator-App abwarten (ca. 30 Sekunden); ein Wiederherstellungscode gilt nur einmal."
        }
        throw
    }
}

function Restore-Offline($Chosen) {
    if (Get-JsonOrNull "$baseUrl/api/health") { throw 'Der Server laeuft noch. Entweder ohne -Offline arbeiten (Wiederherstellung ueber den Server) oder zuerst .\start.ps1 stop.' }
    foreach ($port in @([int]$Ports['desktop-backend'])) {
        if ((Get-PortListener $port).Count -gt 0) { throw "Das Windows-Programm laeuft noch (Port $port). Bitte zuerst beenden (.\start.ps1 stop)." }
    }
    if (Test-Path -LiteralPath $database) {
        $timestamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
        $safetyDir = Join-Path $backupRoot 'recent'
        New-Item -ItemType Directory -Force -Path $safetyDir | Out-Null
        $safety = Join-Path $safetyDir "app-$timestamp-pre-restore.db"
        Write-Step "Sicherheitskopie des aktuellen Stands: $safety"
        $result = Invoke-Tool @('snapshot', $database, $safety)
        if ($result.Code -ne 0) { throw "Die Sicherheitskopie ist fehlgeschlagen, es wurde nichts geaendert: $($result.Output -join ' ')" }
    }
    else { Write-Warn 'Es gibt noch keine Datenbank - keine Sicherheitskopie noetig.' }
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    Write-Step 'Stelle wieder her (SQLite-Online-Backup)...'
    $arguments = @('restore', $Chosen.Path, $database)
    if ($Force) { $arguments += '--force' }
    $result = Invoke-Tool $arguments
    if ($result.Code -ne 0) { throw "Wiederherstellung fehlgeschlagen (Code $($result.Code)): $($result.Output -join ' ')" }
    # A new token signing key is created at the next start: every sign-in ends
    Remove-Item -LiteralPath (Join-Path $dataDir 'keys\jwt-signing.key') -Force -ErrorAction SilentlyContinue
}

try {
    $backups = @(Get-AvailableBackups)
    if ($List) { Show-Backups $backups; return }
    if ($backups.Count -eq 0 -and -not ($Backup -and (Test-Path -LiteralPath $Backup))) { Show-Backups $backups; return }
    $chosen = Resolve-Backup $backups
    if (-not $chosen) { Write-Host 'Abgebrochen.'; return }

    Write-Host "Stelle $($chosen.Name) wieder her ($($chosen.Time.ToString('yyyy-MM-dd HH:mm:ss')), $($chosen.Tier))." -ForegroundColor Cyan
    $serverRuns = [bool](Get-JsonOrNull "$baseUrl/api/health")
    if ($serverRuns -and $Offline) { throw 'Der Server laeuft - -Offline geht nur bei gestopptem Server (.\start.ps1 stop).' }

    $before = if (Test-Path -LiteralPath $database) { Get-Counts $database } else { $null }
    $expected = Get-Counts $chosen.Path
    if ($before) { Show-Counts 'Zeilen vorher (aktueller Stand):' $before }
    Show-Counts 'Zeilen in der Sicherung:' $expected

    if (-not $Yes) {
        $answer = Read-Host 'Der aktuelle Stand wird ersetzt (vorher wird eine Sicherheitskopie angelegt). Fortfahren? (ja/nein)'
        if ($answer -notin @('ja', 'j', 'yes', 'y')) { Write-Host 'Abgebrochen.'; return }
    }

    if ($serverRuns) { Restore-ThroughServer $chosen } else { Restore-Offline $chosen }

    $after = Get-Counts $database
    Show-Counts 'Zeilen nachher (wiederhergestellter Stand):' $after
    # The server's restore and the offline restore may add one activity log entry; every other table must match the backup exactly
    $differences = @()
    foreach ($property in $expected.PSObject.Properties) {
        if ($property.Name -in @('activity_log', 'sessions', 'refresh_tokens')) { continue }
        $now = $after.PSObject.Properties[$property.Name]
        if (-not $now -or $now.Value -ne $property.Value) { $differences += $property.Name }
    }
    if ($differences.Count -eq 0) { Write-Host 'Zeilenzahlen stimmen mit der Sicherung ueberein (Protokoll und Sitzungen ausgenommen).' -ForegroundColor Green }
    else { Write-Warn "Abweichende Tabellen gegenueber der Sicherung: $($differences -join ', ') (eine aeltere Sicherung wird beim Start auf das aktuelle Schema gehoben)." }
    Write-Host 'Fertig. Alle Anmeldungen sind beendet. Falls der Server gestoppt war: .\start.ps1' -ForegroundColor Green
}
catch {
    Write-Host ''
    Write-Host "Fehler: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
