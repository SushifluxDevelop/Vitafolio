<#
  One script for the development environment (dev) and the live profile on this PC (live). Windows PowerShell 5.1 compatible,
  console output is German and ASCII-only.

  .\start.ps1                    start (default): the server (dotnet watch) and the web UI dev server (Vite) run as hidden background
                                 processes; their PIDs are in .run\, their output in .logs\. The command returns when both answer.
  .\start.ps1 stop               end everything cleanly: the server gets a graceful stop first (its backup before shutdown runs),
                                 then the whole process trees are ended. The database in .data\ stays.
  .\start.ps1 restart            stop + start
  .\start.ps1 status             state of the processes, the ports, the version, the database and the backups
  .\start.ps1 logs [service]     follow a log: server | frontend (dev, default server) | desktop | desktop-frontend | live

  -Desktop                       the Windows program instead of the browser setup: Vite on its own port plus the program in development
                                 mode (window and dialogs open on the monitor named in dev.local.json "devMonitor", without taking the
                                 focus). "stop -Desktop" ends only this part, a plain "stop" ends everything.
  -Env live                      the container of docker-compose.yml (Compose project vitafolio-live): "start" builds the image and runs
                                 it, "stop" ends it (the data volume stays), "status" and "logs" look at it.

  Data (dev): .data\ (database, keys). Backups (dev): .backups\auto - the server makes them itself (at start, on a schedule, when it stops
  cleanly). Restore: .\scripts\restore-db.ps1.
  Ports are fixed (the defaults in scripts\dev-common.ps1, optionally overridden by a local file): a busy port stops the start with a message that names the
  occupying process or container - it is never replaced by another one.
#>
param(
    [Parameter(Position = 0)][ValidateSet('start', 'stop', 'restart', 'status', 'logs')][string]$Command = 'start',
    [Parameter(Position = 1)][string]$Service,
    [ValidateSet('dev', 'live')][string]$Env = 'dev',
    [switch]$Desktop
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'scripts\dev-common.ps1')
Set-Location $script:RootDir

$Product = $script:ProductName
$ServerPort = [int]$Ports['backend']
$FrontendPort = [int]$Ports['frontend']
$DesktopServerPort = [int]$Ports['desktop-backend']
$DesktopFrontendPort = [int]$Ports['desktop-frontend']
$LivePort = [int]$Ports['live-http']
$DataDir = Join-Path $RootDir '.data'
$BackupDir = Join-Path $RootDir '.backups\auto'
$ComposePrefix = 'vitafolio-live'

# ======================================================================================================================================
# development
# ======================================================================================================================================

function Initialize-Repository {
    if (Test-Path -LiteralPath (Join-Path $RootDir '.git')) {
        $null = Invoke-Native 'git' @('config', 'core.hooksPath', 'scripts/git-hooks') -Quiet -AllowFail
    }
    New-Item -ItemType Directory -Force -Path $RunDir, $LogDir, $DataDir, $BackupDir | Out-Null
}

function Initialize-Frontend {
    if (-not (Test-Path -LiteralPath (Join-Path $RootDir 'frontend\node_modules'))) {
        Write-Step 'Installiere die Abhaengigkeiten der Oberflaeche (npm ci)...'
        $null = Invoke-Native 'npm.cmd' @('ci', '--no-fund', '--no-audit') -WorkingDirectory (Join-Path $RootDir 'frontend')
    }
}

function Get-ServerEnvironment {
    return [ordered]@{
        ASPNETCORE_ENVIRONMENT               = 'Development'
        ASPNETCORE_URLS                      = "http://127.0.0.1:$ServerPort"
        APP_CHANNEL                          = 'dev'
        DATA_DIR                             = $DataDir
        BACKUP_DIR                           = $BackupDir
        DOTNET_WATCH_SUPPRESS_LAUNCH_BROWSER = '1'
        DOTNET_WATCH_SUPPRESS_EMOJIS         = '1'
        DOTNET_NOLOGO                        = '1'
    }
}

function Start-DevServer {
    $state = Assert-PortAvailable $ServerPort 'Server' 'server'
    if ($state -eq 'own') { Write-Ok "Server laeuft bereits (Port $ServerPort)."; return }
    Write-Step "Starte den Server (dotnet watch) auf Port $ServerPort..."
    # No hot reload: a clean restart per change is more reliable than edit-and-continue
    $null = Start-BackgroundService 'server' 'dotnet.exe' 'watch --no-hot-reload --non-interactive --no-launch-profile --project src\Cv.Server\Cv.Server.csproj' $RootDir (Get-ServerEnvironment)
}

function Start-DevFrontend([string]$ServiceName, [int]$Port, [int]$ApiPort, [string]$Label) {
    $state = Assert-PortAvailable $Port $Label $ServiceName
    if ($state -eq 'own') { Write-Ok "$Label laeuft bereits (Port $Port)."; return }
    Write-Step "Starte die Oberflaeche (Vite) auf Port $Port..."
    $environment = [ordered]@{ VITE_DEV_PORT = "$Port"; API_PROXY_TARGET = "http://127.0.0.1:$ApiPort" }
    $null = Start-BackgroundService $ServiceName 'npm.cmd' 'run dev' (Join-Path $RootDir 'frontend') $environment
}

function Start-DesktopProgram {
    $state = Assert-PortAvailable $DesktopServerPort 'Windows-Programm (Server)' 'desktop'
    if ($state -eq 'own') { Write-Ok "Das Windows-Programm laeuft bereits (Port $DesktopServerPort)."; return }
    $environment = [ordered]@{ DOTNET_NOLOGO = '1' }
    $monitor = Get-DevMonitor
    if ($monitor) { $environment['CV_DEV_MONITOR'] = $monitor }
    else { Write-Warn 'dev.local.json (devMonitor) fehlt: das Fenster oeffnet sich auf dem normalen Bildschirm und nimmt den Fokus.' }
    Write-Step "Starte das Windows-Programm (Entwicklungsmodus, Monitor: $(if ($monitor) { $monitor } else { 'Standard' }))..."
    $null = Start-BackgroundService 'desktop' 'dotnet.exe' 'run --project src\Cv.Desktop\Cv.Desktop.csproj -- --dev' $RootDir $environment
}

function Start-Dev {
    Write-Host "Starte $Product - Entwicklungsumgebung$(if ($Desktop) { ' (Windows-Programm)' })..." -ForegroundColor Cyan
    Initialize-Repository
    Initialize-Frontend
    $problems = 0
    if ($Desktop) {
        Start-DevFrontend 'desktop-frontend' $DesktopFrontendPort $DesktopServerPort 'Oberflaeche (Windows-Programm)'
        if (-not (Wait-ForUrl "http://127.0.0.1:$DesktopFrontendPort/" 90 'desktop-frontend')) { Write-Warn 'Die Oberflaeche antwortet nicht - Ausgabe pruefen (.\start.ps1 logs desktop-frontend).'; $problems++ }
        Start-DesktopProgram
        Write-Step 'Warte auf das Windows-Programm (beim ersten Start wird gebaut)...'
        if (-not (Wait-ForUrl "http://127.0.0.1:$DesktopServerPort/api/health" 240 'desktop')) { Write-Warn 'Das Programm antwortet nicht - Ausgabe pruefen (.\start.ps1 logs desktop).'; $problems++ }
    }
    else {
        Start-DevServer
        Start-DevFrontend 'frontend' $FrontendPort $ServerPort 'Oberflaeche'
        Write-Step 'Warte auf Server und Oberflaeche (beim ersten Start wird gebaut)...'
        if (-not (Wait-ForUrl "http://127.0.0.1:$ServerPort/api/health" 240 'server')) { Write-Warn 'Der Server antwortet nicht - Ausgabe pruefen (.\start.ps1 logs server).'; $problems++ }
        if (-not (Wait-ForUrl "http://127.0.0.1:$FrontendPort/" 90 'frontend')) { Write-Warn 'Die Oberflaeche antwortet nicht - Ausgabe pruefen (.\start.ps1 logs frontend).'; $problems++ }
    }
    Write-Host ''
    Write-Host '========================================================' -ForegroundColor Green
    if ($Desktop) {
        Write-Host "  Windows-Programm:  Vite http://127.0.0.1:$DesktopFrontendPort, Server http://127.0.0.1:$DesktopServerPort" -ForegroundColor Green
        Write-Host '  Daten:             .data\desktop' -ForegroundColor Green
    }
    else {
        Write-Host "  Oberflaeche: http://127.0.0.1:$FrontendPort" -ForegroundColor Green
        Write-Host "  API:         http://127.0.0.1:$ServerPort  (Health: /api/health)" -ForegroundColor Green
        Write-Host "  Daten:       $DataDir" -ForegroundColor Green
        Write-Host "  Sicherungen: $BackupDir" -ForegroundColor Green
        $setupLine = Get-SetupCodeLine
        if ($setupLine) { Write-Host $setupLine -ForegroundColor Yellow }
    }
    if ($problems -gt 0) { Write-Host '  Achtung: nicht alle Dienste haben rechtzeitig geantwortet.' -ForegroundColor Yellow }
    Write-Host '  Beenden: .\start.ps1 stop' -ForegroundColor Green
    Write-Host '========================================================' -ForegroundColor Green
    if ($problems -gt 0) { exit 1 }
}

# Processes of this repository that lost their PID file (for example after a reboot of the script's folder): ended by their command line.
function Stop-StrayDevProcesses {
    $root = $RootDir.ToLowerInvariant()
    $frontend = (Join-Path $RootDir 'frontend').ToLowerInvariant()
    foreach ($process in @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)) {
        $line = if ($process.CommandLine) { $process.CommandLine.ToLowerInvariant() } else { '' }
        $stray = ($process.Name -eq 'dotnet.exe' -and $line.Contains(' watch ') -and $line.Contains('cv.server.csproj')) -or
            ($process.Name -eq 'node.exe' -and $line.Contains('vite') -and $line.Contains($frontend))
        if ($stray -and $line.Contains($root)) { Stop-ProcessTree ([int]$process.ProcessId) }
    }
}

function Stop-Dev {
    Write-Host "`nFahre $Product herunter..." -ForegroundColor Yellow
    # The program first (closing its window stops its server gracefully), then the web UI dev servers, the server last-but-graceful
    Stop-OwnService 'desktop' 'das Windows-Programm' 'window' 40 $DesktopServerPort
    Stop-OwnService 'desktop-frontend' 'die Oberflaeche (Windows-Programm)'
    if (-not $Desktop) {
        Stop-OwnService 'server' 'den Server (mit Sicherung vor dem Beenden)' 'ctrl-c' 40 $ServerPort
        Stop-OwnService 'frontend' 'die Oberflaeche'
        Stop-StrayDevProcesses
    }
    Write-Host 'Alles sauber beendet (die Datenbank in .data bleibt).' -ForegroundColor Green
}

function Get-ServiceState([string]$ServiceName, [int]$Port) {
    $rootPid = Read-ServicePid $ServiceName
    $listener = Get-PortListener $Port | Select-Object -First 1
    if ($rootPid -and (Test-OwnListener $ServiceName $Port)) { return "laeuft (PID $rootPid)" }
    if ($rootPid) { return "startet (PID $rootPid, Port noch nicht offen)" }
    if ($listener) {
        $owner = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
        return "gestoppt - Port von fremdem Prozess belegt: $(if ($owner) { $owner.ProcessName } else { 'PID ' + $listener.OwningProcess })"
    }
    return 'gestoppt'
}

# The one-time setup code of a fresh server-mode instance (written to .data\setup-token while no account exists), or $null.
function Get-SetupCodeLine {
    $bootstrap = Get-JsonOrNull "http://127.0.0.1:$ServerPort/api/bootstrap"
    if (-not $bootstrap -or -not $bootstrap.setupRequired -or $bootstrap.mode -ne 'server') { return $null }
    $file = Join-Path $DataDir 'setup-token'
    if (Test-Path -LiteralPath $file) { return ('  Einrichtungscode: {0}  (einmalig, fuer das erste Konto)' -f (Get-Content -LiteralPath $file -Raw -Encoding UTF8).Trim()) }
    if ($bootstrap.setupTokenRequired) { return "  Einrichtungscode: Datei $file fehlt" }
    return $null
}

function Show-StatusDev {
    Write-Host "$Product - Umgebung 'dev'" -ForegroundColor Cyan
    Write-Host ('  Version:      {0}' -f ((Get-VersionLines) -join ' / '))
    Write-Host ('  Server:       Port {0}: {1}' -f $ServerPort, (Get-ServiceState 'server' $ServerPort))
    Write-Host ('  Oberflaeche:  Port {0}: {1}' -f $FrontendPort, (Get-ServiceState 'frontend' $FrontendPort))
    Write-Host ('  Programm:     Port {0}: {1}' -f $DesktopServerPort, (Get-ServiceState 'desktop' $DesktopServerPort))
    Write-Host ('  Prog.-Vite:   Port {0}: {1}' -f $DesktopFrontendPort, (Get-ServiceState 'desktop-frontend' $DesktopFrontendPort))
    $health = Get-JsonOrNull "http://127.0.0.1:$ServerPort/api/health"
    if ($health) {
        $version = Get-JsonOrNull "http://127.0.0.1:$ServerPort/api/version"
        Write-Host ('  Health:       {0}{1}' -f $health.status, $(if ($version) { " (laufende Version: $($version.version))" } else { '' }))
    }
    else { Write-Host '  Health:       Server nicht erreichbar' }
    $setupLine = Get-SetupCodeLine
    if ($setupLine) { Write-Host $setupLine -ForegroundColor Yellow }
    $db = Join-Path $DataDir 'app.db'
    if (Test-Path -LiteralPath $db) { Write-Host ('  Datenbank:    {0} ({1:N0} KB)' -f $db, ((Get-Item -LiteralPath $db).Length / 1KB)) }
    else { Write-Host "  Datenbank:    $db (noch nicht angelegt - entsteht beim ersten Start)" }
    $recent = Join-Path $BackupDir 'recent'
    $backups = @(Get-ChildItem -LiteralPath $recent -Filter 'app-*.db' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending)
    if ($backups.Count -gt 0) { Write-Host ('  Sicherungen:  {0} in {1} (neueste: {2})' -f $backups.Count, $recent, $backups[0].LastWriteTime.ToString('yyyy-MM-dd HH:mm')) }
    else { Write-Host "  Sicherungen:  noch keine ($recent)" }
}

# stderr lines are shown in yellow so they stay distinguishable in the merged view
function Write-LogLine([string]$Line, [bool]$IsError) {
    if ($IsError) { Write-Host $Line -ForegroundColor Yellow } else { Write-Host $Line }
}

function Show-LogsDev {
    $name = if ($Service) { $Service } elseif ($Desktop) { 'desktop' } else { 'server' }
    if ($name -notin @('server', 'frontend', 'desktop', 'desktop-frontend')) {
        throw "Unbekanntes Protokoll '$name'. Erlaubt: server | frontend | desktop | desktop-frontend | live (mit -Env live)."
    }
    $files = @((Join-Path $LogDir "$name.log"), (Join-Path $LogDir "$name.err.log"))
    if (@($files | Where-Object { Test-Path -LiteralPath $_ }).Count -eq 0) { throw "Noch kein Protokoll fuer '$name' vorhanden (.logs\$name.log)." }
    # Get-Content -Wait follows only the first of several files in Windows PowerShell 5.1: follow stdout and stderr by hand
    $positions = @{}
    foreach ($file in $files) {
        $positions[$file] = 0
        if (-not (Test-Path -LiteralPath $file)) { continue }
        foreach ($line in @(Get-Content -LiteralPath $file -Tail 100)) { Write-LogLine $line ($file.EndsWith('.err.log')) }
        $positions[$file] = (Get-Item -LiteralPath $file).Length
    }
    while ($true) {
        Start-Sleep -Milliseconds 500
        foreach ($file in $files) {
            if (-not (Test-Path -LiteralPath $file)) { continue }
            $length = (Get-Item -LiteralPath $file).Length
            if ($length -lt $positions[$file]) { $positions[$file] = 0 }
            if ($length -eq $positions[$file]) { continue }
            $stream = New-Object System.IO.FileStream($file, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
            try {
                [void]$stream.Seek($positions[$file], [System.IO.SeekOrigin]::Begin)
                $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
                $text = $reader.ReadToEnd()
                $positions[$file] = $stream.Position
            }
            finally { $stream.Dispose() }
            foreach ($line in ($text -split "`r?`n")) { if ($line.Length -gt 0) { Write-LogLine $line ($file.EndsWith('.err.log')) } }
        }
    }
}

# ======================================================================================================================================
# live (container)
# ======================================================================================================================================

function Invoke-Compose([string[]]$Arguments, [switch]$AllowFail) {
    return (Invoke-Native 'docker' (@('compose', '-f', (Join-Path $RootDir 'docker-compose.yml')) + $Arguments) -AllowFail:$AllowFail)
}

function Get-LiveContainer {
    $lines = @(Get-NativeOutput 'docker' @('ps', '-a', '--filter', "label=com.docker.compose.project=$ComposePrefix", '--format', '{{.Names}}'))
    if ($lines.Count -gt 0) { return $lines[0] }
    return $null
}

function Set-BuildEnvironment {
    $lines = @(Get-VersionLines)
    $env:APP_VERSION = $lines[0]
    $env:APP_VERSION_DETAIL = if ($lines.Count -gt 1) { $lines[1] } else { $lines[0] }
    $env:APP_CHANNEL = 'release'
    $env:APP_TITLE = $Product
    $env:APP_PORT = "$LivePort"
    $env:BUILD_DATE = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    $revision = @(Get-NativeOutput 'git' @('rev-parse', 'HEAD'))
    $env:VCS_REF = if ($revision.Count -gt 0) { $revision[0] } else { 'unknown' }
}

function Start-Live {
    Write-Host "Starte $Product - Live-Profil (Container)..." -ForegroundColor Cyan
    Assert-DockerRunning
    $null = Assert-PortAvailable $LivePort 'Live-Container' $null $ComposePrefix
    Set-BuildEnvironment
    Write-Step 'Baue das Image und starte den Container...'
    $null = Invoke-Compose @('up', '-d', '--build', '--remove-orphans')
    $container = Get-LiveContainer
    Write-Step 'Warte auf den Health-Check des Containers...'
    $deadline = (Get-Date).AddSeconds(120)
    $health = ''
    while ((Get-Date) -lt $deadline) {
        $health = (Get-NativeOutput 'docker' @('inspect', '--format', '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}', $container) | Select-Object -First 1)
        if ($health -eq 'healthy') { break }
        Start-Sleep -Seconds 2
    }
    if ($health -ne 'healthy') {
        Write-Warn "Der Container ist nicht gesund (Status: $health). Ausgabe: .\start.ps1 logs live -Env live"
        exit 1
    }
    Write-Host ''
    Write-Host '========================================================' -ForegroundColor Green
    Write-Host "  Live-Profil: http://127.0.0.1:$LivePort  (Container $container)" -ForegroundColor Green
    Write-Host '  Daten:       Docker-Volume vitafolio-live_data (bleibt beim Stoppen erhalten)' -ForegroundColor Green
    Write-Host '  Beenden:     .\start.ps1 stop -Env live' -ForegroundColor Green
    Write-Host '========================================================' -ForegroundColor Green
}

function Stop-Live {
    Write-Host "`nFahre das Live-Profil herunter..." -ForegroundColor Yellow
    Assert-DockerRunning
    if (-not (Get-LiveContainer)) { Write-Ok 'Es laeuft kein Container dieses Profils.'; return }
    Write-Step 'Beende den Container (er sichert die Datenbank vor dem Beenden)...'
    # No "-v": the data volume must survive
    $null = Invoke-Compose @('down', '--timeout', '40', '--remove-orphans')
    Write-Host 'Alles sauber beendet (das Daten-Volume bleibt).' -ForegroundColor Green
}

function Show-StatusLive {
    Write-Host "$Product - Umgebung 'live'" -ForegroundColor Cyan
    Assert-DockerRunning
    $container = Get-LiveContainer
    if (-not $container) { Write-Host '  Container:    gestoppt (nicht vorhanden)'; return }
    $state = Get-NativeOutput 'docker' @('inspect', '--format', '{{.State.Status}} / Health: {{if .State.Health}}{{.State.Health.Status}}{{else}}keiner{{end}}', $container)
    Write-Host ('  Container:    {0}: {1}' -f $container, ($state -join ''))
    Write-Host ('  Port:         {0} (nur Loopback)' -f $LivePort)
    $version = Get-JsonOrNull "http://127.0.0.1:$LivePort/api/version"
    if ($version) { Write-Host ('  Version:      {0}' -f $version.version) } else { Write-Host '  Version:      nicht erreichbar' }
    $volumes = Get-NativeOutput 'docker' @('volume', 'ls', '--filter', "label=com.docker.compose.project=$ComposePrefix", '--format', '{{.Name}}')
    Write-Host ('  Daten-Volume: {0}' -f ($volumes -join ', '))
}

# ======================================================================================================================================

try {
    if ($Env -eq 'live') {
        switch ($Command) {
            'status' { Show-StatusLive }
            'logs' { Assert-DockerRunning; Invoke-Compose @('logs', '-f', '--tail', '100') -AllowFail | Out-Null }
            'stop' { Stop-Live }
            'restart' { Stop-Live; Start-Live }
            default { Start-Live }
        }
    }
    else {
        switch ($Command) {
            'status' { Show-StatusDev }
            'logs' { Show-LogsDev }
            'stop' { Stop-Dev }
            'restart' { Stop-Dev; Start-Dev }
            default { Start-Dev }
        }
    }
}
catch {
    Write-Host ''
    Write-Host "Fehler: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
