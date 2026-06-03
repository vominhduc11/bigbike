const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  for (const [label, url] of [["old", "http://localhost:3000/"], ["new", "http://localhost:3001/"]]) {
    const p = await b.newPage({ viewport: { width: 390, height: 2200 } });
    await p.goto(url, { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".bb-home-news-parity").catch(()=>{});
    await p.evaluate(async () => { try{await document.fonts.ready;}catch{} }); await p.waitForTimeout(700);
    const card = await p.$(".bb-home-news-parity");
    await card.scrollIntoViewIfNeeded();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `.artifacts/home-news-parity/card-${label}.png`, clip: await (async()=>{const r=await card.boundingBox(); return {x:0,y:r.y,width:390,height:Math.min(560,r.height)};})() });
    console.log(label, "shot done");
    await p.close();
  }
  await b.close();
})();
