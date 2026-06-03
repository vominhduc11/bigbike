const { chromium } = require("playwright");
function dump() {
  const sec = document.querySelector(".bb-home-news-parity");
  const c = sec.children[0]; const nl = c.children[1]; const row = nl.children[0];
  const col = row.children[0]; const item = col.children[0]; const desc = item.children[1];
  const inside = desc.children[desc.children.length-1]; const tp = inside.children[0];
  const cs = getComputedStyle(tp);
  const o = {};
  for (let i=0;i<cs.length;i++){ const k=cs[i]; o[k]=cs.getPropertyValue(k); }
  return o;
}
(async () => {
  const b = await chromium.launch(); const res = {};
  for (const [label, url] of [["OLD","http://localhost:3000/"],["NEW","http://localhost:3001/"]]) {
    const p = await b.newPage({ viewport:{width:390,height:2000} });
    await p.goto(url,{waitUntil:"domcontentloaded"});
    await p.waitForSelector(".bb-home-news-parity").catch(()=>{});
    await p.evaluate(async()=>{try{await document.fonts.ready;}catch{}}); await p.waitForTimeout(600);
    res[label] = await p.evaluate(dump); await p.close();
  }
  await b.close();
  const keys = new Set([...Object.keys(res.OLD),...Object.keys(res.NEW)]);
  let n=0;
  for (const k of [...keys].sort()){ if(res.OLD[k]!==res.NEW[k]){ console.log(`DIFF ${k}:\n  OLD=${res.OLD[k]}\n  NEW=${res.NEW[k]}`); n++; } }
  console.log(n? `${n} property diffs` : "title-post computed styles IDENTICAL");
})();
