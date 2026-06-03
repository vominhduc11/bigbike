const { chromium } = require("playwright");
function ck() {
  const sec = document.querySelector(".bb-home-news-parity");
  const c = sec.children[0]; const nl = c.children[1]; const row = nl.children[0];
  const col = row.children[0]; const item = col.children[0]; const desc = item.children[1];
  const inside = desc.children[desc.children.length-1]; const tp = inside.children[0];
  const a = tp.querySelector("a");
  const csa = getComputedStyle(a), csp = getComputedStyle(tp);
  return {
    pFontSize: csp.fontSize, pFontFamily: csp.fontFamily.slice(0,40),
    aFontSize: csa.fontSize, aFontFamily: csa.fontFamily.slice(0,40),
    aText: a.textContent.trim(),
    aTextLen: a.textContent.trim().length,
    aRectW: a.getBoundingClientRect().width.toFixed(2),
    aRectH: a.getBoundingClientRect().height.toFixed(2),
  };
}
(async () => {
  const b = await chromium.launch();
  for (const [label, url] of [["OLD :3000","http://localhost:3000/"],["NEW :3001","http://localhost:3001/"]]) {
    const p = await b.newPage({ viewport:{width:390,height:2000} });
    await p.goto(url,{waitUntil:"domcontentloaded"});
    await p.waitForSelector(".bb-home-news-parity").catch(()=>{});
    await p.evaluate(async()=>{try{await document.fonts.ready;}catch{}}); await p.waitForTimeout(600);
    console.log(label, JSON.stringify(await p.evaluate(ck)));
    await p.close();
  }
  await b.close();
})();
