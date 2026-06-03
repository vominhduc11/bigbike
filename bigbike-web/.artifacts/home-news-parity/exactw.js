const { chromium } = require("playwright");
function widths() {
  const sec = document.querySelector(".bb-home-news-parity");
  const c = sec.children[0]; const nl = c.children[1]; const row = nl.children[0];
  const col = row.children[0]; const item = col.children[0]; const desc = item.children[1];
  const inside = desc.children[desc.children.length-1]; const tp = inside.children[0];
  const a = tp.querySelector("a");
  const w = (e) => e.getBoundingClientRect().width.toFixed(3);
  const pad = (e)=>{const s=getComputedStyle(e);return `pl${s.paddingLeft}/pr${s.paddingRight}/bl${s.borderLeftWidth}/br${s.borderRightWidth}/box${s.boxSizing}`;};
  return {
    container:w(c), row:w(row), col:w(col), item:w(item)+" ["+pad(item)+"]",
    desc:w(desc), inside:w(inside)+" ["+pad(inside)+"]",
    titlePost:w(tp)+" ["+pad(tp)+"]", a:w(a)+" disp="+getComputedStyle(a).display+" ws="+getComputedStyle(a).whiteSpace,
    aClientW: a.clientWidth, aScrollW: a.scrollWidth,
  };
}
(async () => {
  const b = await chromium.launch();
  for (const [label, url] of [["OLD :3000","http://localhost:3000/"],["NEW :3001","http://localhost:3001/"]]) {
    const p = await b.newPage({ viewport:{width:390,height:2000} });
    await p.goto(url,{waitUntil:"domcontentloaded"});
    await p.waitForSelector(".bb-home-news-parity").catch(()=>{});
    await p.evaluate(async()=>{try{await document.fonts.ready;}catch{}}); await p.waitForTimeout(600);
    console.log(label, JSON.stringify(await p.evaluate(widths),null,1));
    await p.close();
  }
  await b.close();
})();
