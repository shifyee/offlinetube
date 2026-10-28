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
      ? { headless: false, args: ['--no-remote', '--disable-gpu'] }
      : {
          headless: false,
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
    await page.waitForTimeout(3000);

    console.log(`[Refresher] [${browserName}] Waiting for email field...`);
    const emailSelectors = ['input[name="identifier"]', 'input[type="email"]', 'input[autocomplete="username"]'];
    let emailInput = null;
    for (const selector of emailSelectors) {
      try {
        emailInput = await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
        if (emailInput) break;
      } catch (e) { /* try next */ }
    }
    if (!emailInput) throw new Error('Email field not found');

    console.log(`[Refresher] [${browserName}] Entering email...`);
    await emailInput.fill(EMAIL);
    await page.waitForTimeout(500);
    await page.click('button:has-text("Next")').catch(() => page.keyboard.press('Enter'));

    console.log(`[Refresher] [${browserName}] Waiting for password field...`);
    await page.waitForTimeout(3000); 

    const passwordInput = page.getByLabel('Enter your password');
    await passwordInput.waitFor({ state: 'visible', timeout: 15000 });

    console.log(`[Refresher] [${browserName}] Entering password...`);
    await passwordInput.fill(PASSWORD);
    await page.waitForTimeout(500);
    await page.click('button:has-text("Next")').catch(() => page.keyboard.press('Enter'));

    console.log(`[Refresher] [${browserName}] Waiting for post-login navigation...`);
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});

    const titleAfter = await page.title();
    console.log(`[Refresher] [${browserName}] Page title after login: ${titleAfter}`);

    if (titleAfter.toLowerCase().includes('sign in')) {
      throw new Error('Still on sign-in page. Check password or 2FA.');
    }

    console.log(`[Refresher] [${browserName}] Login successful. Navigating to YouTube...`);
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle', timeout: 45000 });
    
    // THE FIX: Wait 10 seconds for full cookie session to load
    console.log(`[Refresher] [${browserName}] Waiting 10 seconds for YouTube session to load...`);
    await page.waitForTimeout(10000);

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

refreshCookies().catch(err => console.error('[Refresher] Uncaught error:', err.message));
setInterval(() => {
  refreshCookies().catch(err => console.error('[Refresher] Uncaught error:', err.message));
}, 6 * 60 * 60 * 1000);

module.exports = { refreshCookies };
