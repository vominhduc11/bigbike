import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 375, height: 812 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

const info = await page.evaluate(() => {
  const excerptEl = document.querySelector('.bb-home-news-parity .news--item-inside p:not(.title-post)');
  const cardEl = document.querySelector('.bb-home-news-parity .news--item');
  const cs1 = excerptEl ? getComputedStyle(excerptEl) : null;
  const cs2 = cardEl ? getComputedStyle(cardEl) : null;
  return {
    excerptColor: cs1?.color,
    excerptBg: cs1?.backgroundColor,
    excerptOpacity: cs1?.opacity,
    excerptFontSize: cs1?.fontSize,
    excerptFontWeight: cs1?.fontWeight,
    cardBg: cs2?.backgroundColor,
    cardColor: cs2?.color,
    bbBgSurface: getComputedStyle(document.documentElement).getPropertyValue('--bb-bg-surface').trim(),
    bbTextPrimary: getComputedStyle(document.documentElement).getPropertyValue('--bb-text-primary').trim(),
    bbColorBlack: getComputedStyle(document.documentElement).getPropertyValue('--bb-color-black').trim(),
  };
});
console.log(JSON.stringify(info, null, 2));

await browser.close();
