const { chromium } = require('rebrowser-playwright');
const fs = require('fs');

const COOKIES_FILE = '/tmp/cookies.txt';
const EMAIL = process.env.BURNER_EMAIL;
const PASSWORD = process.env.BURNER_PASSWORD;

async function refreshCookies() {
  if (!EMAIL || !PASSWORD) {
    console.error('BURNER_EMAIL or BURNER_PASSWORD not set. Skipping cookie refresh.');
    return false;
  }

  console.log('Starting automated cookie refresh (rebrowser mode)...');
  
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();

  try {
    console.log('Navigating to Google login...');
    await page.goto('https://accounts.google.com/signin/v2/identifier', { waitUntil: 'networkidle', timeout: 45000 });
    
    console.log('Waiting for email input...');
    await page.waitForSelector('input[type="email"]', { timeout: 20000 });
    
    console.log('Entering email...');
    await page.fill('input[type="email"]', EMAIL);
    await page.waitForTimeout(500);
    await page.click('button:has-text("Next")');
    
    console.log('Waiting for password field...');
    await page.waitForSelector('input[type="password"]', { timeout: 20000 });
    
    console.log('Entering password...');
    await page.fill('input[type="password"]', PASSWORD);
    await page.waitForTimeout(500);
    await page.click('button:has-text("Next")');
    
    console.log('Waiting for login to complete...');
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {
        console.log('Navigation timeout. Continuing anyway...');
    });

    console.log(`Current page title: ${await page.title()}`);
    
    console.log('Navigating to YouTube...');
    await page.goto('https://www.youtube.com', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    console.log('Extracting cookies...');
    const cookies = await context.cookies();
    
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

    fs.writeFileSync(COOKIES_FILE, netscapeCookies);
    console.log(`Successfully refreshed and saved cookies (${cookies.length} total).`);
    return true;

  } catch (error) {
    console.error('Error during cookie refresh:', error.message);
    try {
        console.log(`Failed at page title: ${await page.title()}`);
    } catch (e) {}
    return false;
  } finally {
    await browser.close();
  }
}

refreshCookies().then(success => {
    if (success) console.log('Initial cookie refresh successful.');
    else console.log('Initial cookie refresh failed. Will try again in 6 hours.');
});

setInterval(refreshCookies, 21600000);

module.exports = { refreshCookies };
