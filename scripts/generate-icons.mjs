/**
 * ProChess.live — favicon & app icon generator
 * Run: node scripts/generate-icons.mjs
 * Requires: npm install sharp  (run once from repo root)
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC  = path.join(ROOT, 'apps/frontend/public/logo-source.png');
const ICONS = path.join(ROOT, 'apps/frontend/public/icons');
const PUBLIC = path.join(ROOT, 'apps/frontend/public');
const APP_DIR = path.join(ROOT, 'apps/frontend/src/app');

if (!fs.existsSync(SRC)) {
  console.error('\n❌  Source logo not found at:\n   ', SRC);
  console.error('\nSave your ProChess.live logo there and re-run.\n');
  process.exit(1);
}

fs.mkdirSync(ICONS, { recursive: true });

// Brand colours
const BRAND_BG   = { r: 8,   g: 8,   b: 18,  alpha: 1 };   // #080812
const BRAND_DARK = { r: 13,  g: 5,   b: 30,  alpha: 1 };   // slightly lighter bg for OG
const PURPLE     = '#6D28D9';

// ─── Helper ────────────────────────────────────────────────────────────────

async function resizeWithPadding(size, outPath, {
  paddingFactor = 0.1,   // logo occupies (1-2*paddingFactor) of canvas
  background = { r: 8, g: 8, b: 18, alpha: 255 },
} = {}) {
  const logoSize = Math.round(size * (1 - 2 * paddingFactor));
  const pad      = Math.round((size - logoSize) / 2);

  await sharp(SRC)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: pad, bottom: size - logoSize - pad, left: pad, right: size - logoSize - pad,
              background })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath);
  console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
}

async function resizePlain(size, outPath) {
  await sharp(SRC)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath);
  console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
}

// ─── Standard favicons ─────────────────────────────────────────────────────

async function generateFavicons() {
  console.log('\n📦  Generating standard favicons...');

  await resizeWithPadding(16,  path.join(ICONS, 'favicon-16x16.png'),  { paddingFactor: 0.06 });
  await resizeWithPadding(32,  path.join(ICONS, 'favicon-32x32.png'),  { paddingFactor: 0.06 });
  await resizeWithPadding(48,  path.join(ICONS, 'favicon-48x48.png'),  { paddingFactor: 0.06 });
  await resizeWithPadding(64,  path.join(ICONS, 'favicon-64x64.png'),  { paddingFactor: 0.06 });

  // favicon.ico — embed 16, 32, 48 sizes
  // sharp does not write .ico natively; we create a 48px PNG and copy as .ico fallback
  // Modern browsers accept PNG for favicon.ico slot
  const icoSrc = path.join(ICONS, 'favicon-48x48.png');
  const icoDst = path.join(PUBLIC, 'favicon.ico');
  fs.copyFileSync(icoSrc, icoDst);
  console.log(`  ✓ apps/frontend/public/favicon.ico  (48px PNG fallback)`);

  // Next.js App Router copies: app/favicon.ico
  const appIco = path.join(APP_DIR, 'favicon.ico');
  fs.copyFileSync(icoSrc, appIco);
  console.log(`  ✓ apps/frontend/src/app/favicon.ico`);
}

// ─── Apple touch icon ──────────────────────────────────────────────────────

async function generateApple() {
  console.log('\n🍎  Generating Apple icons...');

  // Apple requires opaque background — dark brand bg
  await resizeWithPadding(180, path.join(ICONS, 'apple-touch-icon.png'), {
    paddingFactor: 0.1,
    background: { r: 8, g: 8, b: 18, alpha: 255 },
  });

  // Next.js App Router: app/apple-icon.png
  fs.copyFileSync(
    path.join(ICONS, 'apple-touch-icon.png'),
    path.join(APP_DIR, 'apple-icon.png'),
  );
  console.log(`  ✓ apps/frontend/src/app/apple-icon.png`);
}

// ─── Android / PWA icons ───────────────────────────────────────────────────

async function generateAndroid() {
  console.log('\n🤖  Generating Android / PWA icons...');

  await resizeWithPadding(192, path.join(ICONS, 'android-chrome-192x192.png'), { paddingFactor: 0.08 });
  await resizeWithPadding(512, path.join(ICONS, 'android-chrome-512x512.png'), { paddingFactor: 0.08 });

  // Aliases used in manifest
  fs.copyFileSync(path.join(ICONS, 'android-chrome-192x192.png'), path.join(ICONS, 'icon-192.png'));
  fs.copyFileSync(path.join(ICONS, 'android-chrome-512x512.png'), path.join(ICONS, 'icon-512.png'));
  console.log(`  ✓ icons/icon-192.png  (alias)`);
  console.log(`  ✓ icons/icon-512.png  (alias)`);

  // Next.js App Router icon.png (used for <link rel="icon" sizes="any">)
  fs.copyFileSync(path.join(ICONS, 'android-chrome-512x512.png'), path.join(APP_DIR, 'icon.png'));
  console.log(`  ✓ apps/frontend/src/app/icon.png`);
}

// ─── Maskable icon (safe-zone 80% padding) ─────────────────────────────────

async function generateMaskable() {
  console.log('\n🎭  Generating maskable icon...');

  // Safe zone = inner 80% circle; logo must fit in central 40% to survive all mask shapes
  await resizeWithPadding(512, path.join(ICONS, 'maskable-icon-512.png'), {
    paddingFactor: 0.18,
    background: { r: 8, g: 8, b: 18, alpha: 255 },
  });
}

// ─── Windows tile ──────────────────────────────────────────────────────────

async function generateMsTile() {
  console.log('\n🪟  Generating Windows tile...');

  await resizeWithPadding(150, path.join(ICONS, 'mstile-150x150.png'), {
    paddingFactor: 0.15,
    background: { r: 109, g: 40, b: 217, alpha: 255 },  // brand purple bg for MS tile
  });
}

// ─── OG / Social image (1200×630) ──────────────────────────────────────────

async function generateOgImage() {
  console.log('\n🖼   Generating OG image (1200×630)...');

  const W = 1200, H = 630;
  const LOGO_SIZE = 320;
  const PAD = (LOGO_SIZE * 0.05) | 0;

  // Resize logo
  const logoBuffer = await sharp(SRC)
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Background: dark gradient-like solid + subtle purple vignette via overlay
  const bg = await sharp({
    create: { width: W, height: H, channels: 4,
               background: { r: 8, g: 8, b: 18, alpha: 255 } }
  }).png().toBuffer();

  // Purple radial "glow" circle centered slightly left of center
  const glowR = 320;
  const glow = Buffer.from(`
    <svg width="${W}" height="${H}">
      <defs>
        <radialGradient id="g" cx="42%" cy="50%" r="50%">
          <stop offset="0%"   stop-color="#6D28D9" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#6D28D9" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
    </svg>`);

  // Text SVG — right side
  const textSvg = Buffer.from(`
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <text x="680" y="270"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="88" font-weight="800" fill="#FFFFFF"
        letter-spacing="-2">ProChess</text>
      <text x="680" y="340"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="44" font-weight="500" fill="#A78BFA"
        letter-spacing="1">.live</text>
      <text x="682" y="420"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="30" font-weight="400" fill="#C4B5FD"
        letter-spacing="0.5">Play Chess. Win Real Money.</text>
      <line x1="680" y1="460" x2="1140" y2="460"
        stroke="#6D28D9" stroke-width="2" opacity="0.6"/>
      <text x="680" y="495"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="22" font-weight="400" fill="#7C3AED" opacity="0.9"
        letter-spacing="3">prochess.live</text>
    </svg>`);

  const logoLeft = 80;
  const logoTop  = (H - LOGO_SIZE) / 2;

  await sharp(bg)
    .composite([
      { input: await sharp(glow).png().toBuffer(), blend: 'over' },
      { input: logoBuffer, left: logoLeft, top: logoTop | 0 },
      { input: await sharp(textSvg).png().toBuffer(), blend: 'over' },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(PUBLIC, 'og-image.png'));

  console.log(`  ✓ apps/frontend/public/og-image.png`);
}

// ─── Run all ───────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀  ProChess.live — icon generation starting\n   Source:', SRC);
  try {
    await generateFavicons();
    await generateApple();
    await generateAndroid();
    await generateMaskable();
    await generateMsTile();
    await generateOgImage();
    console.log('\n✅  All icons generated successfully!\n');
    console.log('   Next step: run  git add -A && git commit -m "chore: add favicon system"\n');
  } catch (err) {
    console.error('\n❌  Generation failed:', err.message);
    process.exit(1);
  }
}

main();
