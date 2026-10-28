const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = '/tmp/cookies.txt';
const EMAIL = process.env.BURNER_EMAIL;
const PASSWORD = process.env.BURNER_PASSWORD;

async function refreshCookies() {
  if (!EMAIL || !PASSWORD) {
    console.error('BURNER_EMAIL or BURNER_PASSWORD not set. Skipping cookie refresh.');
    return false;
  }

  console.log('Starting automated cookie refresh...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Go to Google Login
    await page.goto('https://accounts.google.com/signin/v2/identifier', { waitUntil: 'networkidle' });
    
    // 2. Enter Email
    await page.fill('input[type="email"]', EMAIL);
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(2000);

    // 3. Enter Password
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(5000);

    // 4. Handle possible 2FA / Challenge page
    // If you have 2FA enabled, this script will pause here. You may need to handle it.
    // A common workaround is to use an App Password instead of your real password.

    // 5. Go to YouTube to finalize session
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 6. Extract cookies
    const cookies = await context.cookies();
    
    // Convert to Netscape format
    let netscapeCookies = '# Netscape HTTP Cookie File\n';
    netscapeCookies += '# https://curl.haxx.se/rfc/cookie_spec.html\n';
    netscapeCookies += '# This is a generated file! Do not edit.\n\n';

    for (const cookie of cookies) {
      const domain = cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`;
      const includeSubdomains = 'TRUE';
      const pathStr = cookie.path || '/';
      const secure = cookie.secure ? 'TRUE' : 'FALSE';
      const expiry = cookie.expires ? Math.floor(cookie.expires) : 0;
      netscapeCookies += `${domain}\t${includeSubdomains}\t${pathStr}\t${secure}\t${expiry}\t${cookie.name}\t${cookie.value}\n`;
    }

    // 7. Save to file
    fs.writeFileSync(COOKIES_FILE, netscapeCookies);
    console.log('Successfully refreshed and saved cookies.');
    return true;

  } catch (error) {
    console.error('Error during cookie refresh:', error);
    return false;
  } finally {
    await browser.close();
  }
}

// Run immediately on startup, then every 6 hours
refreshCookies().then(success => {
    if (success) console.log('Initial cookie refresh successful.');
});

// Schedule refresh every 6 hours (6 * 60 * 60 * 1000 ms)
setInterval(refreshCookies, 21600000);

module.exports = { refreshCookies };
