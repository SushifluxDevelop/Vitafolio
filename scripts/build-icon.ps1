<#
  Builds src\Cv.Desktop\Assets\app.ico (16-256 px) from branding\logo.svg in the on-demand Playwright container
  (no local browser install). The .ico is committed; run this again whenever the logo changes:  .\scripts\build-icon.ps1
#>
$ErrorActionPreference = 'Stop'
$RootDir = Split-Path -Parent $PSScriptRoot

$image = 'mcr.microsoft.com/playwright:v1.64.1-noble'
$repo = $RootDir -replace '\\', '/'
# The script is TypeScript (Node in the container runs it directly); the temporary package must be an ES module
$inner = 'mkdir -p /tmp/ic && cd /tmp/ic && npm init -y >/dev/null 2>&1 && npm pkg set type=module' +
    ' && npm i --no-audit --no-fund playwright@1.64.1 >/dev/null 2>&1' +
    ' && cp /repo/scripts/build-icon.ts /tmp/ic/ && node /tmp/ic/build-icon.ts /repo/branding/logo.svg /repo/src/Cv.Desktop/Assets/app.ico'

New-Item -ItemType Directory -Force -Path (Join-Path $RootDir 'src\Cv.Desktop\Assets') | Out-Null
Write-Host 'Erzeuge src\Cv.Desktop\Assets\app.ico (Playwright-Container) ...'
& docker run --rm -v "${repo}:/repo" $image sh -c $inner
if ($LASTEXITCODE -ne 0) {
    throw "Die Icon-Erzeugung ist fehlgeschlagen (docker beendet mit Code $LASTEXITCODE). Die Ausgabe oben nennt den Grund."
}
Write-Host 'src\Cv.Desktop\Assets\app.ico ist aktuell.'
