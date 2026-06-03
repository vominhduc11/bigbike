const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  for (const [label, url] of [["OLD :3000", "http://localhost:3000/"], ["NEW :3001", "http://localhost:3001/"]]) {
    const p = await b.newPage({ viewport: { width: 390, height: 2000 } });
    await p.goto(url, { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".bb-home-news-parity").catch(()=>{});
    await p.evaluate(async () => { try{await document.fonts.ready;}catch{} });
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      const sec = document.querySelector(".bb-home-news-parity");
      const tp = sec.querySelector(".title-post") || sec.querySelector("p");
      const cs = getComputedStyle(tp);
      const text = tp.textContent.trim();
      const span = document.createElement("span");
      span.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};letter-spacing:${cs.letterSpacing};`;
      span.textContent = text;
      document.body.appendChild(span);
      const w = span.offsetWidth;
      span.remove();
      // also probe each explicit family
      const mk = (fam) => { const s=document.createElement("span"); s.style.cssText=`position:absolute;visibility:hidden;white-space:nowrap;font-family:${fam};font-size:20.0228px;font-weight:600;`; s.textContent=text; document.body.appendChild(s); const x=s.offsetWidth; s.remove(); return x; };
      return {
        domSpanWidth: w,
        domTitleHeight: Math.round(tp.getBoundingClientRect().height),
        w_BarlowCondensed: mk('"Barlow Condensed"'),
        w_BarlowCondensedFallback: mk('"Barlow Condensed Fallback"'),
        w_ArialNarrow: mk('"Arial Narrow"'),
      };
    });
    console.log(label, JSON.stringify(r));
    await p.close();
  }
  await b.close();
})();
