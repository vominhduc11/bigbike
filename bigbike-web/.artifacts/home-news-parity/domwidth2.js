const { chromium } = require("playwright");
function tpInfo() {
  const sec = document.querySelector(".bb-home-news-parity");
  const container = sec.children[0];
  const newsList = container.children[1];
  const row = newsList.children[0];
  const col = row.children[0];
  const item = col.children[0];
  const desc = item.children[1];
  const inside = desc.children[desc.children.length - 1];
  const tp = inside.children[0];
  const cs = getComputedStyle(tp);
  const text = tp.textContent.trim();
  const span = document.createElement("span");
  span.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};letter-spacing:${cs.letterSpacing};`;
  span.textContent = text; document.body.appendChild(span);
  const nowrapW = span.offsetWidth; span.remove();
  return {
    text: text.slice(0, 55),
    boxClientW: tp.clientWidth, boxScrollW: tp.scrollWidth,
    boxH: Math.round(tp.getBoundingClientRect().height),
    whiteSpace: cs.whiteSpace, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
    nowrapTextW: nowrapW,
  };
}
(async () => {
  const b = await chromium.launch();
  for (const [label, url] of [["OLD :3000", "http://localhost:3000/"], ["NEW :3001", "http://localhost:3001/"]]) {
    const p = await b.newPage({ viewport: { width: 390, height: 2000 } });
    await p.goto(url, { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".bb-home-news-parity").catch(()=>{});
    await p.evaluate(async () => { try{await document.fonts.ready;}catch{} });
    await p.waitForTimeout(600);
    const r = await p.evaluate(tpInfo);
    console.log(label, JSON.stringify(r));
    await p.close();
  }
  await b.close();
})();
