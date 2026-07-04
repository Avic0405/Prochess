/**
 * ProChess.live — proper favicon fix
 * Creates a real multi-size .ico file and an SVG favicon.
 * Run: node scripts/fix-favicon.mjs
 */
import sharp from 'sharp';
import toIco from 'to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT    = path.resolve(__dirname, '..');
const ICONS   = path.join(ROOT, 'apps/frontend/public/icons');
const PUBLIC  = path.join(ROOT, 'apps/frontend/public');
const APP_DIR = path.join(ROOT, 'apps/frontend/src/app');

// ── ProChess SVG (same as generate-icons.mjs) ───────────────────────────────
const LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="44%" r="62%">
      <stop offset="0%"   stop-color="#4C1D95" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#080812" stop-opacity="1"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#7C3AED" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#7C3AED" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="#080812"/>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <rect width="512" height="512" rx="96" fill="url(#glow)"/>
  <rect x="5" y="5" width="502" height="502" rx="92" fill="none"
        stroke="#8B5CF6" stroke-width="6" opacity="0.9"/>
  <text x="300" y="430"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="450" font-weight="900"
        fill="#3B1B6E" text-anchor="middle" opacity="0.9">P</text>
  <rect x="243" y="56"  width="20" height="58" rx="5" fill="white"/>
  <rect x="220" y="74"  width="66" height="20" rx="5" fill="white"/>
  <polygon points="190,162 216,106 244,147 253,106 262,147 290,106 316,162" fill="white"/>
  <rect x="192" y="158" width="122" height="19" rx="4" fill="white"/>
  <ellipse cx="253" cy="181" rx="64" ry="13" fill="white"/>
  <rect x="206" y="180" width="94" height="110" rx="5" fill="white"/>
  <ellipse cx="253" cy="290" rx="64" ry="13" fill="white"/>
  <rect x="192" y="299" width="122" height="21" rx="5" fill="white"/>
  <rect x="174" y="318" width="158" height="23" rx="6" fill="white"/>
</svg>`;

async function pngAt(size) {
  const inner = Math.round(size * 0.88);
  const pad   = Math.round((size - inner) / 2);
  return sharp(Buffer.from(LOGO_SVG))
    .resize(inner, inner, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
    .extend({ top: pad, bottom: size - inner - pad, left: pad, right: size - inner - pad,
              background: { r:8, g:8, b:18, alpha:255 } })
    .flatten({ background: { r:8, g:8, b:18 } })
    .png()
    .toBuffer();
}

async function main() {
  console.log('\n🔧  ProChess.live — favicon fix\n');

  // 1. Generate fresh PNGs at ico-standard sizes
  console.log('📐  Generating PNG sizes for ICO...');
  const [png16, png32, png48] = await Promise.all([pngAt(16), pngAt(32), pngAt(48)]);
  console.log('  ✓ 16×16, 32×32, 48×48 PNGs ready');

  // Also regenerate the standalone PNGs in /icons/
  fs.writeFileSync(path.join(ICONS, 'favicon-16x16.png'), png16);
  fs.writeFileSync(path.join(ICONS, 'favicon-32x32.png'), png32);
  fs.writeFileSync(path.join(ICONS, 'favicon-48x48.png'), png48);
  console.log('  ✓ /icons/favicon-{16,32,48}x*.png updated');

  // 2. Create a REAL multi-size ICO file (16 + 32 + 48)
  console.log('\n🖼   Creating real ICO file...');
  const icoBuffer = await toIco([png16, png32, png48]);
  fs.writeFileSync(path.join(PUBLIC,  'favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(APP_DIR, 'favicon.ico'), icoBuffer);
  console.log(`  ✓ public/favicon.ico  (${icoBuffer.length} bytes, real ICO format)`);
  console.log(`  ✓ src/app/favicon.ico  (Next.js App Router)`);

  // 3. Write SVG favicon to public/
  console.log('\n🎨  Writing SVG favicon...');
  fs.writeFileSync(path.join(PUBLIC, 'favicon.svg'), LOGO_SVG.trim());
  console.log('  ✓ public/favicon.svg');

  // 4. Remove conflicting app/icon.png and app/apple-icon.png
  //    (file-based icons override metadata icons in Next.js — we want metadata to control this)
  const conflicting = [
    path.join(APP_DIR, 'icon.png'),
    path.join(APP_DIR, 'apple-icon.png'),
  ];
  for (const f of conflicting) {
    if (fs.existsSync(f)) { fs.unlinkSync(f); console.log(`  ✓ removed ${path.relative(ROOT, f)}`); }
  }

  console.log('\n✅  Favicon fix complete!\n');
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
