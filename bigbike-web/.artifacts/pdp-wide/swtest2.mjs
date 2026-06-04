import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1200);
const cur = async () => p.evaluate(()=>{const a=document.querySelector('.bb-wp-pdp-gallery-col .swiper-slide-active img');const pr=[...document.querySelectorAll('.bb-wp-pdp-gallery-col button[aria-label^="Xem ảnh"]')].findIndex(b=>b.getAttribute('aria-pressed')==='true');return {src:a?.getAttribute('src')?.slice(40,75),pressed:pr};});
console.log('start', JSON.stringify(await cur()));
// carousel arrows are inside the main image col, rendered AFTER thumbnail block -> last matches
await p.evaluate(()=>{const arr=[...document.querySelectorAll('.bb-wp-pdp-gallery-col button[aria-label="Ảnh tiếp"]')];arr[arr.length-1].click();});
await p.waitForTimeout(700); console.log('next1', JSON.stringify(await cur()));
await p.evaluate(()=>{const arr=[...document.querySelectorAll('.bb-wp-pdp-gallery-col button[aria-label="Ảnh tiếp"]')];arr[arr.length-1].click();});
await p.waitForTimeout(700); console.log('next2', JSON.stringify(await cur()));
await p.screenshot({path:'.artifacts/pdp-wide/swiper-arrows.png'});
await b.close();
