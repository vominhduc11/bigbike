const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TARGETS = [
  { name: 'desktop-1440', viewport: { width: 1440, height: 900 }, path: '/san-pham/' },
  { name: 'tablet-1024', viewport: { width: 1024, height: 768 }, path: '/san-pham/' },
  { name: 'tablet-768', viewport: { width: 768, height: 1024 }, path: '/san-pham/' },
  { name: 'mobile-390', viewport: { width: 390, height: 844 }, path: '/san-pham/' },
];

const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/product-listing/audit');

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 600;
      const timer = setInterval(() => {
        const scrollHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
        );
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

async function captureCase(page, target, suffix) {
  const url = `${BASE_URL}${target.path}`;
  await page.setViewportSize(target.viewport);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await autoScroll(page);
  await page.waitForTimeout(500);

  const layoutInfo = await page.evaluate(() => {
    const layout = document.querySelector('.wp-cat-layout');
    const grid = document.querySelector('.wp-product-grid');
    const filters = document.querySelector('.wp-filters-v2');
    const cards = document.querySelectorAll('.wp-product-card');
    const head = document.querySelector('.wp-catalog-head');
    const chat = document.querySelector('.wp-floating-group');
    return {
      layoutHeight: layout?.getBoundingClientRect().height,
      gridHeight: grid?.getBoundingClientRect().height,
      gridColumns: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
      filtersHeight: filters?.getBoundingClientRect().height,
      filtersWidth: filters?.getBoundingClientRect().width,
      cardCount: cards.length,
      firstCardBorder: cards[0] ? getComputedStyle(cards[0]).borderTopWidth : null,
      headFontSize: head ? getComputedStyle(head.querySelector('.wp-catalog-count') || head).fontSize : null,
      docHeight: document.body.scrollHeight,
      chatBottom: chat?.getBoundingClientRect().bottom,
      chatRight: chat?.getBoundingClientRect().right,
      viewportInnerWidth: window.innerWidth,
      viewportInnerHeight: window.innerHeight,
    };
  });

  const file = path.join(OUTPUT_DIR, `${target.name}${suffix || ''}.png`);
  await page.screenshot({ path: file, fullPage: true, type: 'png', animations: 'disabled' });
  return { file, layoutInfo };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();

  const report = [];
  try {
    for (const target of TARGETS) {
      console.log(`Capturing ${target.name}...`);
      const result = await captureCase(page, target);
      report.push({ name: target.name, viewport: target.viewport, ...result });
      console.log(JSON.stringify(result.layoutInfo, null, 2));
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, 'metrics.json'), JSON.stringify(report, null, 2));
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
