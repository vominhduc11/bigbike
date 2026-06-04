import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 1 });
await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1000);
const m = await p.evaluate(()=>{
  const col = document.querySelector('.bb-wp-pdp-gallery-col');
  const btns = [...col.querySelectorAll('button[aria-label^="Cuộn thumbnail"]')];
  const out=[];
  for (const btn of btns){
    const br=btn.getBoundingClientRect(); const svg=btn.querySelector('svg'); const sr=svg.getBoundingClientRect();
    out.push({label:btn.getAttribute('aria-label'),
      btn:{x:Math.round(br.x),y:Math.round(br.y),w:Math.round(br.width),h:Math.round(br.height)},
      svgOffsetX:Math.round(sr.x-br.x), svgOffsetY:Math.round(sr.y-br.y), svgW:Math.round(sr.width), svgH:Math.round(sr.height),
      display:getComputedStyle(btn).display});
  }
  return out;
});
console.log(JSON.stringify(m,null,1));
await b.close();
