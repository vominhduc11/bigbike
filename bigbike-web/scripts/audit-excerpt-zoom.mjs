import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('screenshots', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 375, height: 812 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

const results = await page.evaluate(() => {
  const els = document.querySelectorAll('.bb-home-news-parity .news--item-inside p:not(.title-post)');
  return Array.from(els).map((el, i) => {
    const cs = getComputedStyle(el);
    return {
      index: i,
      text: el.textContent.substring(0, 40),
      color: cs.color,
      fontSize: cs.fontSize,
    };
  });
});
console.log('Excerpt paragraphs:', JSON.stringify(results, null, 2));

const parentColors = await page.evaluate(() => {
  const el = document.querySelector('.bb-home-news-parity .news--item-inside p:not(.title-post)');
  if (!el) return [];
  const chain = [];
  let cur = el.parentElement;
  while (cur && cur.tagName !== 'BODY') {
    const cs = getComputedStyle(cur);
    chain.push({ tag: cur.tagName, cls: cur.className.substring(0, 50), color: cs.color });
    cur = cur.parentElement;
  }
  return chain;
});
console.log('Parent color chain:', JSON.stringify(parentColors, null, 2));

const cardInside = await page.$('.bb-home-news-parity .news--item:first-child .news--item-inside');
if (cardInside) {
  await cardInside.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await cardInside.screenshot({ path: 'screenshots/audit-excerpt-zoom-mobile.png' });
  console.log('Zoomed screenshot saved');
}

await browser.close();
