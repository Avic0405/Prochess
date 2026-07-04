/**
 * ProChess.live — favicon & icon generator
 * Run: node scripts/generate-icons.mjs
 * Uses inline SVG — no source PNG required.
 */
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT    = path.resolve(__dirname, '..');
const ICONS   = path.join(ROOT, 'apps/frontend/public/icons');
const PUBLIC  = path.join(ROOT, 'apps/frontend/public');
const APP_DIR = path.join(ROOT, 'apps/frontend/src/app');

fs.mkdirSync(ICONS,   { recursive: true });
fs.mkdirSync(APP_DIR, { recursive: true });

// ─── ProChess.live master SVG (512×512) ─────────────────────────────────────
// Deliberately uses only SVG primitives; no external resources.
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
    <filter id="softglow">
      <feGaussianBlur stdDeviation="9" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="512" height="512" rx="96" fill="#080812"/>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <rect width="512" height="512" rx="96" fill="url(#glow)"/>

  <!-- Neon border -->
  <rect x="5" y="5" width="502" height="502" rx="92" fill="none"
        stroke="#8B5CF6" stroke-width="6" opacity="0.9"/>
  <rect x="11" y="11" width="490" height="490" rx="87" fill="none"
        stroke="#6D28D9" stroke-width="2" opacity="0.5"/>

  <!-- Large background "P" for depth -->
  <text x="300" y="430"
        font-family="Georgia, 'Times New Roman', serif"
        font-size="450" font-weight="900"
        fill="#3B1B6E" text-anchor="middle" opacity="0.9">P</text>

  <!-- ── Chess King (white, centred slightly left) ── -->
  <!-- Vertical cross bar -->
  <rect x="243" y="56"  width="20" height="58" rx="5" fill="white"/>
  <!-- Horizontal cross bar -->
  <rect x="220" y="74"  width="66" height="20" rx="5" fill="white"/>

  <!-- Crown: five-point polygon -->
  <polygon points="190,162 216,106 244,147 253,106 262,147 290,106 316,162"
           fill="white"/>
  <!-- Crown band -->
  <rect x="192" y="158" width="122" height="19" rx="4" fill="white"/>

  <!-- Collar ellipse -->
  <ellipse cx="253" cy="181" rx="64" ry="13" fill="white"/>

  <!-- Body -->
  <rect x="206" y="180" width="94" height="110" rx="5" fill="white"/>

  <!-- Base ellipse (top of base) -->
  <ellipse cx="253" cy="290" rx="64" ry="13" fill="white"/>

  <!-- Base tier 1 -->
  <rect x="192" y="299" width="122" height="21" rx="5" fill="white"/>
  <!-- Base tier 2 -->
  <rect x="174" y="318" width="158" height="23" rx="6" fill="white"/>
</svg>`;

// ─── Maskable SVG — logo in safe zone (80% centre, so 10% padding each side) ─
const MASKABLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="44%" r="62%">
      <stop offset="0%" stop-color="#4C1D95" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#080812" stop-opacity="1"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="#080812"/>
  <rect width="512" height="512" fill="url(#bg)"/>
  <!-- Logo scaled to 80% and centred — safe for all mask shapes -->
  <g transform="translate(51.2,51.2) scale(0.8)">
    <rect x="5" y="5" width="502" height="502" rx="92" fill="none"
          stroke="#8B5CF6" stroke-width="6" opacity="0.9"/>
    <text x="300" y="430"
          font-family="Georgia,'Times New Roman',serif"
          font-size="450" font-weight="900"
          fill="#3B1B6E" text-anchor="middle" opacity="0.9">P</text>
    <rect x="243" y="56" width="20" height="58" rx="5" fill="white"/>
    <rect x="220" y="74" width="66" height="20" rx="5" fill="white"/>
    <polygon points="190,162 216,106 244,147 253,106 262,147 290,106 316,162" fill="white"/>
    <rect x="192" y="158" width="122" height="19" rx="4" fill="white"/>
    <ellipse cx="253" cy="181" rx="64" ry="13" fill="white"/>
    <rect x="206" y="180" width="94" height="110" rx="5" fill="white"/>
    <ellipse cx="253" cy="290" rx="64" ry="13" fill="white"/>
    <rect x="192" y="299" width="122" height="21" rx="5" fill="white"/>
    <rect x="174" y="318" width="158" height="23" rx="6" fill="white"/>
  </g>
</svg>`;

// ─── OG image SVG (1200×630) ────────────────────────────────────────────────
const OG_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="30%" cy="50%" r="55%">
      <stop offset="0%"   stop-color="#6D28D9" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#080812" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="divider" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#6D28D9" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#6D28D9" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#080812"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- Logo mark (left side) — scaled-down king icon -->
  <g transform="translate(72, 95) scale(0.84)">
    <rect width="420" height="420" rx="78" fill="#0F0620"/>
    <rect width="420" height="420" rx="78" fill="none" stroke="#8B5CF6" stroke-width="5" opacity="0.9"/>
    <text x="246" y="354"
          font-family="Georgia,'Times New Roman',serif"
          font-size="368" font-weight="900"
          fill="#3B1B6E" text-anchor="middle" opacity="0.9">P</text>
    <rect x="199" y="46"  width="16" height="47" rx="4" fill="white"/>
    <rect x="181" y="60"  width="54" height="16" rx="4" fill="white"/>
    <polygon points="156,133 176,87 200,120 207,87 214,120 238,87 258,133" fill="white"/>
    <rect x="158" y="129" width="100" height="16" rx="3" fill="white"/>
    <ellipse cx="208" cy="148" rx="52" ry="11" fill="white"/>
    <rect x="169" y="148" width="77" height="90" rx="4" fill="white"/>
    <ellipse cx="208" cy="238" rx="52" ry="11" fill="white"/>
    <rect x="158" y="246" width="100" height="17" rx="4" fill="white"/>
    <rect x="143" y="261" width="130" height="19" rx="5" fill="white"/>
  </g>

  <!-- Divider line -->
  <rect x="500" y="120" width="2" height="390" fill="url(#divider)"/>

  <!-- Right side text -->
  <text x="548" y="248"
        font-family="Georgia,'Times New Roman',serif"
        font-size="82" font-weight="900" fill="#FFFFFF"
        letter-spacing="-1">ProChess</text>
  <text x="548" y="314"
        font-family="Georgia,'Times New Roman',serif"
        font-size="48" font-weight="400" fill="#A78BFA"
        letter-spacing="1">.live</text>

  <rect x="548" y="345" width="580" height="2" fill="#6D28D9" opacity="0.6"/>

  <text x="548" y="395"
        font-family="-apple-system, Arial, sans-serif"
        font-size="30" font-weight="400" fill="#DDD6FE"
        letter-spacing="0.3">Play Chess. Win Real Money.</text>

  <text x="548" y="460"
        font-family="-apple-system, Arial, sans-serif"
        font-size="20" font-weight="400" fill="#7C3AED"
        letter-spacing="3">prochess.live</text>
</svg>`;

// ─── Helper: SVG → PNG at target size with optional background ───────────────
async function fromSvg(svgStr, size, outPath, bg = { r:8, g:8, b:18, alpha:255 }) {
  const padded = Math.round(size * 0.06);
  const inner  = size - padded * 2;

  await sharp(Buffer.from(svgStr))
    .resize(inner, inner, { fit: 'contain', background: { r:0,g:0,b:0,alpha:0 } })
    .extend({ top: padded, bottom: padded, left: padded, right: padded, background: bg })
    .flatten({ background: bg })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath);
  console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
}

async function fromSvgExact(svgStr, w, h, outPath) {
  await sharp(Buffer.from(svgStr))
    .resize(w, h, { fit: 'fill' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath);
  console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
}

// ─── Generate ────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀  ProChess.live — generating all favicon / icon assets\n');

  // Standard favicon PNGs
  console.log('📦  Standard favicons...');
  await fromSvg(LOGO_SVG,  16, path.join(ICONS, 'favicon-16x16.png'),  { r:8,g:8,b:18,alpha:255 });
  await fromSvg(LOGO_SVG,  32, path.join(ICONS, 'favicon-32x32.png'),  { r:8,g:8,b:18,alpha:255 });
  await fromSvg(LOGO_SVG,  48, path.join(ICONS, 'favicon-48x48.png'),  { r:8,g:8,b:18,alpha:255 });
  await fromSvg(LOGO_SVG,  64, path.join(ICONS, 'favicon-64x64.png'),  { r:8,g:8,b:18,alpha:255 });

  // public/favicon.ico — 48px PNG served at /favicon.ico (browsers accept PNG here)
  fs.copyFileSync(path.join(ICONS, 'favicon-48x48.png'), path.join(PUBLIC, 'favicon.ico'));
  console.log(`  ✓ apps/frontend/public/favicon.ico`);

  // Apple touch icon
  console.log('\n🍎  Apple icons...');
  await fromSvg(LOGO_SVG, 180, path.join(ICONS, 'apple-touch-icon.png'), { r:8,g:8,b:18,alpha:255 });

  // Android / PWA
  console.log('\n🤖  Android / PWA icons...');
  await fromSvg(LOGO_SVG, 192, path.join(ICONS, 'android-chrome-192x192.png'), { r:8,g:8,b:18,alpha:255 });
  await fromSvg(LOGO_SVG, 512, path.join(ICONS, 'android-chrome-512x512.png'), { r:8,g:8,b:18,alpha:255 });

  // Aliases used in manifest
  fs.copyFileSync(path.join(ICONS, 'android-chrome-192x192.png'), path.join(ICONS, 'icon-192.png'));
  fs.copyFileSync(path.join(ICONS, 'android-chrome-512x512.png'), path.join(ICONS, 'icon-512.png'));
  console.log(`  ✓ icons/icon-192.png  (alias)`);
  console.log(`  ✓ icons/icon-512.png  (alias)`);

  // Maskable icon
  console.log('\n🎭  Maskable icon...');
  await fromSvg(MASKABLE_SVG, 512, path.join(ICONS, 'maskable-icon-512.png'), { r:8,g:8,b:18,alpha:255 });

  // Windows tile
  console.log('\n🪟  Windows tile...');
  await fromSvg(LOGO_SVG, 150, path.join(ICONS, 'mstile-150x150.png'), { r:109,g:40,b:217,alpha:255 });

  // OG image
  console.log('\n🖼   OG image (1200×630)...');
  await fromSvgExact(OG_SVG, 1200, 630, path.join(PUBLIC, 'og-image.png'));

  // App Router static copies (Next.js serves these automatically)
  console.log('\n⚛️   Next.js App Router copies...');
  fs.copyFileSync(path.join(ICONS, 'favicon-48x48.png'), path.join(APP_DIR, 'favicon.ico'));
  console.log(`  ✓ src/app/favicon.ico`);
  fs.copyFileSync(path.join(ICONS, 'android-chrome-512x512.png'), path.join(APP_DIR, 'icon.png'));
  console.log(`  ✓ src/app/icon.png`);
  fs.copyFileSync(path.join(ICONS, 'apple-touch-icon.png'), path.join(APP_DIR, 'apple-icon.png'));
  console.log(`  ✓ src/app/apple-icon.png`);

  console.log('\n✅  All done!\n');
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
