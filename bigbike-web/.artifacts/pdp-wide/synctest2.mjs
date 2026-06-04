import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1300);
const state = () => p.evaluate(()=>{
  const mainSw = document.querySelector('.bb-wp-pdp-gallery-col .swiper:not(.swiper-thumbs)');
  const thumbSw = document.querySelector('.bb-wp-pdp-gallery-col .swiper.swiper-thumbs');
  const mainImg = mainSw?.querySelector('.swiper-slide-active img');
  const tA = thumbSw?.querySelector('.swiper-slide-thumb-active');
  const tslides=[...(thumbSw?.querySelectorAll('.swiper-slide')||[])];
  return { mainName: mainImg?.getAttribute('alt') || mainImg?.getAttribute('src')?.split('/').pop()?.slice(0,18), thumbActiveIdx: tslides.indexOf(tA) };
});
console.log('initial   ', JSON.stringify(await state()));
const thumbs = await p.$$('.bb-wp-pdp-gallery-col .swiper.swiper-thumbs .swiper-slide');
await thumbs[2].click(); await p.waitForTimeout(700);
console.log('clickThumb2', JSON.stringify(await state()));
await p.screenshot({ path: '.artifacts/pdp-wide/sync-clickthumb2.png' });
await b.close();
