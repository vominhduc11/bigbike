const { chromium } = require("playwright");
function test() {
  const text = "Tai nghe Bluetooth 5.3 là gì? Top 5 ưu điểm nổi bật";
  const d = document.createElement("div");
  d.style.cssText = "position:absolute;left:0;top:0;width:298px;font-family:var(--bb-font-heading);font-size:20.0228px;font-weight:600;line-height:24.0274px;letter-spacing:normal;white-space:normal;";
  d.textContent = text;
  document.body.appendChild(d);
  const h1 = d.getBoundingClientRect().height;
  // also force the EXACT same font string the title uses
  d.style.fontFamily = '"Barlow Condensed", "Barlow Condensed Fallback", "Barlow Condensed", "Arial Narrow", sans-serif';
  const h2 = d.getBoundingClientRect().height;
  d.remove();
  return { isoHeight_var: Math.round(h1), isoHeight_explicit: Math.round(h2) };
}
(async () => {
  const b = await chromium.launch();
  for (const [label, url] of [["OLD :3000", "http://localhost:3000/"], ["NEW :3001", "http://localhost:3001/"]]) {
    const p = await b.newPage({ viewport: { width: 390, height: 2000 } });
    await p.goto(url, { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".bb-home-news-parity").catch(()=>{});
    await p.evaluate(async () => { try{await document.fonts.ready;}catch{} }); await p.waitForTimeout(600);
    console.log(label, JSON.stringify(await p.evaluate(test)));
    await p.close();
  }
  await b.close();
})();
