import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('screenshots', { recursive: true });

const browser = await chromium.launch();

// Desktop 1440px
const page1 = await browser.newPage();
await page1.setViewportSize({ width: 1440, height: 900 });
await page1.goto('http://localhost:3000', { waitUntil: 'networkidle' });
const newsSection1 = await page1.$('.bb-home-news-parity');
if (newsSection1) {
  await newsSection1.scrollIntoViewIfNeeded();
  await page1.waitForTimeout(500);
  await newsSection1.screenshot({ path: 'screenshots/audit-news-section-desktop-1440.png' });
  const excerptEl1 = await page1.$('.bb-home-news-parity .news--item-inside p:not(.title-post)');
  if (excerptEl1) {
    const color1 = await excerptEl1.evaluate(el => getComputedStyle(el).color);
    console.log('Desktop excerpt color:', color1);
  }
  const row1 = await page1.$('.bb-home-news-parity .row');
  if (row1) {
    const display1 = await row1.evaluate(el => getComputedStyle(el).display);
    console.log('Desktop row display:', display1);
  }
  console.log('Desktop 1440: OK');
} else {
  console.log('Desktop 1440: news section NOT FOUND');
}
await page1.close();

// Tablet 768px
const page2 = await browser.newPage();
await page2.setViewportSize({ width: 768, height: 1024 });
await page2.goto('http://localhost:3000', { waitUntil: 'networkidle' });
const newsSection2 = await page2.$('.bb-home-news-parity');
if (newsSection2) {
  await newsSection2.scrollIntoViewIfNeeded();
  await page2.waitForTimeout(500);
  await newsSection2.screenshot({ path: 'screenshots/audit-news-section-tablet-768.png' });
  const col2 = await page2.$('.bb-home-news-parity .col-md-4');
  if (col2) {
    const width2 = await col2.evaluate(el => getComputedStyle(el).width);
    const flex2 = await col2.evaluate(el => getComputedStyle(el).flex);
    console.log('Tablet col-md-4 width:', width2, 'flex:', flex2);
  }
  console.log('Tablet 768: OK');
} else {
  console.log('Tablet 768: news section NOT FOUND');
}
await page2.close();

// Mobile 375px
const page3 = await browser.newPage();
await page3.setViewportSize({ width: 375, height: 812 });
await page3.goto('http://localhost:3000', { waitUntil: 'networkidle' });
const newsSection3 = await page3.$('.bb-home-news-parity');
if (newsSection3) {
  await newsSection3.scrollIntoViewIfNeeded();
  await page3.waitForTimeout(500);
  await newsSection3.screenshot({ path: 'screenshots/audit-news-section-mobile-375.png' });
  const excerptEl3 = await page3.$('.bb-home-news-parity .news--item-inside p:not(.title-post)');
  if (excerptEl3) {
    const color3 = await excerptEl3.evaluate(el => getComputedStyle(el).color);
    console.log('Mobile excerpt color:', color3);
  }
  console.log('Mobile 375: OK');
} else {
  console.log('Mobile 375: news section NOT FOUND');
}
await page3.close();

await browser.close();
