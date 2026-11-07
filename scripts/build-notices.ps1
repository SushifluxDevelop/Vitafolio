<#
  Generates THIRD-PARTY-NOTICES.md (repo root) and frontend\public\third-party-licenses.json.
  Aufruf: .\scripts\build-notices.ps1
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command 'node' -ErrorAction SilentlyContinue)) {
    throw 'node wurde nicht gefunden. Bitte Node.js installieren.'
}

Push-Location $root
try {
    Write-Host '== Erzeuge THIRD-PARTY-NOTICES.md ...'
    & node 'scripts\generate-third-party-notices.ts'
    if ($LASTEXITCODE -ne 0) { throw 'Fehler beim Erzeugen der THIRD-PARTY-NOTICES.md' }
}
finally {
    Pop-Location
}
