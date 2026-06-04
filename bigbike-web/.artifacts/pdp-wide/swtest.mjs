import { chromium } from 'playwright';
const url = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1200);
const info = async (label) => {
  const m = await p.evaluate(() => {
    const sw = document.querySelector('.bb-wp-pdp-gallery-col .swiper');
    const slides = sw ? sw.querySelectorAll('.swiper-slide') : [];
    const active = sw ? sw.querySelector('.swiper-slide-active img') : null;
    const box = document.querySelector('.bb-wp-pdp-gallery-col .aspect-square');
    const pressed = [...document.querySelectorAll('.bb-wp-pdp-gallery-col button[aria-label^="Xem ảnh"]')].findIndex(b=>b.getAttribute('aria-pressed')==='true');
    return { slideCount: slides.length, boxH: box?Math.round(box.getBoundingClientRect().height):null, activeSrc: active? active.getAttribute('src')?.slice(0,60):null, pressedThumb: pressed };
  });
  console.log(label, JSON.stringify(m));
};
await info('initial');
// click 3rd thumbnail
const thumbs = await p.$$('.bb-wp-pdp-gallery-col button[aria-label^="Xem ảnh"]');
await thumbs[2].click(); await p.waitForTimeout(700);
await info('after-thumb3');
await p.screenshot({ path: '.artifacts/pdp-wide/swiper-thumb3.png' });
// click next arrow
await p.$eval('.bb-wp-pdp-gallery-col button[aria-label="Ảnh tiếp"]', el=>el.click()); await p.waitForTimeout(700);
await info('after-next');
await b.close();
