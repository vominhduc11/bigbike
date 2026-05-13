const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_URL = process.env.SCREENSHOT_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/screenshots');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'homepage-full-desktop.png');

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 600;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 120);
    });
  });
}

async function closeCommonOverlays(page) {
  const selectors = [
    'button:has-text("Accept")',
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("Đồng ý")',
    'button:has-text("Chấp nhận")',
    '[aria-label="close"]',
    '[aria-label="Close"]',
    '.close',
    '.popup-close',
    '.modal-close',
    '.chat-close',
  ];

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible({ timeout: 500 })) {
        await locator.click({ timeout: 1000 });
      }
    } catch {
      // Ignore optional overlay close failures.
    }
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 900,
    },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  try {
    await page.goto(SCREENSHOT_URL, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.waitForTimeout(1500);
    await closeCommonOverlays(page);
    await autoScroll(page);
    await page.waitForTimeout(800);

    await page.screenshot({
      path: OUTPUT_FILE,
      fullPage: true,
      type: 'png',
      animations: 'disabled',
      caret: 'hide',
    });

    console.log(`Full-page homepage screenshot exported: ${OUTPUT_FILE}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Failed to capture homepage screenshot.');
  console.error(error);
  process.exit(1);
});
