<#
  Runs the standing end-to-end suite (frontend\e2e, Playwright) against a FRESH test server. Windows PowerShell 5.1 compatible,
  console output is German and ASCII-only.   Aufruf:  .\scripts\e2e.ps1 [-SkipBuild] [-HandbookCapture] [Playwright-Argumente...]   oder  npm run test:e2e

  What happens:
    1. frontend: "npm run build" (the built UI becomes the server's web root) and the server is built (Release).
    2. A fresh test server starts on the fixed e2e port with a temporary data folder: Production environment, the built UI as web root,
       login and other rate limits raised, automatic backups off. It listens on 127.0.0.1 ONLY.
    3. The browsers run in the official Playwright container (a Playwright server in a container, the version pinned to the one in
       frontend\package.json). The test runner on this PC connects to it and tunnels the browser's network to this PC's loopback
       (exposeNetwork), so the test server never has to be reachable from the container or from the home network. The script checks
       that no test port listens on all interfaces, and stops with an error if one does.
    4. The suite runs; afterwards the container and the server are ended and the temporary data and the saved sign-in are deleted.
  The browser container is only started for this run (no standing service).
#>
param(
    [switch]$SkipBuild,
    [switch]$HandbookCapture,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$PlaywrightArgs = @()
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'dev-common.ps1')
Set-Location $script:RootDir

$serverPort = [int]$Ports['e2e-backend']
$browserPort = [int]$Ports['e2e-playwright-server']
$frontendDir = Join-Path $RootDir 'frontend'
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('cv-e2e-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
$containerName = "$($script:ProjectKey)-e2e-browser"
$serviceName = 'e2e-server'
$exitCode = 1

# The Playwright version comes from the one place that defines it, so the container image, the server in it and the test runner always match
$packageJson = Get-Content -LiteralPath (Join-Path $frontendDir 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$playwrightVersion = [string]$packageJson.devDependencies.'@playwright/test'
if ($playwrightVersion -notmatch '^\d+\.\d+\.\d+$') { throw "Die Playwright-Version in frontend\package.json muss fest eingetragen sein (ist: '$playwrightVersion')." }
$image = "mcr.microsoft.com/playwright:v$playwrightVersion-noble"

# Every listener of a test port must be bound to the loopback address.
function Assert-LoopbackOnly([int[]]$TestPorts) {
    foreach ($port in $TestPorts) {
        foreach ($listener in (Get-PortListener $port)) {
            if ($listener.LocalAddress -notin @('127.0.0.1', '::1')) {
                throw "Der Test-Port $port lauscht auf $($listener.LocalAddress) und waere aus dem Heimnetz erreichbar. Abbruch."
            }
        }
    }
}

try {
    Assert-DockerRunning
    foreach ($entry in @(@($serverPort, 'e2e-backend'), @($browserPort, 'e2e-playwright-server'))) {
        $null = Assert-PortAvailable ([int]$entry[0]) ([string]$entry[1]) $null $null
    }

    if (-not $SkipBuild) {
        if (-not (Test-Path -LiteralPath (Join-Path $frontendDir 'node_modules'))) {
            Write-Step 'Installiere die Abhaengigkeiten der Oberflaeche (npm ci)...'
            $null = Invoke-Native 'npm.cmd' @('ci', '--no-fund', '--no-audit') -WorkingDirectory $frontendDir
        }
        Write-Step 'Baue die Oberflaeche...'
        $null = Invoke-Native 'npm.cmd' @('run', 'build') -WorkingDirectory $frontendDir
        Write-Step 'Baue den Server (Release)...'
        $null = Invoke-Native 'dotnet' @('build', 'src\Cv.Server\Cv.Server.csproj', '-c', 'Release', '--nologo', '-v', 'q')
    }
    $dist = Join-Path $frontendDir 'dist'
    $dll = 'src\Cv.Server\bin\Release\net10.0\Cv.Server.dll'
    if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html'))) { throw 'frontend\dist fehlt - ohne -SkipBuild bauen.' }
    if (-not (Test-Path -LiteralPath (Join-Path $RootDir $dll))) { throw "$dll fehlt - ohne -SkipBuild bauen." }

    # ---- fresh test server ---------------------------------------------------------------------------------------------------
    New-Item -ItemType Directory -Force -Path (Join-Path $tempRoot 'data'), (Join-Path $tempRoot 'backups') | Out-Null
    Write-Step "Starte den frischen Testserver auf 127.0.0.1:$serverPort (temporaere Daten: $tempRoot)..."
    $environment = [ordered]@{
        ASPNETCORE_ENVIRONMENT = 'Production'
        ASPNETCORE_URLS        = "http://127.0.0.1:$serverPort"
        # The manual's pictures show the release look (no "-dev" in the footer)
        APP_CHANNEL            = $(if ($HandbookCapture) { 'release' } else { 'dev' })
        DATA_DIR               = (Join-Path $tempRoot 'data')
        BACKUP_DIR             = (Join-Path $tempRoot 'backups')
        WEB_ROOT               = $dist
        RateLimits__Login      = '1000'
        RateLimits__TwoFactor  = '1000'
        RateLimits__Setup      = '1000'
        RateLimits__Register   = '1000'
        RateLimits__Password   = '1000'
        RateLimits__StepUp     = '1000'
        Backups__Automatic     = 'false'
        DOTNET_NOLOGO          = '1'
    }
    $null = Start-BackgroundService $serviceName 'dotnet.exe' $dll $RootDir $environment
    if (-not (Wait-ForUrl "http://127.0.0.1:$serverPort/api/health" 90 $serviceName)) {
        throw "Der Testserver antwortet nicht. Ausgabe: .logs\$serviceName.log und .logs\$serviceName.err.log"
    }
    $bootstrap = Get-JsonOrNull "http://127.0.0.1:$serverPort/api/bootstrap"
    if (-not $bootstrap -or -not $bootstrap.setupRequired) { throw 'Der Testserver ist nicht frisch (setupRequired ist nicht true).' }
    # Server mode asks for a one-time setup code (written to <data>/setup-token at the first start); the tests get it as CV_SETUP_TOKEN
    $tokenFile = Join-Path $tempRoot 'data\setup-token'
    $setupToken = $null
    for ($i = 0; $i -lt 20 -and -not $setupToken; $i++) {
        if (Test-Path -LiteralPath $tokenFile) { $setupToken = (Get-Content -LiteralPath $tokenFile -Raw -Encoding UTF8).Trim() }
        if (-not $setupToken -and -not $bootstrap.setupTokenRequired) { break }
        if (-not $setupToken) { Start-Sleep -Milliseconds 500 }
    }
    if ($bootstrap.setupTokenRequired -and -not $setupToken) { throw "Der Server verlangt einen Einrichtungscode, aber $tokenFile fehlt." }
    if ($setupToken) { $env:CV_SETUP_TOKEN = $setupToken }

    # ---- browsers in the Playwright container ----------------------------------------------------------------------------------
    Write-Step "Starte den Browser-Server ($image) auf 127.0.0.1:$browserPort..."
    $null = Invoke-Native 'docker' @('rm', '-f', $containerName) -AllowFail -Quiet
    $null = Invoke-Native 'docker' @('run', '-d', '--rm', '--init', '--ipc=host', '--name', $containerName, '-p', "127.0.0.1:${browserPort}:3000",
            $image, '/bin/sh', '-c', "cd /tmp && npx -y playwright@$playwrightVersion run-server --port 3000 --host 0.0.0.0") -Quiet
    $ready = $false
    for ($i = 0; $i -lt 90 -and -not $ready; $i++) {
        $logs = (Get-NativeOutput 'docker' @('logs', $containerName)) -join "`n"
        if ($logs -match 'Listening on ws://') { $ready = $true } else { Start-Sleep -Seconds 1 }
    }
    if (-not $ready) { throw "Der Browser-Server im Container ist nicht bereit geworden. Ausgabe: docker logs $containerName" }

    Assert-LoopbackOnly @($serverPort, $browserPort)
    Write-Ok "Geprueft: Port $serverPort und Port $browserPort lauschen nur auf der Loopback-Adresse (nicht auf 0.0.0.0)."

    # ---- run the suite ---------------------------------------------------------------------------------------------------------
    Write-Step 'Starte die Testsuite...'
    $env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:$serverPort"
    $env:PLAYWRIGHT_WS_ENDPOINT = "ws://127.0.0.1:$browserPort/"
    $testArguments = @('exec', '--', 'playwright', 'test') + $PlaywrightArgs
    if ($HandbookCapture) {
        # Only the screenshot project runs (the spec is inactive without HANDBOOK_CAPTURE=1); it writes into docs\handbuch\<lang>\bilder
        foreach ($language in @('de', 'en')) { New-Item -ItemType Directory -Force -Path (Join-Path $RootDir "docs\handbuch\$language\bilder") | Out-Null }
        $env:HANDBOOK_CAPTURE = '1'
        $testArguments += '--project=handbook'
        Write-Step 'Erzeuge die Handbuch-Bilder (Kanal release, nur das Projekt handbook)...'
    }
    $exitCode = Invoke-Native 'npm.cmd' $testArguments -AllowFail -WorkingDirectory $frontendDir
    Assert-LoopbackOnly @($serverPort, $browserPort)
    if ($exitCode -eq 0) { Write-Host 'E2E-Suite: bestanden.' -ForegroundColor Green }
    else { Write-Host "E2E-Suite: fehlgeschlagen (Exit Code $exitCode)." -ForegroundColor Red }
}
catch {
    Write-Host ''
    Write-Host "Fehler: $($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
}
finally {
    Write-Step 'Raeume auf...'
    Remove-Item Env:PLAYWRIGHT_BASE_URL, Env:PLAYWRIGHT_WS_ENDPOINT, Env:CV_SETUP_TOKEN, Env:HANDBOOK_CAPTURE -ErrorAction SilentlyContinue
    $null = Invoke-Native 'docker' @('rm', '-f', $containerName) -AllowFail -Quiet
    Stop-OwnService $serviceName 'den Testserver'
    for ($i = 0; $i -lt 10 -and (Test-Path -LiteralPath $tempRoot); $i++) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path -LiteralPath $tempRoot) { Start-Sleep -Milliseconds 500 }
    }
    if (Test-Path -LiteralPath $tempRoot) { Write-Warn "Die temporaeren Daten konnten nicht geloescht werden: $tempRoot" }
    # The saved sign-in belongs to the deleted test instance
    Remove-Item -LiteralPath (Join-Path $frontendDir 'e2e\.auth\owner.json') -Force -ErrorAction SilentlyContinue
}
exit $exitCode
