import { chromium } from 'playwright';
const url = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 2560, height: 1300 }, deviceScaleFactor: 1 });
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1000);
const thumbs = await p.$$('.bb-wp-pdp-gallery-col button[aria-label^="Xem ảnh"]');
console.log('thumb count', thumbs.length);
if (thumbs.length >= 3) { await thumbs[2].click(); await p.waitForTimeout(900); }
const m = await p.evaluate(()=>{const g=document.querySelector('.bb-wp-pdp-gallery-col');const box=document.querySelector('.bb-wp-pdp-gallery-col .aspect-square');const layers=document.querySelectorAll('.bb-wp-pdp-gallery-col .aspect-square > div');return {galleryH:Math.round(g.getBoundingClientRect().height), boxH:box?Math.round(box.getBoundingClientRect().height):null, layerCount:layers.length};});
console.log(JSON.stringify(m));
await p.screenshot({ path: '.artifacts/pdp-wide/final-click3.png' });
await b.close();
