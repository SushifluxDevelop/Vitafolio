<#
  Builds the Windows program and its installer:

    artifacts\windows\<Product>-win-Setup.exe      the installer (Velopack; installs per user, no administrator rights needed)
    artifacts\windows\<Product>-<version>-full.nupkg, releases.win.json, RELEASES   the update feed files
    artifacts\windows\<Product>-win-Portable.zip                                    the program as a plain ZIP (no installation)

  Steps: "dotnet publish" of src\Cv.Desktop (win-x64, self-contained; the built web UI from frontend\dist is part of it), the channel marker
  next to the program, then Velopack's "vpk pack" (the vpk tool is pinned in .config\dotnet-tools.json and restored on the first run).
  The product name is read from branding.json - it is never typed here. The version comes from version.txt (written by the pre-commit hook);
  without it (before the first commit) 0.0.1 is used and a warning is printed.

  Switches: -Beta     channel "beta"     (version 2026.11.12-beta.13.557)
            -Nightly  channel "nightly"  (version 2026.11.12-nightly.13.557)
            -Dev      channel "dev"      (version 2026.11.12-dev.13.557; the program shows "-dev" and never checks for updates)
            -SkipFrontend  do not run "npm run build" first (frontend\dist must exist then)
  Not signed: the exe and the installer carry no code signature, so Windows SmartScreen warns on first start. Signing needs a certificate
  and is a separate step of the release process.

  Windows PowerShell 5.1 compatible. Console output is German and ASCII-only.
  Aufruf:  .\scripts\build-windows.ps1 [-Beta | -Nightly | -Dev] [-SkipFrontend]
#>
param(
    [switch]$Beta,
    [switch]$Nightly,
    [switch]$Dev,
    [switch]$SkipFrontend
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$artifacts = Join-Path $root 'artifacts'
$publish = Join-Path $artifacts 'windows-cache\publish'
$out = Join-Path $artifacts 'windows'

function Invoke-Native([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$File $($Arguments -join ' ') ist fehlgeschlagen (Exitcode $LASTEXITCODE)." }
}

$modesCount = ($Beta ? 1 : 0) + ($Nightly ? 1 : 0) + ($Dev ? 1 : 0)
if ($modesCount -gt 1) { throw 'Nur einer der Schalter -Beta, -Nightly oder -Dev darf gesetzt sein.' }
$channel = if ($Beta) { 'beta' } elseif ($Nightly) { 'nightly' } elseif ($Dev) { 'dev' } else { 'release' }

# ---- product name (branding.json is the only place) -----------------------------------------------------------------------------
$branding = Get-Content -LiteralPath (Join-Path $root 'branding.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$product = $branding.name
if (-not $product) { throw 'branding.json enthaelt keinen Namen.' }

# ---- version: version.txt line 1 = vYear.Month.Commit, line 2 = vYear.Month.Commit.Prompts.Lines --------------------------------
$versionFile = Join-Path $root 'version.txt'
$semver = '0.0.1'
if (Test-Path -LiteralPath $versionFile) {
    $lines = @(Get-Content -LiteralPath $versionFile | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($lines.Count -gt 0 -and $lines[0] -match '^v?(\d+\.\d+\.\d+)$') {
        $semver = $Matches[1]
        if ($channel -ne 'release') {
            $counters = ''
            if ($lines.Count -gt 1 -and $lines[1] -match ('^v?' + [regex]::Escape($semver) + '\.(\d+)\.(\d+)$')) { $counters = ".$($Matches[1]).$($Matches[2])" }
            $semver = "$semver-$channel$counters"
        }
    }
    else { Write-Warning "version.txt Zeile 1 hat nicht die Form vJahr.Monat.Commit - es wird $semver verwendet." }
}
else { Write-Warning "version.txt fehlt (vor dem ersten Commit) - es wird die Version $semver verwendet." }
Write-Host "== $product $semver (Kanal $channel)"

# ---- 1. web UI --------------------------------------------------------------------------------------------------------------------
$dist = Join-Path $root 'frontend\dist'
if (-not $SkipFrontend) {
    Push-Location (Join-Path $root 'frontend')
    try {
        if (-not (Test-Path -LiteralPath 'node_modules')) { Invoke-Native 'npm' @('ci', '--no-fund', '--no-audit') }
        Write-Host '== Baue die Oberflaeche (npm run build) ...'
        Invoke-Native 'npm' @('run', 'build')
    }
    finally { Pop-Location }
}
if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.html'))) { throw 'frontend\dist\index.html fehlt (Oberflaeche nicht gebaut).' }

# ---- 2. program -------------------------------------------------------------------------------------------------------------------
if (Test-Path -LiteralPath $publish) { Remove-Item -LiteralPath $publish -Recurse -Force }
Write-Host '== Veroeffentliche das Programm (win-x64, eigenstaendig) ...'
$numeric = ($semver -split '-')[0]
Invoke-Native 'dotnet' @('publish', (Join-Path $root 'src\Cv.Desktop\Cv.Desktop.csproj'), '-c', 'Release', '-r', 'win-x64', '--self-contained', 'true',
    '-o', $publish, '-p:DebugType=none', "-p:Version=$numeric")
$exeName = "$product.exe"
if (-not (Test-Path -LiteralPath (Join-Path $publish $exeName))) { throw "$exeName wurde nicht erzeugt." }
# Development settings of the server are not part of the program
Remove-Item -LiteralPath (Join-Path $publish 'appsettings.Development.json') -Force -ErrorAction SilentlyContinue
# The channel marker the program reads (release / beta / dev)
[IO.File]::WriteAllText((Join-Path $publish 'release-channel.txt'), $channel, (New-Object System.Text.UTF8Encoding($false)))

# ---- 3. installer -----------------------------------------------------------------------------------------------------------------
Write-Host '== Erzeuge den Installer (Velopack) ...'
Push-Location $root
try {
    Invoke-Native 'dotnet' @('tool', 'restore')
    New-Item -ItemType Directory -Force -Path $out | Out-Null
    $pack = @('tool', 'run', 'vpk', 'pack',
        '--packId', $product, '--packTitle', $product, '--packAuthors', 'SushiFlux Develop',
        '--packVersion', $semver, '--packDir', $publish, '--mainExe', $exeName,
        '--icon', (Join-Path $root 'src\Cv.Desktop\Assets\app.ico'), '--outputDir', $out, '--runtime', 'win-x64')
    if ($channel -ne 'release') { $pack += @('--channel', $channel) }
    Invoke-Native 'dotnet' $pack
}
finally { Pop-Location }

Write-Host "== Fertig: $out"
Get-ChildItem -LiteralPath $out | ForEach-Object { Write-Host ("   {0}  ({1} MB)" -f $_.Name, [math]::Round($_.Length / 1MB, 1)) }
Write-Warning 'Nicht signiert: Windows SmartScreen warnt beim ersten Start. Die Signatur ist ein eigener Schritt des Release-Prozesses.'
