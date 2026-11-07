/**
 * Erzeugt die Drittanbieter-Lizenzhinweise aus den TATSAECHLICH ausgelieferten Abhaengigkeiten:
 *   - THIRD-PARTY-NOTICES.md                     (Repo-Wurzel, inkl. Lizenztexte)
 *   - frontend/public/third-party-licenses.json  (fuer Einstellungen / Ueber in der App)
 *
 * Frontend: alle Nicht-Dev-Pakete aus package-lock.json (Build-Werkzeuge landen nicht im Produkt).
 * Backend: alle NuGet-Pakete (Server & Desktop) inkl. transitiver Pakete, Lizenz aus der .nuspec.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

interface Entry {
  name: string
  version: string
  license: string
  url: string | null
  component: 'Web-Oberfläche' | 'Server' | 'Windows-App'
  text: string | null
}

const root = resolve(import.meta.dirname, '..')
const branding = JSON.parse(readFileSync(join(root, 'branding.json'), 'utf8')) as { name: string; company: string }
const product = branding.name
const entries: Entry[] = []

function licenseText(dir: string): string | null {
  if (!existsSync(dir)) return null
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying|notice)(\.|$|-)/i.test(f))
  return file ? readFileSync(join(dir, file), 'utf8').trim() : null
}

// ---------- Frontend (npm) ----------
const lockPath = join(root, 'frontend', 'package-lock.json')
if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
    packages: Record<string, { version?: string; license?: string; dev?: boolean; devOptional?: boolean }>
  }
  for (const [path, info] of Object.entries(lock.packages)) {
    if (!path.startsWith('node_modules/') || info.dev || info.devOptional) continue
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length)
    const dir = join(root, 'frontend', path)
    let license = info.license ?? null
    let url: string | null = null
    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      license ??= typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? null)
      url = pkg.homepage ?? (typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository?.url ?? null))
    }
    entries.push({
      name,
      version: info.version ?? '?',
      license: license ?? 'UNKNOWN',
      url,
      component: 'Web-Oberfläche',
      text: licenseText(dir),
    })
  }
}

// ---------- Backend (NuGet) ----------
const buildOnly = /^(Microsoft\.EntityFrameworkCore\.Design|Microsoft\.CodeAnalysis.*|Humanizer.*|Microsoft\.Build.*|Mono\.TextTemplating|System\.CodeDom|System\.Composition.*|Microsoft\.VisualStudio\.SolutionPersistence)$/
type NugetListing = {
  projects: {
    frameworks?: {
      topLevelPackages?: { id: string; resolvedVersion: string }[]
      transitivePackages?: { id: string; resolvedVersion: string }[]
    }[]
  }[]
}
const nugetRoot = join(homedir(), '.nuget', 'packages')
const seen = new Set<string>()

const KNOWN_LICENSES: Record<string, string> = {
  typstsharp: 'Apache-2.0',
  'documentformat.openxml': 'MIT',
  'documentformat.openxml.framework': 'MIT',
  'microsoft.web.webview2': 'BSD-3-Clause',
  velopack: 'MIT',
  qrcode: 'MIT',
  qrcoder: 'MIT',
}

const nugetProjects = [
  { csproj: join(root, 'src', 'Cv.Server', 'Cv.Server.csproj'), component: 'Server' as const },
  { csproj: join(root, 'src', 'Cv.Desktop', 'Cv.Desktop.csproj'), component: 'Windows-App' as const },
]

for (const project of nugetProjects) {
  if (!existsSync(project.csproj)) continue
  try {
    const raw = execFileSync('dotnet', ['list', project.csproj, 'package', '--include-transitive', '--format', 'json'], {
      encoding: 'utf8',
    })
    const listing = JSON.parse(raw) as NugetListing
    for (const fw of listing.projects[0]?.frameworks ?? []) {
      for (const p of [...(fw.topLevelPackages ?? []), ...(fw.transitivePackages ?? [])]) {
        if (seen.has(p.id) || buildOnly.test(p.id)) continue
        seen.add(p.id)
        const dir = join(nugetRoot, p.id.toLowerCase(), p.resolvedVersion)
        let license = 'UNKNOWN'
        let url = `https://www.nuget.org/packages/${p.id}/${p.resolvedVersion}`
        const nuspec = existsSync(dir) ? readdirSync(dir).find((f) => f.endsWith('.nuspec')) : undefined
        if (nuspec) {
          const xml = readFileSync(join(dir, nuspec), 'utf8')
          const expr = /<license\s+type="expression"\s*>([^<]+)<\/license>/i.exec(xml)
          const file = /<license\s+type="file"\s*>([^<]+)<\/license>/i.exec(xml)
          const legacy = /<licenseUrl>([^<]+)<\/licenseUrl>/i.exec(xml)
          license = expr ? expr[1] : file ? `Siehe Lizenzdatei (${file[1]})` : legacy ? `Siehe ${legacy[1]}` : license
          url = /<projectUrl>([^<]+)<\/projectUrl>/i.exec(xml)?.[1] ?? url
        }
        if (license === 'UNKNOWN' || license.startsWith('Siehe')) {
          license = KNOWN_LICENSES[p.id.toLowerCase()] ?? license
        }
        entries.push({
          name: p.id,
          version: p.resolvedVersion,
          license,
          url,
          component: project.component,
          text: licenseText(dir),
        })
      }
    }
  } catch (err) {
    console.warn(`Warnung beim Lesen von ${project.csproj}:`, err)
  }
}

// ---------- Zusätzliche Kern-Komponenten ----------
entries.push({
  name: 'Typst',
  version: '0.13.x',
  license: 'Apache-2.0',
  url: 'https://github.com/typst/typst',
  component: 'Server',
  text: 'Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0)',
})

entries.sort((a, b) => a.component.localeCompare(b.component) || a.name.localeCompare(b.name))

// ---------- Ausgabe ----------
const md = [
  '# Third-Party Notices / Drittanbieter-Lizenzen',
  '',
  `${product} enthält die folgenden Open-Source-Komponenten. Für sie gelten ausschließlich ihre eigenen Lizenzen.`,
  `${product} includes the following open-source components, each governed solely by its own license.`,
  '',
  `© 2026 ${branding.company} · Hauptlizenz: [GNU Affero General Public License v3.0](LICENSE)`,
  '',
  '_Automatisch erzeugt von `scripts/generate-third-party-notices.ts` – nicht von Hand bearbeiten._',
  '',
  '| Komponente | Paket | Version | Lizenz | Website / Repository |',
  '|---|---|---|---|---|',
  ...entries.map((e) => `| ${e.component} | ${e.name} | ${e.version} | ${e.license} | ${e.url ? `[Link](${e.url})` : '-'} |`),
  '',
  '## Lizenztexte / License Texts',
  '',
  ...entries
    .filter((e) => e.text)
    .flatMap((e) => [
      `### ${e.name} (${e.version}) - ${e.license}`,
      '',
      '```',
      e.text!,
      '```',
      '',
    ]),
].join('\n')

writeFileSync(join(root, 'THIRD-PARTY-NOTICES.md'), md, 'utf8')
writeFileSync(join(root, 'frontend', 'public', 'third-party-licenses.json'), JSON.stringify(entries, null, 2), 'utf8')
console.log(`${entries.length} Komponenten erfasst -> THIRD-PARTY-NOTICES.md & frontend/public/third-party-licenses.json`)

