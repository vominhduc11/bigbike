import { chromium } from 'playwright';
const url = process.argv[2];
const tag = process.argv[3];
const widths = [1920, 2560];
const b = await chromium.launch();
for (const w of widths) {
  const p = await b.newPage({ viewport: { width: w, height: 1300 }, deviceScaleFactor: 1 });
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(1200);
  // measure gallery vs thumbs
  const m = await p.evaluate(() => {
    const ov = document.querySelector('#pdp-overview');
    const img = document.querySelector('.bb-wp-pdp-gallery-col .aspect-square') || document.querySelector('.bb-wp-pdp-gallery-col [class*=aspect-square]');
    const thumbsCol = document.querySelector('.bb-wp-pdp-gallery-col')?.querySelector('div');
    const galCol = document.querySelector('.bb-wp-pdp-gallery-col');
    const infoCol = document.querySelector('.bb-wp-pdp-info-col');
    const r = (el)=> el? {w:Math.round(el.getBoundingClientRect().width),h:Math.round(el.getBoundingClientRect().height)}:null;
    return { overview:r(ov), gallery:r(galCol), info:r(infoCol), imageBox:r(img) };
  });
  console.log(tag, w, JSON.stringify(m));
  await p.screenshot({ path: `.artifacts/pdp-wide/${tag}-${w}.png` });
  await p.close();
}
await b.close();
