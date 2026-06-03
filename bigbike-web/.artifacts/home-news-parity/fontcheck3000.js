const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 2000 } });
  await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".bb-home-news-parity").catch(()=>{});
  await p.evaluate(async () => { try{await document.fonts.ready;}catch{} });
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const sec = document.querySelector(".bb-home-news-parity");
    if(!sec) return {__missing:true};
    const row = sec.querySelector(".news-list .row") || sec.querySelector(".row");
    const tp = row.querySelector(".title-post");
    const cs = getComputedStyle(tp);
    const text = tp.textContent.trim();
    const c = document.createElement("canvas").getContext("2d"); c.font = cs.font;
    return {
      titleText: text,
      tpWidth: Math.round(tp.getBoundingClientRect().width),
      tpHeight: Math.round(tp.getBoundingClientRect().height),
      fontSize: cs.fontSize, fontFamily: cs.fontFamily, font: cs.font,
      measuredWidth: Math.round(c.measureText(text).width),
    };
  });
  console.log("DOCKER :3000 (OLD)", JSON.stringify(r, null, 1));
  await p.close(); await b.close();
})();
