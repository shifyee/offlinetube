const { chromium, firefox } = require('rebrowser-playwright');
const fs = require('fs');

const COOKIES_FILE = '/tmp/cookies.txt';
const EMAIL = process.env.BURNER_EMAIL;
const PASSWORD = process.env.BURNER_PASSWORD;
const DISABLED = process.env.DISABLE_COOKIE_REFRESHER === 'true';

async function tryBrowser(browserType, browserName) {
  console.log(`[Refresher] Trying ${browserName}...`);
  
  let browser = null;
  try {
    const launchOptions = browserName === 'firefox'
      ? { headless: true, args: ['--no-remote', '--disable-gpu'] }
      : {
          headless: true,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
          ],
          ignoreDefaultArgs: ['--enable-automation']
        };

    browser = await browserType.launch(launchOptions);
  } catch (launchError) {
    console.error(`[Refresher] Could not launch ${browserName}: ${launchError.message}`);
    return false;
  }

  const context = await browser.newContext({
    userAgent: browserName === 'firefox'
      ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    console.log(`[Refresher] [${browserName}] Navigating to Google login...`);
    await page.goto('https://accounts.google.com/signin/v2/identifier', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    // ── EMAIL STEP ────────────────────────────────────────────────
    console.log(`[Refresher] [${browserName}] Waiting for email field...`);
    const emailSelectors = ['input[name="identifier"]', 'input[type="email"]', 'input[autocomplete="username"]'];
    let emailInput = null;
    for (const selector of emailSelectors) {
      try {
        emailInput = await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
        if (emailInput) {
          console.log(`[Refresher] [${browserName}] Found email with: ${selector}`);
          break;
        }
      } catch (e) { /* try next */ }
    }
    if (!emailInput) throw new Error('Email field not found');

    console.log(`[Refresher] [${browserName}] Entering email...`);
    await emailInput.fill(EMAIL);
    await page.waitForTimeout(500);
    await page.click('button:has-text("Next")').catch(() => page.keyboard.press('Enter'));

    // ── PASSWORD STEP ─────────────────────────────────────────────
    // Google has TWO password fields:
    //   1. name="hiddenPassword" (aria-hidden, a trap for bots)
    //   2. name="password" (the real one)
    // We must target the real one — the hidden one is invisible.
    console.log(`[Refresher] [${browserName}] Waiting for VISIBLE password field...`);
    await page.waitForTimeout(2000); // Let the page settle

    const passwordSelectors = [
      'input[name="password"][type="password"]:not([aria-hidden="true"])',
      'input[type="password"]:not([aria-hidden="true"]):not([name="hiddenPassword"])',
      'input[autocomplete="current-password"]'
    ];

    let passwordInput = null;
    for (const selector of passwordSelectors) {
      try {
        passwordInput = await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
        if (passwordInput) {
          console.log(`[Refresher] [${browserName}] Found visible password with: ${selector}`);
          break;
        }
      } catch (e) { /* try next */ }
    }
    if (!passwordInput) throw new Error('Visible password field not found');

    console.log(`[Refresher] [${browserName}] Entering password...`);
    await passwordInput.fill(PASSWORD);
    await page.waitForTimeout(500);

    // Capture response status to detect "wrong password" vs "success"
    console.log(`[Refresher] [${browserName}] Submitting password...`);
    await page.click('button:has-text("Next")').catch(() => page.keyboard.press('Enter'));

    console.log(`[Refresher] [${browserName}] Waiting for post-login navigation...`);
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});

    // Check if we're still on the sign-in page (wrong password or verification)
    const titleAfter = await page.title();
    console.log(`[Refresher] [${browserName}] Page title after login: ${titleAfter}`);

    if (titleAfter.toLowerCase().includes('sign in')) {
      // We're still on a Google sign-in page — could be 2FA, "verify it's you", or wrong password
      const pageText = await page.content();
      if (pageText.includes('Verify it') || pageText.includes('verify it')) {
        throw new Error('Google requested identity verification (2FA / phone check). Disable 2FA on burner or use an App Password.');
      }
      if (pageText.includes('Wrong password') || pageText.includes("couldn't find")) {
        throw new Error('Google rejected the password. Check BURNER_PASSWORD.');
      }
      if (pageText.includes('unusual activity')) {
        throw new Error('Google flagged unusual activity from this IP. This burner account may be blocked from Railway.');
      }
      throw new Error(`Still on sign-in page. May need manual verification. Title: ${titleAfter}`);
    }

    // ── YOUTUBE COOKIE EXTRACTION ─────────────────────────────────
    console.log(`[Refresher] [${browserName}] Login successful. Navigating to YouTube...`);
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);

    const cookies = await context.cookies();
    let netscapeCookies = '# Netscape HTTP Cookie File\n';
    netscapeCookies += '# https://curl.haxx.se/rfc/cookie_spec.html\n';
    netscapeCookies += '# This is a generated file! Do not edit.\n\n';

    for (const cookie of cookies) {
      const domain = cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`;
      const secure = cookie.secure ? 'TRUE' : 'FALSE';
      const expiry = cookie.expires ? Math.floor(cookie.expires) : 0;
      netscapeCookies += `${domain}\tTRUE\t${cookie.path || '/'}\t${secure}\t${expiry}\t${cookie.name}\t${cookie.value}\n`;
    }

    fs.writeFileSync(COOKIES_FILE, netscapeCookies);
    console.log(`[Refresher] [${browserName}] ✅ Successfully wrote ${cookies.length} cookies.`);
    return true;

  } catch (err) {
    console.error(`[Refresher] [${browserName}] ❌ Failed: ${err.message}`);
    try { console.log(`[Refresher] [${browserName}] Page title: ${await page.title()}`); } catch (e) {}
    return false;
  } finally {
    try { await browser.close(); } catch (e) {}
  }
}

async function refreshCookies() {
  if (DISABLED) {
    console.log('[Refresher] Disabled via DISABLE_COOKIE_REFRESHER=true');
    return;
  }
  if (!EMAIL || !PASSWORD) {
    console.log('[Refresher] Skipped — BURNER_EMAIL or BURNER_PASSWORD not set.');
    return;
  }

  console.log('[Refresher] Starting cookie refresh attempt...');

  const chromiumOk = await tryBrowser(chromium, 'chromium');
  if (chromiumOk) return;

  console.log('[Refresher] Chromium failed. Trying Firefox...');
  const firefoxOk = await tryBrowser(firefox, 'firefox');
  if (firefoxOk) return;

  console.log('[Refresher] ❌ Both browsers failed. Will retry in 6 hours.');
}

// Never crash the server
refreshCookies().catch(err => console.error('[Refresher] Uncaught error:', err.message));
setInterval(() => {
  refreshCookies().catch(err => console.error('[Refresher] Uncaught error:', err.message));
}, 6 * 60 * 60 * 1000);

module.exports = { refreshCookies };
