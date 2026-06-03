const { chromium } = require("playwright");
function chain() {
  const sec = document.querySelector(".bb-home-news-parity");
  const c = sec.children[0]; const nl = c.children[1]; const row = nl.children[0];
  const col = row.children[0]; const item = col.children[0]; const desc = item.children[1];
  const inside = desc.children[desc.children.length-1]; const tp = inside.children[0];
  const a = tp.querySelector("a") || tp;
  const props = ["fontStretch","fontVariationSettings","fontFeatureSettings","fontKerning","fontOpticalSizing","fontSizeAdjust","letterSpacing","wordSpacing","transform","zoom","textSizeAdjust","webkitTextSizeAdjust","textRendering","fontSynthesis","fontVariant"];
  const out = [];
  let el = a, names = ["a","title-post","inside","desc","item","col","row","newsList","container","section"];
  const els = [a, tp, inside, desc, item, col, row, nl, c, sec, document.body, document.documentElement];
  const enames = ["a","title-post","inside","desc","item","col","row","newsList","container","section","body","html"];
  for (let i=0;i<els.length;i++){ const cs=getComputedStyle(els[i]); const o={el:enames[i]}; for(const p of props){ const v=cs[p]; if(v && v!=="normal" && v!=="none" && v!=="auto" && v!=="0px" && v!=="1" && v!=="0em") o[p]=v; } out.push(o); }
  return out;
}
(async () => {
  const b = await chromium.launch();
  for (const [label, url] of [["OLD :3000","http://localhost:3000/"],["NEW :3001","http://localhost:3001/"]]) {
    const p = await b.newPage({ viewport:{width:390,height:2000} });
    await p.goto(url,{waitUntil:"domcontentloaded"});
    await p.waitForSelector(".bb-home-news-parity").catch(()=>{});
    await p.evaluate(async()=>{try{await document.fonts.ready;}catch{}}); await p.waitForTimeout(600);
    console.log("===",label,"==="); console.log(JSON.stringify(await p.evaluate(chain),null,1));
    await p.close();
  }
  await b.close();
})();
