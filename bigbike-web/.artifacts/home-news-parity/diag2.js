const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 2200 } });
  await p.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".bb-home-news-parity"); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const sec = document.querySelector(".bb-home-news-parity");
    const row = sec.children[0].children[1].children[0];
    const col = row.children[0];
    const inside = col.children[0].children[1].children[col.children[0].children[1].children.length-1];
    const tp = inside.children[0]; // title-post
    const ta = tp.querySelector("a");
    const cs = getComputedStyle(tp);
    return {
      titleText: ta.textContent,
      tpWidth: Math.round(tp.getBoundingClientRect().width),
      tpScrollW: tp.scrollWidth, tpClientW: tp.clientWidth,
      tpHeight: Math.round(tp.getBoundingClientRect().height),
      whiteSpace: cs.whiteSpace, overflow: cs.overflow, textOverflow: cs.textOverflow,
      webkitLineClamp: cs.webkitLineClamp, display: cs.display,
      fontSize: cs.fontSize, fontFamily: cs.fontFamily, fontWeight: cs.fontWeight,
      letterSpacing: cs.letterSpacing, wordSpacing: cs.wordSpacing,
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await p.close(); await b.close();
})();
