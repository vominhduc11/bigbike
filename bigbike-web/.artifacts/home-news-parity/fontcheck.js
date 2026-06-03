const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 2000 } });
  await p.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".bb-home-news-parity");
  await p.evaluate(async () => { try{await document.fonts.ready;}catch{} });
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const text = "Tai nghe Bluetooth 5.3 là gì? Top 5 ưu điểm nổi bật";
    const fonts = Array.from(document.fonts).map(f => `${f.family}|${f.weight}|${f.status}`);
    const measure = (fam) => { const c=document.createElement("canvas").getContext("2d"); c.font=`600 20px ${fam}`; return Math.round(c.measureText(text).width); };
    // measure with the title-post's actual computed font vs explicit families
    const sec = document.querySelector(".bb-home-news-parity");
    const row = sec.children[0].children[1].children[0];
    const inside = row.children[0].children[0].children[1].children[1];
    const tp = inside.children[0];
    const tpFont = getComputedStyle(tp).font;
    return {
      fontsLoaded: fonts,
      width_computedFont: (()=>{const c=document.createElement("canvas").getContext("2d");c.font=tpFont;return Math.round(c.measureText(text).width);})(),
      width_BarlowCondensed: measure('"Barlow Condensed"'),
      width_ArialNarrow: measure('"Arial Narrow"'),
      width_sansserif: measure('sans-serif'),
      width_BarlowCondensedFallback: measure('"Barlow Condensed Fallback"'),
      tpFont,
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await p.close(); await b.close();
})();
