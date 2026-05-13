const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/product-listing/audit');

const CASES = [
  { name: 'desktop-1440-active-filter', viewport: { width: 1440, height: 900 }, path: '/san-pham/?min_price=1000000&max_price=3000000' },
  { name: 'desktop-1440-empty', viewport: { width: 1440, height: 900 }, path: '/san-pham/?q=zzzzznotfound' },
  { name: 'mobile-390-filter-open', viewport: { width: 390, height: 844 }, path: '/san-pham/', openFilter: true },
  { name: 'mobile-390-hover-addbar', viewport: { width: 390, height: 844 }, path: '/san-pham/' },
];

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let h = 0;
      const t = setInterval(() => {
        const sh = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        window.scrollBy(0, 600);
        h += 600;
        if (h >= sh - window.innerHeight) {
          clearInterval(t);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 120);
    });
  });
}

async function captureCase(page, c) {
  await page.setViewportSize(c.viewport);
  await page.goto(`${BASE_URL}${c.path}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (c.openFilter) {
    await page.click('.wp-filters-mobile-toggle').catch(() => {});
    await page.waitForTimeout(400);
  }
  await autoScroll(page);
  await page.waitForTimeout(400);

  const measurements = await page.evaluate(() => {
    const grid = document.querySelector('.wp-product-grid');
    const cards = document.querySelectorAll('.wp-product-card');
    const filters = document.querySelector('.wp-filters-v2');
    const filtersBody = document.querySelector('.wp-filters-v2-body');
    const layout = document.querySelector('.wp-cat-layout');
    const chips = document.querySelectorAll('.wp-filter-chip');
    const head = document.querySelector('.wp-catalog-head');
    const sort = document.querySelector('.wp-catalog-sort');
    const count = document.querySelector('.wp-catalog-count');
    const addbar = cards[0]?.querySelector('.wp-product-addbar');
    const addbarStyle = addbar ? getComputedStyle(addbar) : null;
    return {
      gridTemplateColumns: grid ? getComputedStyle(grid).gridTemplateColumns : null,
      gridColumnCount: grid ? getComputedStyle(grid).gridTemplateColumns.split(/\s+/).length : 0,
      gridRect: grid ? grid.getBoundingClientRect().toJSON() : null,
      cardCount: cards.length,
      cardRect: cards[0] ? cards[0].getBoundingClientRect().toJSON() : null,
      cardBorder: cards[0] ? getComputedStyle(cards[0]).border : null,
      cardBg: cards[0] ? getComputedStyle(cards[0]).backgroundColor : null,
      filtersRect: filters ? filters.getBoundingClientRect().toJSON() : null,
      filtersBodyDisplay: filtersBody ? getComputedStyle(filtersBody).display : null,
      layoutRect: layout ? layout.getBoundingClientRect().toJSON() : null,
      chipsCount: chips.length,
      headFontSize: head ? getComputedStyle(head).fontSize : null,
      countFontSize: count ? getComputedStyle(count).fontSize : null,
      sortFontSize: sort ? getComputedStyle(sort).fontSize : null,
      addbarTransform: addbarStyle?.transform,
      addbarOpacity: addbarStyle?.opacity,
      addbarBottom: addbar?.getBoundingClientRect().bottom,
      docHeight: document.body.scrollHeight,
    };
  });

  const file = path.join(OUTPUT_DIR, `${c.name}.png`);
  await page.screenshot({ path: file, fullPage: true, type: 'png', animations: 'disabled' });
  return { name: c.name, file, measurements };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const report = [];
  try {
    for (const c of CASES) {
      console.log(`Capturing ${c.name}`);
      const r = await captureCase(page, c);
      report.push(r);
      console.log(JSON.stringify(r.measurements, null, 2));
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, 'metrics-edge.json'), JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
