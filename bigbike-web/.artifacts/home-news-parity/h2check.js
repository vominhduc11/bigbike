const { chromium } = require("playwright");
function ck() {
  const sec = document.querySelector(".bb-home-news-parity");
  const bt = sec.children[0].children[0];
  const h2 = bt.querySelector("h2");
  const cs = getComputedStyle(h2);
  const text = h2.textContent.trim();
  const span = document.createElement("span");
  span.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};letter-spacing:${cs.letterSpacing};text-transform:${cs.textTransform};`;
  span.textContent = text; document.body.appendChild(span);
  const w = span.offsetWidth; span.remove();
  return { text, h2Height: Math.round(h2.getBoundingClientRect().height), h2Width: Math.round(h2.getBoundingClientRect().width), fontSize: cs.fontSize, nowrapW: w };
}
(async () => {
  const b = await chromium.launch();
  for (const [label, url] of [["OLD :3000","http://localhost:3000/"],["NEW :3001","http://localhost:3001/"]]) {
    const p = await b.newPage({ viewport:{width:390,height:2000} });
    await p.goto(url,{waitUntil:"domcontentloaded"});
    await p.waitForSelector(".bb-home-news-parity").catch(()=>{});
    await p.evaluate(async()=>{try{await document.fonts.ready;}catch{}}); await p.waitForTimeout(700);
    console.log(label, JSON.stringify(await p.evaluate(ck)));
    await p.close();
  }
  await b.close();
})();
