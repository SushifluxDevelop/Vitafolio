<#
  Shared helpers for start.ps1 and the scripts in scripts\ (dot-sourced). Windows PowerShell 5.1 compatible.
  Console output is German and ASCII-only.

  Ports are fixed and never chosen at run time: the numbers below are the defaults. An optional local override file may change
  them (a "ports.json" in a dot folder of the user profile with an entry named like the lower-case product name from branding.json,
  or the file named by the environment variable CV_PORTS_FILE). A busy port stops the script with a message that names the
  occupying process.
#>

$script:RootDir = Split-Path -Parent $PSScriptRoot
$script:RunDir = Join-Path $script:RootDir '.run'
$script:LogDir = Join-Path $script:RootDir '.logs'

# ---- product name (branding.json is the only place that spells it) ---------------------------------------------------------------
function Get-ProductName {
    $file = Join-Path $script:RootDir 'branding.json'
    if (-not (Test-Path -LiteralPath $file)) { throw 'branding.json fehlt.' }
    $name = (Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json).name
    if (-not $name) { throw 'branding.json enthaelt keinen Namen.' }
    return [string]$name
}

$script:ProductName = Get-ProductName
$script:ProjectKey = $script:ProductName.ToLowerInvariant()

# ---- fixed ports ------------------------------------------------------------------------------------------------------------------
$script:DefaultPorts = [ordered]@{
    'frontend'              = 5240   # Vite dev server of the browser setup (proxies /api to backend)
    'backend'               = 5241   # server, development
    'live-http'             = 5242   # container (live profile), host side
    'desktop-backend'       = 5243   # server inside the Windows program, development
    'desktop-frontend'      = 5244   # Vite dev server of the Windows program (proxies /api to desktop-backend)
    'e2e-backend'           = 5245   # test server of the end-to-end suite (temporary data, built UI)
    'e2e-playwright-server' = 5246   # browser server (container) of the end-to-end suite, loopback only
}

function Find-PortOverrideFile {
    if ($env:CV_PORTS_FILE -and (Test-Path -LiteralPath $env:CV_PORTS_FILE)) { return $env:CV_PORTS_FILE }
    if (-not $env:USERPROFILE) { return $null }
    foreach ($dir in @(Get-ChildItem -LiteralPath $env:USERPROFILE -Directory -Force -Filter '.*' -ErrorAction SilentlyContinue)) {
        $candidate = Join-Path $dir.FullName 'ports.json'
        if (-not (Test-Path -LiteralPath $candidate)) { continue }
        try {
            $json = Get-Content -LiteralPath $candidate -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($json.PSObject.Properties[$script:ProjectKey]) { return $candidate }
        }
        catch { }
    }
    return $null
}

function Get-Ports {
    $ports = [ordered]@{}
    foreach ($key in $script:DefaultPorts.Keys) { $ports[$key] = $script:DefaultPorts[$key] }
    $file = Find-PortOverrideFile
    if ($file) {
        try {
            $entry = (Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json).($script:ProjectKey)
            foreach ($property in $entry.PSObject.Properties) {
                if ($ports.Contains($property.Name) -and $property.Value -is [int]) { $ports[$property.Name] = [int]$property.Value }
            }
        }
        catch { Write-Warn 'Die lokale Port-Datei ist nicht lesbar - es werden die festen Standard-Ports verwendet.' }
    }
    return $ports
}

$script:Ports = Get-Ports

# ---- console output ---------------------------------------------------------------------------------------------------------------
function Write-Step([string]$Message) { Write-Host "-> $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "   $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "   $Message" -ForegroundColor Yellow }

function Invoke-Native([string]$Exe, [string[]]$Arguments, [switch]$AllowFail, [switch]$Quiet, [string]$WorkingDirectory) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    if ($WorkingDirectory) { Push-Location $WorkingDirectory }
    try {
        if ($Quiet) { & $Exe @Arguments 2>&1 | Out-Null }
        else { & $Exe @Arguments 2>&1 | ForEach-Object { "$_" } | Write-Host }
        $code = $LASTEXITCODE
    }
    finally {
        if ($WorkingDirectory) { Pop-Location }
        $ErrorActionPreference = $previous
    }
    if ($code -ne 0 -and -not $AllowFail) { throw "$Exe $($Arguments -join ' ') ist fehlgeschlagen (Exit Code $code)." }
    return $code
}

# Output of a native command as lines (stderr dropped); empty array when it fails.
function Get-NativeOutput([string]$Exe, [string[]]$Arguments) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $lines = @(& $Exe @Arguments 2>$null) }
    catch { $lines = @() }
    finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { return @() }
    return @($lines | ForEach-Object { "$_" })
}

# ---- version (version.txt is written by the pre-commit hook; before the first commit it does not exist) ---------------------------
function Get-VersionLines {
    $file = Join-Path $script:RootDir 'version.txt'
    if (Test-Path -LiteralPath $file) {
        $lines = @(Get-Content -LiteralPath $file -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        if ($lines.Count -gt 0) { return $lines }
    }
    return @('v0.0.0')
}

# ---- development settings of this machine (dev.local.json, git-ignored) ----------------------------------------------------------
function Get-DevMonitor {
    $file = Join-Path $script:RootDir 'dev.local.json'
    if (-not (Test-Path -LiteralPath $file)) { return $null }
    try {
        $value = (Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json).devMonitor
        if ($value) { return [string]$value }
    }
    catch { Write-Warn 'dev.local.json ist nicht lesbar und wird ignoriert.' }
    return $null
}

# ---- processes and ports ----------------------------------------------------------------------------------------------------------
function Get-PortListener([int]$Port) {
    return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Get-PortProcess([int]$Port) {
    $connection = Get-PortListener $Port | Select-Object -First 1
    if (-not $connection) { return $null }
    return Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
}

function Test-ProcessAlive([int]$ProcessId) {
    return [bool](Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Get-ProcessTreeIds([int]$RootPid) {
    $all = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Select-Object ProcessId, ParentProcessId)
    $ids = New-Object System.Collections.Generic.List[int]
    $queue = New-Object System.Collections.Queue
    $queue.Enqueue($RootPid)
    while ($queue.Count -gt 0) {
        $current = [int]$queue.Dequeue()
        if ($ids.Contains($current)) { continue }
        $ids.Add($current)
        foreach ($child in @($all | Where-Object { $_.ParentProcessId -eq $current })) { $queue.Enqueue([int]$child.ProcessId) }
    }
    return $ids
}

function Stop-ProcessTree([int]$ProcessId) {
    if (Test-ProcessAlive $ProcessId) { cmd /c "taskkill /PID $ProcessId /T /F >nul 2>&1" }
}

function Get-PidFile([string]$Name) { return (Join-Path $script:RunDir "$Name.pid") }

function Read-ServicePid([string]$Name) {
    $file = Get-PidFile $Name
    if (-not (Test-Path -LiteralPath $file)) { return $null }
    $text = (Get-Content -LiteralPath $file -ErrorAction SilentlyContinue | Select-Object -First 1)
    $value = 0
    if ($text -and [int]::TryParse($text.Trim(), [ref]$value) -and (Test-ProcessAlive $value)) { return $value }
    Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
    return $null
}

function Write-ServicePid([string]$Name, [int]$ProcessId) {
    New-Item -ItemType Directory -Force -Path $script:RunDir | Out-Null
    Set-Content -LiteralPath (Get-PidFile $Name) -Value $ProcessId -Encoding ASCII
}

function Remove-ServicePid([string]$Name) { Remove-Item -LiteralPath (Get-PidFile $Name) -Force -ErrorAction SilentlyContinue }

# True when the process that listens on the port belongs to the service started by this script (its tree contains the listener).
function Test-OwnListener([string]$Service, [int]$Port) {
    $rootPid = Read-ServicePid $Service
    if (-not $rootPid) { return $false }
    $tree = Get-ProcessTreeIds $rootPid
    foreach ($listener in (Get-PortListener $Port)) {
        if ($tree -contains [int]$listener.OwningProcess) { return $true }
    }
    return $false
}

# Name of the container (any project) that publishes the host port, or $null.
function Get-ContainerOnPort([int]$Port) {
    $lines = @(Get-NativeOutput 'docker' @('ps', '--filter', "publish=$Port", '--format', '{{.Names}}'))
    if ($lines.Count -gt 0) { return $lines[0] }
    return $null
}

# Stops with a clear message when the port is taken by something that is not this project's own service. Returns 'free' or 'own'.
# $OwnContainerPrefix: container names that count as this project's own (live profile).
function Assert-PortAvailable([int]$Port, [string]$Label, [string]$Service, [string]$OwnContainerPrefix) {
    $listeners = Get-PortListener $Port
    if ($listeners.Count -eq 0) { return 'free' }
    if ($Service -and (Test-OwnListener $Service $Port)) { return 'own' }
    $container = Get-ContainerOnPort $Port
    if ($container) {
        if ($OwnContainerPrefix -and $container.ToLowerInvariant().StartsWith($OwnContainerPrefix.ToLowerInvariant())) { return 'own' }
        throw "Port $Port ($Label) ist vom Container '$container' belegt. Bitte diesen Container beenden - die Ports sind fest vergeben."
    }
    $owner = Get-Process -Id $listeners[0].OwningProcess -ErrorAction SilentlyContinue
    $who = if ($owner) { "'$($owner.ProcessName)' (PID $($owner.Id))" } else { "einem Prozess mit der PID $($listeners[0].OwningProcess)" }
    throw "Port $Port ($Label) ist von $who belegt. Bitte diesen Prozess beenden - die Ports sind fest vergeben."
}

# Ctrl+C for a process tree that has a (hidden) console: lets "dotnet watch" and the server shut down gracefully, so the server's
# backup before shutdown runs. Done in a separate short-lived PowerShell, because detaching from the console would break this one.
function Send-CtrlC([int]$ProcessId) {
    $code = @"
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CvConsole {
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool AttachConsole(uint pid);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool FreeConsole();
    [DllImport("kernel32.dll")] static extern bool SetConsoleCtrlHandler(IntPtr handler, bool add);
    [DllImport("kernel32.dll")] static extern bool GenerateConsoleCtrlEvent(uint ev, uint group);
    public static bool Send(uint pid) {
        FreeConsole();
        if (!AttachConsole(pid)) return false;
        SetConsoleCtrlHandler(IntPtr.Zero, true);
        bool ok = GenerateConsoleCtrlEvent(0, 0);
        System.Threading.Thread.Sleep(300);
        FreeConsole();
        return ok;
    }
}
'@
[void][CvConsole]::Send($ProcessId)
"@
    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($code))
    $null = Get-NativeOutput 'powershell.exe' @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded)
}

# Ends a service of this script: graceful first (Ctrl+C or closing the main window), then the whole process tree. Port = the port of the
# service: once it is closed the graceful stop worked (dotnet watch keeps waiting for changes after its app ended, so the rest of the
# tree is ended quietly afterwards).
function Stop-OwnService([string]$Service, [string]$Label, [ValidateSet('ctrl-c', 'window', 'none')][string]$Graceful = 'none', [int]$WaitSeconds = 30, [int]$Port = 0) {
    $rootPid = Read-ServicePid $Service
    if (-not $rootPid) { return }
    Write-Step "Beende $Label..."
    $tree = Get-ProcessTreeIds $rootPid
    if ($Graceful -eq 'ctrl-c') { Send-CtrlC $rootPid }
    elseif ($Graceful -eq 'window') {
        foreach ($id in $tree) {
            $process = Get-Process -Id $id -ErrorAction SilentlyContinue
            if ($process -and $process.MainWindowHandle -ne [IntPtr]::Zero) { [void]$process.CloseMainWindow() }
        }
    }
    $clean = $true
    if ($Graceful -ne 'none') {
        $deadline = (Get-Date).AddSeconds($WaitSeconds)
        while ((Get-Date) -lt $deadline) {
            if (@($tree | Where-Object { Test-ProcessAlive $_ }).Count -eq 0) { break }
            if ($Port -gt 0 -and (Get-PortListener $Port).Count -eq 0) { Start-Sleep -Milliseconds 800; break }
            Start-Sleep -Milliseconds 300
        }
        if ($Port -gt 0 -and (Get-PortListener $Port).Count -gt 0) { $clean = $false }
    }
    $left = @($tree | Where-Object { Test-ProcessAlive $_ })
    if ($left.Count -gt 0) {
        if (-not $clean) { Write-Warn "$Label hat nicht rechtzeitig geantwortet und wird hart beendet." }
        Stop-ProcessTree $rootPid
        foreach ($id in $left) { Stop-ProcessTree $id }
    }
    Remove-ServicePid $Service
}

# Starts a hidden background process with its output in .logs\ and remembers its PID (the PID of the cmd.exe that wraps it). Started
# through WMI, so it inherits no handles of this console (a caller that reads this script's output through a pipe is not kept waiting),
# is not part of this console's job and keeps running after the script ends. WMI processes do not inherit this session's environment,
# so the variables are set inside the cmd.exe command line.
function Start-BackgroundService([string]$Service, [string]$Exe, [string]$Arguments, [string]$WorkingDirectory, [System.Collections.IDictionary]$Environment) {
    New-Item -ItemType Directory -Force -Path $script:RunDir, $script:LogDir | Out-Null
    $prefix = ''
    if ($Environment) {
        foreach ($key in $Environment.Keys) { $prefix += "set `"$key=$($Environment[$key])`"&& " }
    }
    $log = Join-Path $script:LogDir "$Service.log"
    $err = Join-Path $script:LogDir "$Service.err.log"
    $commandLine = "cmd.exe /d /c `"$prefix$Exe $Arguments > `"$log`" 2> `"$err`"`""
    $startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
    $result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
        CommandLine = $commandLine; CurrentDirectory = $WorkingDirectory; ProcessStartupInformation = $startup
    }
    if ($result.ReturnValue -ne 0) { throw "$Service konnte nicht gestartet werden (WMI-Code $($result.ReturnValue))." }
    Write-ServicePid $Service ([int]$result.ProcessId)
    return [int]$result.ProcessId
}

function Wait-ForUrl([string]$Url, [int]$Seconds, [string]$Service) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return $true }
        }
        catch { }
        if ($Service -and -not (Read-ServicePid $Service)) { return $false }
        Start-Sleep -Milliseconds 700
    }
    return $false
}

function Get-JsonOrNull([string]$Url) {
    try { return (Invoke-RestMethod -Uri $Url -TimeoutSec 4) }
    catch { return $null }
}

# ---- Docker -----------------------------------------------------------------------------------------------------------------------
function Assert-DockerRunning {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker ist nicht installiert (Befehl "docker" nicht gefunden).' }
    $code = Invoke-Native 'docker' @('info', '--format', '{{.ServerVersion}}') -AllowFail -Quiet
    if ($code -ne 0) { throw 'Docker laeuft nicht. Bitte Docker Desktop starten und den Befehl wiederholen.' }
}
