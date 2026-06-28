import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const EMAIL = `demo${Date.now()}@chess.com`;
const USERNAME = `Demo${Date.now().toString().slice(-5)}`;
const PASSWORD = 'Demo@12345';

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('🚀 Launching browser...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 600,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  // ── Step 1: Register ────────────────────────────────────────────────────
  console.log('📝 Registering new account...');
  await page.goto(`${BASE}/register`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"]', EMAIL);
  await delay(300);
  await page.fill('input[placeholder="ChessWizard99"]', USERNAME);
  await delay(300);

  const pwFields = await page.locator('input[type="password"]').all();
  await pwFields[0].fill(PASSWORD);
  await delay(300);
  await pwFields[1].fill(PASSWORD);
  await delay(300);

  // Keep region as USD
  await page.click('button[type="submit"], button:has-text("Create Account")');
  console.log('   Waiting for redirect to login...');
  await page.waitForURL(`**/login**`, { timeout: 10000 });
  console.log('   ✓ Registered successfully');

  await delay(1000);

  // ── Step 2: Login ───────────────────────────────────────────────────────
  console.log('🔑 Logging in...');
  await page.waitForLoadState('networkidle');

  // Fill email-or-username field (first text input)
  await page.fill('input[type="text"], input:not([type="password"])', EMAIL);
  await delay(300);
  await page.fill('input[type="password"]', PASSWORD);
  await delay(300);

  await page.click('button[type="submit"], button:has-text("Sign In")');
  console.log('   Waiting for dashboard...');
  await page.waitForURL(`**/dashboard**`, { timeout: 15000 });
  console.log('   ✓ Logged in — on Dashboard');

  await delay(2000);

  // ── Step 3: Explore Dashboard ───────────────────────────────────────────
  console.log('📊 Viewing dashboard...');
  await page.waitForLoadState('networkidle');
  await delay(2000);

  // ── Step 4: Go to Lobby ─────────────────────────────────────────────────
  console.log('🎮 Navigating to Lobby...');
  await page.click('a[href="/lobby"], a:has-text("Play")');
  await page.waitForURL(`**/lobby**`, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await delay(1500);
  console.log('   ✓ On Lobby');

  // ── Step 5: Select FREE match + Blitz 5+0 ──────────────────────────────
  console.log('⚙️  Selecting Free match, Blitz 5+0...');
  // Click FREE game type (should be already selected)
  const freeBtn = page.locator('button:has-text("Free Match")');
  if (await freeBtn.isVisible()) await freeBtn.click();
  await delay(500);

  // Select Blitz 5+0 time control
  const blitzBtn = page.locator('button:has-text("Blitz 5+0")');
  if (await blitzBtn.isVisible()) await blitzBtn.click();
  await delay(500);

  // ── Step 6: Start matchmaking ───────────────────────────────────────────
  console.log('🔍 Starting matchmaking...');
  await page.click('button:has-text("Find Match")');
  await delay(2000);
  console.log('   ✓ Searching for opponent...');

  // ── Step 7: Open second browser context as opponent ────────────────────
  console.log('🤝 Opening second player window...');
  const context2 = await browser.newContext({ viewport: null });
  const page2 = await context2.newPage();
  await page2.goto(`${BASE}/register`);
  await page2.waitForLoadState('networkidle');

  const EMAIL2 = `opponent${Date.now()}@chess.com`;
  const USER2 = `Bot${Date.now().toString().slice(-5)}`;

  await page2.fill('input[type="email"]', EMAIL2);
  await page2.fill('input[placeholder="ChessWizard99"]', USER2);
  const pw2 = await page2.locator('input[type="password"]').all();
  await pw2[0].fill(PASSWORD);
  await pw2[1].fill(PASSWORD);
  await page2.click('button[type="submit"], button:has-text("Create Account")');
  await page2.waitForURL(`**/login**`, { timeout: 10000 });

  await page2.waitForLoadState('networkidle');
  await page2.fill('input[type="text"], input:not([type="password"])', EMAIL2);
  await page2.fill('input[type="password"]', PASSWORD);
  await page2.click('button[type="submit"], button:has-text("Sign In")');
  await page2.waitForURL(`**/dashboard**`, { timeout: 15000 });
  console.log('   ✓ Second player logged in');

  // Navigate second player to lobby and search
  await page2.goto(`${BASE}/lobby`);
  await page2.waitForLoadState('networkidle');
  await delay(1000);

  const freeBtn2 = page2.locator('button:has-text("Free Match")');
  if (await freeBtn2.isVisible()) await freeBtn2.click();
  await delay(400);

  const blitzBtn2 = page2.locator('button:has-text("Blitz 5+0")');
  if (await blitzBtn2.isVisible()) await blitzBtn2.click();
  await delay(400);

  await page2.click('button:has-text("Find Match")');
  console.log('   ✓ Second player searching...');

  // ── Step 8: Wait for both to match ─────────────────────────────────────
  console.log('⏳ Waiting for match to be found...');
  await Promise.race([
    page.waitForURL(`**/game/**`, { timeout: 30000 }),
    page2.waitForURL(`**/game/**`, { timeout: 30000 }),
  ]);
  await delay(2000);

  // Wait for both to reach game page
  try {
    await page.waitForURL(`**/game/**`, { timeout: 10000 });
  } catch {}
  try {
    await page2.waitForURL(`**/game/**`, { timeout: 10000 });
  } catch {}

  console.log('   ✓ MATCH FOUND! Both players in game');
  await delay(2000);

  // ── Step 9: Make some moves ─────────────────────────────────────────────
  console.log('♟️  Making moves...');

  // Bring page1 (white) to front and make first move
  await page.bringToFront();
  await page.waitForLoadState('networkidle');
  await delay(2000);

  // Helper: click a square on the chessboard
  async function clickSquare(p, square) {
    const selector = `[data-square="${square}"], .square-${square}`;
    const el = p.locator(selector).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      await el.click();
      return true;
    }
    return false;
  }

  // White: e2 -> e4
  console.log('   White: e2-e4');
  const movedE2 = await clickSquare(page, 'e2');
  if (movedE2) {
    await delay(600);
    await clickSquare(page, 'e4');
    await delay(800);
  }

  // Black: e7 -> e5
  await page2.bringToFront();
  await delay(1500);
  console.log('   Black: e7-e5');
  const movedE7 = await clickSquare(page2, 'e7');
  if (movedE7) {
    await delay(600);
    await clickSquare(page2, 'e5');
    await delay(800);
  }

  // White: Nf3
  await page.bringToFront();
  await delay(1500);
  console.log('   White: Nf3');
  await clickSquare(page, 'g1');
  await delay(600);
  await clickSquare(page, 'f3');
  await delay(800);

  // Black: Nc6
  await page2.bringToFront();
  await delay(1500);
  console.log('   Black: Nc6');
  await clickSquare(page2, 'b8');
  await delay(600);
  await clickSquare(page2, 'c6');
  await delay(800);

  // White: Bc4
  await page.bringToFront();
  await delay(1500);
  console.log('   White: Bc4');
  await clickSquare(page, 'f1');
  await delay(600);
  await clickSquare(page, 'c4');
  await delay(800);

  // ── Step 10: Show final state ───────────────────────────────────────────
  console.log('');
  console.log('='.repeat(50));
  console.log('DEMO COMPLETE!');
  console.log('='.repeat(50));
  console.log(`Player 1: ${USERNAME} (${EMAIL})`);
  console.log(`Player 2: ${USER2} (${EMAIL2})`);
  console.log(`Password: ${PASSWORD}`);
  console.log('Both tabs remain open — enjoy playing!');

  // Keep browser open for the user
  // await browser.close();
})();
