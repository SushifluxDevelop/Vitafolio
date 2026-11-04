// Renders the brand logo (branding/logo.svg) into the Windows program's multi-size icon (src/Cv.Desktop/Assets/app.ico).
// The .ico file is committed, so a normal build needs neither Docker nor a browser; run this again whenever the logo changes:
//   .\scripts\build-icon.ps1
// Runs inside the on-demand Playwright container (Chromium renders the SVG exactly as a browser does):
//   node build-icon.ts <logo.svg> <target.ico>
// The ICO holds PNG-compressed images (16-256 px), which Windows supports since Vista.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const [source, target] = process.argv.slice(2);
if (!source || !target) {
  console.error('Aufruf: node build-icon.ts <logo.svg> <ziel.ico>');
  process.exit(2);
}

const svg = readFileSync(source, 'utf8');
const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];

const browser = await chromium.launch();
const page = await browser.newPage();
const images: Buffer[] = [];
for (const size of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  images.push(await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
}
await browser.close();

// ICONDIR (6 bytes) + one ICONDIRENTRY (16 bytes) per image, then the PNG payloads
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((png, i) => {
  const entry = 6 + 16 * i;
  const size = sizes[i];
  header.writeUInt8(size >= 256 ? 0 : size, entry);
  header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
  header.writeUInt8(0, entry + 2);
  header.writeUInt8(0, entry + 3);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
writeFileSync(target, Buffer.concat([header, ...images]));
console.log(`Icon geschrieben: ${target} (${sizes.join(', ')} px)`);
