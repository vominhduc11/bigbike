const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 2200 } });
  await p.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".bb-home-news-parity"); await p.evaluate(async()=>{try{await document.fonts.ready;}catch{}}); await p.waitForTimeout(700);
  const card = await p.$(".bb-home-news-parity"); await card.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const r = await card.boundingBox();
  await p.screenshot({ path: ".artifacts/home-news-parity/card-new-final.png", clip:{x:0,y:r.y,width:390,height:Math.min(560,r.height)} });
  console.log("shot done");
  await p.close(); await b.close();
})();
