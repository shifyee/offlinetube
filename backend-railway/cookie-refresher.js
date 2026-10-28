const { chromium, firefox } = require('rebrowser-playwright');
const fs = require('fs');

const COOKIES_FILE = '/tmp/cookies.txt';
const EMAIL = process.env.BURNER_EMAIL;
const PASSWORD = process.env.BURNER_PASSWORD;
const DISABLED = process.env.DISABLE_COOKIE_REFRESHER === 'true';

// Helper to click through Google's consent/onboarding screens
async function acceptGoogleConsent(page) {
  const selectors = [
    'button:has-text("I agree")',
    'button:has-text("Accept all")',
    'button:has-text("Continue")',
    'button:has-text("Got it")',
    'button:has-text("Next")',
    'button:has-text("Get started")',
    'div[role="button"]:has-text("I agree")',
    'div[role="button"]:has-text("Accept all")',
    'div[role="button"]:has-text("Continue")',
  ];
  for (let i = 0; i < 5; i++) {
    let clicked = false;
    for (const sel of selectors) {
      try {
        const loc = page.locator(sel).first();
        if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) {
          await loc.click({ timeout: 4000 });
          console.log(`[Refresher] Clicked consent button: ${sel}`);
          clicked = true;
          break;
        }
      } catch (e) { /* try next selector */ }
    }
    if (!clicked) break;
    await page.waitForTimeout(2000);
  }
}

async function tryBrowser(browserType, browserName) {
  console.log(`[Refresher] Trying ${browserName}...`);
  
  let browser = null;
  try {
    const launchOptions = browserName === 'firefox'
      ? { headless: false, args: ['--no-remote', '--disable-gpu'] }
      : {
          headless: false,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process', // RAM saver
            '--no-zygote'       // RAM saver
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
    await page.waitForTimeout(3000);

    // Email step
    console.log(`[Refresher] [${browserName}] Waiting for email field...`);
    const emailInput = await page.waitForSelector('input[name="identifier"]', { timeout: 10000, state: 'visible' });
    await emailInput.fill(EMAIL);
    await page.waitForTimeout(500);
    await page.click('button:has-text("Next")').catch(() => page.keyboard.press('Enter'));

    // Password step
    console.log(`[Refresher] [${browserName}] Waiting for password field...`);
    await page.waitForTimeout(3000);
    const passwordInput = page.getByLabel('Enter your password');
    await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
    await passwordInput.fill(PASSWORD);
    await page.waitForTimeout(500);
    await page.click('button:has-text("Next")').catch(() => page.keyboard.press('Enter'));

    console.log(`[Refresher] [${browserName}] Waiting for post-login navigation...`);
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // --- KEY FIX: Handle Google's post-login consent/welcome pages ---
    console.log(`[Refresher] [${browserName}] Checking for consent screens...`);
    await acceptGoogleConsent(page);
    await page.waitForTimeout(3000);
    
    const titleAfterConsent = await page.title();
    console.log(`[Refresher] [${browserName}] Title after consent: ${titleAfterConsent}`);

    if (titleAfterConsent.toLowerCase().includes('sign in')) {
      throw new Error('Still on sign-in page after password/consent. Check password or 2FA.');
    }

    console.log(`[Refresher] [${browserName}] Navigating to YouTube...`);
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle', timeout: 45000 });
    
    // Handle YouTube's own cookie consent banner if it appears
    await acceptGoogleConsent(page);

    // --- KEY FIX: Wait 10 seconds for the full session to load ---
    console.log(`[Refresher] [${browserName}] Waiting 10 seconds for YouTube session to load...`);
    await page.waitForTimeout(10000);

    const cookies = await context.cookies();
    const cookieNames = cookies.map(c => c.name);

    console.log(`[Refresher] [${browserName}] Cookie count: ${cookies.length}`);
    console.log(`[Refresher] [${browserName}] Cookie names: ${cookieNames.join(', ')}`);

    // Verify we have real auth cookies before overwriting the file
    const authCookieNames = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', 'LOGIN_INFO', '__Secure-1PSID', '__Secure-3PSID'];
    const hasAuth = authCookieNames.some(name => cookieNames.includes(name));

    if (!hasAuth) {
      throw new Error(`No YouTube auth cookies found. Got ${cookies.length} cookies: ${cookieNames.join(', ')}`);
    }

    if (cookies.length < 20) {
      console.warn(`[Refresher] [${browserName}] ⚠️ Only ${cookies.length} cookies. Auth cookie exists, but session may be partial.`);
    }

    // Write cookies in Netscape format
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
    return false;
  } finally {
    try { await browser.close(); } catch (e) {}
  }
}

async function refreshCookies() {
  if (DISABLED) return;
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

// Delay start to let the server boot and free up RAM
setTimeout(() => {
  refreshCookies().catch(err => console.error('[Refresher] Uncaught error:', err.message));
}, 60000);

setInterval(() => {
  refreshCookies().catch(err => console.error('[Refresher] Uncaught error:', err.message));
}, 6 * 60 * 60 * 1000);

module.exports = { refreshCookies };
