import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1300);
const state = () => p.evaluate(()=>{
  const main = document.querySelector('.bb-wp-pdp-gallery-col .swiper-slide-active img');
  const thumbActive = document.querySelector('.bb-wp-pdp-gallery-col .swiper-thumbs .swiper-slide-thumb-active');
  const thumbs=[...document.querySelectorAll('.bb-wp-pdp-gallery-col .swiper-thumbs .swiper-slide')];
  const thumbActiveIdx = thumbs.indexOf(thumbActive);
  const borderIdx = thumbs.findIndex(s=>{const i=s.querySelector('img');return i && getComputedStyle(i).borderTopColor!=='rgba(0, 0, 0, 0)' && getComputedStyle(i).borderTopColor!=='rgb(0, 0, 0)' && getComputedStyle(i).borderTopWidth!=='0px' && getComputedStyle(i).borderTopColor!=='transparent';});
  return { mainSrc: main?.getAttribute('src')?.slice(45,72), thumbActiveIdx, borderIdx };
});
console.log('initial', JSON.stringify(await state()));
// click thumb index 2
const thumbs = await p.$$('.bb-wp-pdp-gallery-col .swiper-thumbs .swiper-slide');
await thumbs[2].click(); await p.waitForTimeout(700);
console.log('clickThumb2', JSON.stringify(await state()));
// main next arrow (last matching arrow in main col)
await p.evaluate(()=>{const a=[...document.querySelectorAll('.bb-wp-pdp-gallery-col button[aria-label="Ảnh tiếp"]')];a[a.length-1].click();});
await p.waitForTimeout(700);
console.log('mainNext', JSON.stringify(await state()));
await b.close();
