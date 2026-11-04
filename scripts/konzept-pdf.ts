// Renders a project document (concept or user manual) from Markdown to a designed A4 PDF: cover page with logo,
// table of contents, chapters on new pages with a large chapter number, callout boxes with icons, styled tables/code,
// running header and footer with page numbers, in Vitafolio's brand colours (navy and gold). Runs inside the Playwright
// container via scripts/build-konzept.ps1 (marked, playwright and the fonts are installed into a temporary folder there).
//   node konzept-pdf.ts <source.md> <target.pdf> [logo.svg]
// Front matter (--- key: value ---): title, subtitle, tagline, version, date, status, classification, copyright, lang.
// Chapters are "# 1 Title", sections "## …". Callouts: "> [!HINWEIS] …", [!TIPP], [!WARNUNG], [!OFFEN],
// [!ENTSCHEIDUNG] (English: NOTE, TIP, WARNING, OPEN, DECISION).
// Figures: an image alone in its paragraph, ![Caption title](bilder/file.png), becomes a numbered figure
// ("Abbildung 1: Caption title" / "Figure 1: …"). Images are embedded; PNG screenshots are taken at device scale 2 and
// shown at their natural size (title "1x" for an image taken at scale 1). A missing image file stops the build.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { Marked } from 'marked';
import { chromium } from 'playwright';

const [source, target, logoPath] = process.argv.slice(2);
let markdown = readFileSync(source, 'utf8').replace(/\r\n/g, '\n');

const meta: Record<string, string> = {};
const frontMatter = /^---\n([\s\S]*?)\n---\n/.exec(markdown);
if (frontMatter) {
  for (const line of frontMatter[1].split('\n')) {
    const match = /^(\w+):\s*(.*)$/.exec(line);
    if (match) meta[match[1]] = match[2].trim();
  }
  markdown = markdown.slice(frontMatter[0].length);
}
const lang = meta.lang || 'de';
const en = lang === 'en';
const escape = (text: unknown) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const logo = logoPath && existsSync(logoPath) ? readFileSync(logoPath, 'utf8').replace(/<\?xml[^>]*>/, '') : '';

// The watermark is the mark alone: the logo's plate, its edge and the plate gradient are left out
const watermark = logo.replace(/<defs>[\s\S]*?<\/defs>/, '').replace(/<rect[^>]*\/>/g, '');

// Fonts are embedded as data URIs: the container has no Segoe UI, and the PDF must look the same everywhere
const fontSource = (pkg: string, file: string) => {
  const url = new URL(`./node_modules/@fontsource/${pkg}/files/${file}`, import.meta.url);
  return existsSync(url) ? `url(data:font/woff2;base64,${readFileSync(url).toString('base64')}) format('woff2')` : null;
};
const fontFaces = [
  ...[400, 500, 600, 700, 800].flatMap((w) => [
    ['Inter', 'inter', `inter-latin-${w}-normal.woff2`, w],
    ['Inter', 'inter', `inter-latin-ext-${w}-normal.woff2`, w],
  ]),
  ['JetBrains Mono', 'jetbrains-mono', 'jetbrains-mono-latin-400-normal.woff2', 400],
]
  .map(([family, pkg, file, weight]) => [family, fontSource(String(pkg), String(file)), weight])
  .filter(([, src]) => src)
  .map(([family, src, weight]) => `@font-face { font-family: '${family}'; src: ${src}; font-weight: ${weight}; font-style: normal; }`)
  .join('\n');

// Small line icons for the callouts (24px grid, stroke = currentColor)
const ICONS: Record<string, string> = {
  note: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>',
  tip: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.4 1 2.5h6c0-1.1.3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  warn: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  open: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  decision: '<path d="M5 12l5 5L20 7"/>',
};
const icon = (name: string) =>
  `<svg class="callout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

const CALLOUTS: Record<string, [string, string]> = {
  HINWEIS: ['note', 'Hinweis'], NOTE: ['note', 'Note'],
  TIPP: ['tip', 'Tipp'], TIP: ['tip', 'Tip'],
  WARNUNG: ['warn', 'Warnung'], WARNING: ['warn', 'Warning'],
  OFFEN: ['open', 'Offen'], OPEN: ['open', 'Open'],
  ENTSCHEIDUNG: ['decision', 'Entscheidung'], DECISION: ['decision', 'Decision'],
};

// Images are embedded as data URIs (page.setContent has no base URL); PNG width read from the IHDR header
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const embedImage = (href: string, title: string | null) => {
  if (/^(https?:|data:)/i.test(href)) return { src: href, style: '' };
  const file = resolve(dirname(source), decodeURI(href));
  if (!existsSync(file)) throw new Error(`Bild nicht gefunden: ${href} (gesucht unter ${file})`);
  const data = readFileSync(file);
  const ext = extname(file).toLowerCase();
  const scale = title && /\b1x\b/i.test(title) ? 1 : 2;
  const width = ext === '.png' && data.length > 24 ? data.readUInt32BE(16) / scale : 0;
  return {
    src: `data:${MIME[ext] ?? 'application/octet-stream'};base64,${data.toString('base64')}`,
    style: width ? ` style="width: ${width}px"` : '',
  };
};
let figureNo = 0;
const figureLabel = en ? 'Figure' : 'Abbildung';

// Headings get stable ids for the table of contents; "# 4 Title" becomes a chapter with a large number
const toc: { level: number; id: string; number?: string; title: string }[] = [];
const used = new Set<string>();
const slugify = (text: string) => {
  let slug =
    text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kapitel';
  while (used.has(slug)) slug += '-x';
  used.add(slug);
  return slug;
};
const marked = new Marked({
  renderer: {
    heading(this: any, token: any) {
      const id = slugify(token.text);
      if (token.depth === 1) {
        const numbered = /^(\d+)\s+(.*)$/.exec(token.text);
        const title = numbered ? numbered[2] : token.text;
        const number = numbered ? numbered[1].padStart(2, '0') : '';
        toc.push({ level: 1, id, number, title: escape(title) });
        return `<h1 id="${id}" class="chapter">${number ? `<span class="chapter-no">${number}</span>` : ''}<span class="chapter-title">${escape(title)}</span></h1>\n`;
      }
      const html = this.parser.parseInline(token.tokens);
      const numbered = /^(\d+(?:\.\d+)+)\s+(.*)$/.exec(token.text);
      if (token.depth === 2) toc.push({ level: 2, id, title: html });
      if (numbered) {
        return `<h${token.depth} id="${id}"><span class="section-no">${numbered[1]}</span> ${escape(numbered[2])}</h${token.depth}>\n`;
      }
      return `<h${token.depth} id="${id}">${html}</h${token.depth}>\n`;
    },
    paragraph(this: any, token: any) {
      const parts = token.tokens.filter((t: any) => !(t.type === 'text' && !t.text.trim()));
      if (parts.length === 1 && parts[0].type === 'image') {
        const image = parts[0];
        const { src, style } = embedImage(image.href, image.title);
        figureNo += 1;
        return `<figure class="figure" id="abbildung-${figureNo}"><img src="${src}" alt="${escape(image.text)}"${style}><figcaption><span class="fig-no">${figureLabel} ${figureNo}:</span> ${escape(image.text)}</figcaption></figure>\n`;
      }
      return `<p>${this.parser.parseInline(token.tokens)}</p>\n`;
    },
    image(token: any) {
      const { src, style } = embedImage(token.href, token.title);
      return `<img src="${src}" alt="${escape(token.text)}"${style}>`;
    },
    blockquote(this: any, token: any) {
      const marker = /^\s*\[!(\w+)\]\s*/.exec(token.text);
      const callout = marker ? CALLOUTS[marker[1].toUpperCase()] : null;
      let inner = this.parser.parse(token.tokens);
      if (!callout) return `<blockquote>${inner}</blockquote>\n`;
      inner = inner.replace(/\[!\w+\]\s*/, '');
      return `<blockquote class="callout ${callout[0]}"><div class="callout-head">${icon(callout[0])}<span>${callout[1]}</span></div>${inner}</blockquote>\n`;
    },
  },
});
const content = marked.parse(markdown) as string;

const coverRows = [
  ['Version', meta.version],
  [en ? 'Date' : 'Stand', meta.date],
  ['Status', meta.status],
  [en ? 'Classification' : 'Einstufung', meta.classification],
]
  .filter(([, value]) => value)
  .map(([label, value]) => `<div class="cover-row"><span>${label}</span><strong>${escape(value)}</strong></div>`)
  .join('');
const tocHtml = toc
  .map((e) =>
    e.level === 1
      ? `<li class="toc-l1"><a href="#${e.id}"><span class="toc-no">${e.number}</span><span>${e.title}</span></a></li>`
      : `<li class="toc-l2"><a href="#${e.id}">${e.title}</a></li>`,
  )
  .join('');
const docName = [meta.title, meta.subtitle].filter(Boolean).join(' · ');
const footerLabel = [docName, meta.version && `Version ${meta.version}`].filter(Boolean).join(' · ');

const css = `
${fontFaces}
:root {
  --ink: #0f172a; --ink-2: #334155; --muted: #64748b; --line: #e2e8f0; --soft: #f8fafc;
  --navy: #14213D; --accent: #2B4170; --accent-2: #3D5A94; --accent-soft: #EEF2F8;
  --gold: #A27420; --gold-2: #D9AE57; --gold-soft: #FBF6EA;
  --cover-bg: #0A1428;
  --note: #2B4170; --note-soft: #F1F4FA; --tip: #047857; --tip-soft: #ecfdf5;
  --warn: #b91c1c; --warn-soft: #fef2f2; --open: #A27420; --open-soft: #FBF6EA;
  --decision: #6d28d9; --decision-soft: #f5f3ff;
}
@page { size: A4; margin: 22mm 18mm 20mm 18mm;
  @top-right { content: "${escape(docName)}"; font: 600 7pt Inter, sans-serif; color: #94a3b8; letter-spacing: 0.08em; text-transform: uppercase; }
  @bottom-left { content: "${escape(footerLabel)}"; font: 7.5pt Inter, sans-serif; color: #64748b; }
  @bottom-right { content: counter(page) " / " counter(pages); font: 600 7.5pt Inter, sans-serif; color: #2B4170; } }
@page cover { margin: 0; @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: Inter, "Segoe UI", system-ui, sans-serif; font-size: 9.6pt; line-height: 1.62; color: var(--ink);
  hyphens: auto; font-feature-settings: "cv11", "ss01"; }
strong, b { font-weight: 700; }

/* ---------- Cover: deep navy, warm gold glow top right, soft blue glow bottom left, the leaf V as watermark ---------- */
.cover { page: cover; width: 210mm; height: 297mm; break-after: page; position: relative; overflow: hidden;
  background:
    radial-gradient(85% 55% at 92% 4%, rgba(217, 174, 87, 0.30) 0%, rgba(217, 174, 87, 0) 62%),
    radial-gradient(65% 45% at 0% 100%, rgba(61, 90, 148, 0.45) 0%, rgba(61, 90, 148, 0) 62%),
    linear-gradient(165deg, #1A2C52 0%, var(--cover-bg) 68%);
  color: #e2e8f0; display: flex; flex-direction: column; justify-content: space-between; padding: 26mm 22mm 16mm; }
.cover-watermark { position: absolute; right: -18mm; bottom: 34mm; width: 150mm; height: 150mm; opacity: 0.11; transform: rotate(-8deg); }
.cover-watermark svg { width: 100%; height: 100%; }
.cover-brand { position: relative; display: flex; align-items: center; gap: 13px; font-size: 15pt; font-weight: 700; letter-spacing: 0.02em; color: #fff; }
.cover-logo { width: 52px; height: 52px; filter: drop-shadow(0 8px 22px rgba(217, 174, 87, 0.35)); }
.cover-logo svg { width: 100%; height: 100%; }
.cover-main { position: relative; }
.cover-kicker { display: inline-block; margin: 0 0 5mm; padding: 1.4mm 3.2mm; border: 1px solid rgba(217, 174, 87, 0.6); border-radius: 999px;
  font-size: 7.8pt; font-weight: 700; letter-spacing: 0.28em; text-transform: uppercase; color: #E9C77F; background: rgba(217, 174, 87, 0.08); }
.cover-title { margin: 0 0 7mm; font-size: 50pt; line-height: 1; font-weight: 800; letter-spacing: -0.03em; color: #fff;
  text-shadow: 0 0 28px rgba(217, 174, 87, 0.25); }
.cover-rule { width: 46mm; height: 3px; margin: 0 0 7mm; border-radius: 3px; background: linear-gradient(90deg, #6B8BC9, #D9AE57); }
.cover-tagline { max-width: 140mm; font-size: 12.5pt; line-height: 1.55; color: #cbd5e1; margin: 0 0 15mm; }
.cover-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4mm; max-width: 166mm; }
.cover-row { padding: 3mm 3.5mm; border-radius: 6px; background: rgba(10, 20, 40, 0.55); border: 1px solid rgba(148, 163, 184, 0.22); }
.cover-row span { display: block; font-size: 6.6pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.16em; color: #94a3b8; }
.cover-row strong { font-size: 10.5pt; font-weight: 600; color: #fff; }
.cover-footer { position: relative; font-size: 8pt; color: #94a3b8; display: flex; justify-content: space-between;
  border-top: 1px solid rgba(148, 163, 184, 0.25); padding-top: 4mm; }
.cover-footer .heart { color: #4ade80; }

/* ---------- Table of contents ---------- */
.toc { break-after: page; }
.toc-title { font-size: 26pt; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 2mm; color: var(--navy); }
.toc-rule { width: 30mm; height: 3px; border-radius: 3px; background: linear-gradient(90deg, var(--accent-2), var(--gold-2)); margin-bottom: 8mm; }
.toc ol { list-style: none; margin: 0; padding: 0; columns: 2; column-gap: 12mm; }
.toc li { break-inside: avoid; }
.toc a { color: inherit; text-decoration: none; display: flex; gap: 3mm; padding: 0.6mm 0; }
.toc .toc-l1 { margin-top: 3mm; font-weight: 700; font-size: 10pt; border-top: 1px solid var(--line); padding-top: 1.5mm; break-after: avoid; }
.toc .toc-no { min-width: 7mm; color: var(--gold); font-weight: 800; }
.toc .toc-l2 a { padding-left: 10mm; color: var(--ink-2); font-size: 8.4pt; line-height: 1.35; }

/* ---------- Content ---------- */
.content h1.chapter { break-before: page; margin: 0 0 7mm; padding-bottom: 4mm; position: relative; }
.content h1.chapter::after { content: ""; position: absolute; left: 0; bottom: 0; width: 100%; height: 2px;
  background: linear-gradient(90deg, var(--accent-2), var(--gold-2) 55%, rgba(217, 174, 87, 0)); }
.content .chapter-no { display: block; font-size: 40pt; line-height: 1; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 1mm; color: var(--accent-2); }
.content .chapter-no::after { content: "."; color: var(--gold-2); }
.content .chapter-title { display: block; font-size: 23pt; line-height: 1.15; font-weight: 800; letter-spacing: -0.02em; color: var(--navy); }
.content h2 { font-size: 13.5pt; font-weight: 700; margin: 8mm 0 2.5mm; color: var(--navy); break-after: avoid; }
.content h2 .section-no { color: var(--gold); margin-right: 1.5mm; }
.content h3 { font-size: 11pt; font-weight: 700; margin: 5.5mm 0 1.5mm; color: var(--ink-2); break-after: avoid; }
.content p { margin: 0 0 2.8mm; orphans: 3; widows: 3; }
.content ul, .content ol { margin: 0 0 3.2mm; padding-left: 6mm; }
.content li { margin: 0.9mm 0; }
.content li::marker { color: var(--gold); font-weight: 700; }
.content a { color: var(--accent); text-decoration: none; }
.content code { font-family: "JetBrains Mono", Consolas, monospace; font-size: 8.2pt; background: var(--accent-soft); color: #1F3566;
  border-radius: 3px; padding: 0.2mm 1.2mm; }
/* Code blocks: DejaVu Sans Mono (part of the container image) has the box-drawing characters in the same width as letters */
.content pre { font-family: "DejaVu Sans Mono", "JetBrains Mono", monospace; background: #0E1830; color: #e2e8f0; border-radius: 6px; padding: 4mm 4.5mm; font-size: 7.6pt; line-height: 1.42;
  overflow: hidden; white-space: pre; break-inside: avoid; border-left: 3px solid var(--gold-2); }
.content pre code { background: none; color: inherit; padding: 0; font-size: inherit; }
.content table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 2mm 0 4.5mm; font-size: 8.7pt; line-height: 1.45;
  border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
.content thead { display: table-header-group; }
.content tr { break-inside: avoid; }
.content th { text-align: left; font-weight: 700; color: #fff; background: linear-gradient(90deg, #14213D, #2B4170); padding: 2mm 2.6mm; }
.content td { border-top: 1px solid var(--line); padding: 1.8mm 2.6mm; vertical-align: top; }
.content tbody tr:nth-child(even) td { background: var(--soft); }
.content blockquote { margin: 3.5mm 0 4.5mm; padding: 3mm 4mm; border-left: 3px solid var(--gold-2); background: var(--gold-soft);
  color: var(--ink-2); border-radius: 0 6px 6px 0; break-inside: avoid; }
.content blockquote p:last-child { margin-bottom: 0; }
.callout-head { display: flex; align-items: center; gap: 2mm; margin-bottom: 1.2mm; font-size: 7.4pt; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.14em; }
.callout-icon { width: 13px; height: 13px; }
.content blockquote.note { background: var(--note-soft); border-color: var(--note); } .content blockquote.note .callout-head { color: var(--note); }
.content blockquote.tip { background: var(--tip-soft); border-color: var(--tip); } .content blockquote.tip .callout-head { color: var(--tip); }
.content blockquote.warn { background: var(--warn-soft); border-color: var(--warn); } .content blockquote.warn .callout-head { color: var(--warn); }
.content blockquote.open { background: var(--open-soft); border-color: var(--open); } .content blockquote.open .callout-head { color: var(--open); }
.content blockquote.decision { background: var(--decision-soft); border-color: var(--decision); } .content blockquote.decision .callout-head { color: var(--decision); }
/* Architecture diagrams as HTML boxes (left: clients, middle: labelled connections, right: server) */
.diagram { display: grid; grid-template-columns: 1fr 34mm 1.15fr; gap: 4mm; align-items: stretch; margin: 2mm 0 6mm;
  padding: 5mm; border-radius: 8px; background: linear-gradient(135deg, #F1F4FA, #FBF6EA); border: 1px solid var(--line); break-inside: avoid; }
.dg-col { display: flex; flex-direction: column; gap: 4mm; justify-content: center; }
.dg-box { padding: 3mm 3.5mm; border-radius: 6px; background: #fff; border: 1px solid #C9D3E6; box-shadow: 0 2px 8px rgba(20, 33, 61, 0.08); }
.dg-box strong { display: block; font-size: 9.4pt; color: var(--navy); margin-bottom: 0.8mm; }
.dg-box span { display: block; font-size: 8pt; color: var(--ink-2); line-height: 1.45; }
.dg-box em { display: block; margin-top: 1mm; font-size: 7.6pt; font-style: normal; color: var(--gold); font-weight: 600; }
.dg-main { border-color: var(--accent); border-width: 1.5px; background: linear-gradient(180deg, #ffffff, #F1F4FA); }
.dg-main span + span { margin-top: 1.2mm; padding-top: 1.2mm; border-top: 1px dashed #C9D3E6; }
.dg-links { display: flex; flex-direction: column; justify-content: space-around; }
.dg-link { position: relative; text-align: center; padding: 2mm 0 2.6mm; }
.dg-link::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; border-radius: 2px;
  background: linear-gradient(90deg, var(--accent-2), var(--gold-2)); }
.dg-link::before { content: "⇄"; position: absolute; right: -1mm; bottom: -2.4mm; font-size: 9pt; color: var(--gold); }
.dg-link b { display: block; font-size: 8pt; color: var(--navy); }
.dg-link i { display: block; font-size: 7pt; font-style: normal; color: var(--muted); }
.dg-row { display: flex; gap: 3mm; }
.dg-ext { flex: 1; text-align: center; padding: 2mm; border-radius: 6px; font-size: 8pt; font-weight: 700; color: var(--accent);
  background: var(--accent-soft); border: 1px dashed var(--accent-2); }
.content img { max-width: 100%; height: auto; }
/* Figures: the screenshot (only the part being explained) framed, with a numbered caption below */
.content .figure { margin: 4mm 0 5.5mm; text-align: center; break-inside: avoid; }
.content .figure img { display: inline-block; max-width: 100%; height: auto; border-radius: 6px; border: 1px solid var(--line);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.10); }
.content .figure figcaption { margin-top: 2.2mm; font-size: 8.4pt; line-height: 1.4; color: var(--ink-2); }
.content .figure .fig-no { font-weight: 700; color: var(--navy); }
`;

const brand = meta.title ?? 'Vitafolio';
const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${escape(footerLabel)}</title><style>${css}</style></head><body>
<section class="cover">
  ${logo ? `<div class="cover-watermark">${watermark}</div>` : ''}
  <div class="cover-brand">${logo ? `<span class="cover-logo">${logo}</span>` : ''}<span>${escape(brand)}</span></div>
  <div class="cover-main">
    <div class="cover-kicker">${escape(brand)}</div>
    <h1 class="cover-title">${escape(meta.subtitle ?? '')}</h1>
    <div class="cover-rule"></div>
    ${meta.tagline ? `<p class="cover-tagline">${escape(meta.tagline)}</p>` : ''}
    <div class="cover-meta">${coverRows}</div>
  </div>
  <div class="cover-footer"><span>${escape(meta.copyright ?? '© SushiFlux Develop')}</span><span>${en ? 'Made with <span class="heart">♥</span>' : 'Mit <span class="heart">♥</span> gemacht'}</span></div>
</section>
<nav class="toc"><h1 class="toc-title">${en ? 'Contents' : 'Inhalt'}</h1><div class="toc-rule"></div><ol>${tocHtml}</ol></nav>
<main class="content">${content}</main>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: target, format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log(`PDF geschrieben: ${target}`);
