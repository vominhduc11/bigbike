import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 1 });
await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1200);
const m = await p.evaluate(()=>{
  const col = document.querySelector('.bb-wp-pdp-gallery-col');
  const grid = col.querySelector(':scope > div');
  const wrap = grid.children[0];
  const btns = [...col.querySelectorAll('button[aria-label^="Cuộn thumbnail"]')];
  const sw = col.querySelector('.swiper.swiper-thumbs');
  const slides = [...(sw?.querySelectorAll('.swiper-slide')||[])];
  const r = el => { const b=el.getBoundingClientRect(); return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),cx:Math.round(b.x+b.width/2),bottom:Math.round(b.bottom)};};
  return {
    wrap: r(wrap),
    swiper: sw? r(sw):null,
    upBtn: btns[0]? r(btns[0]):null,
    downBtn: btns[1]? r(btns[1]):null,
    slide0: slides[0]? r(slides[0]):null,
    slideLast: slides[slides.length-1]? r(slides[slides.length-1]):null,
  };
});
console.log(JSON.stringify(m,null,1));
await b.close();
