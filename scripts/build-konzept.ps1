<#
  Builds the project documents as PDF in the on-demand Playwright container (no local browser install):
    docs\handbuch\de\HANDBUCH.md  -> docs\handbuch\de\Vitafolio-Handbuch.pdf   (once the manual exists)
    docs\handbuch\en\HANDBOOK.md  -> docs\handbuch\en\Vitafolio-Handbook.pdf   (once the manual exists)
    intern\Konzept.md             -> intern\Konzept.pdf   (only when that private, git-ignored file exists)
  Missing sources are skipped silently. Run after every change to one of these files:  .\scripts\build-konzept.ps1
#>
$ErrorActionPreference = 'Stop'
$RootDir = Split-Path -Parent $PSScriptRoot

$image = 'mcr.microsoft.com/playwright:v1.64.1-noble'
$repo = $RootDir -replace '\\', '/'
$logo = '/repo/branding/logo.svg'

$jobs = @(
    @{ Source = 'docs\handbuch\de\HANDBUCH.md'; Target = 'docs/handbuch/de/Vitafolio-Handbuch.pdf' },
    @{ Source = 'docs\handbuch\en\HANDBOOK.md'; Target = 'docs/handbuch/en/Vitafolio-Handbook.pdf' },
    @{ Source = 'intern\Konzept.md'; Target = 'intern/Konzept.pdf' }
) | Where-Object { Test-Path -LiteralPath (Join-Path $RootDir $_.Source) }

if (-not $jobs) {
    Write-Host 'Keine Quelldatei gefunden - nichts zu tun.'
    exit 0
}

# The renderer is TypeScript (Node in the container runs it directly); the temporary package must be an ES module
$inner = 'mkdir -p /tmp/kp && cd /tmp/kp && npm init -y >/dev/null 2>&1 && npm pkg set type=module' +
    ' && npm i --no-audit --no-fund marked@18 playwright@1.64.1 @fontsource/inter@5 @fontsource/jetbrains-mono@5 >/dev/null 2>&1' +
    ' && cp /repo/scripts/konzept-pdf.ts /tmp/kp/'
foreach ($job in $jobs) {
    $source = '/repo/' + ($job.Source -replace '\\', '/')
    $inner += " && node /tmp/kp/konzept-pdf.ts $source /repo/$($job.Target) $logo"
}

Write-Host 'Erzeuge die PDFs im Playwright-Container ...'
& docker run --rm -v "${repo}:/repo" $image sh -c $inner
if ($LASTEXITCODE -ne 0) {
    throw "Die PDF-Erzeugung ist fehlgeschlagen (docker beendet mit Code $LASTEXITCODE). Die Ausgabe oben nennt den Grund."
}
foreach ($job in $jobs) { Write-Host "Aktuell: $($job.Target)" }
