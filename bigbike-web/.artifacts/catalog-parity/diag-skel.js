const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const reqs = [];
  page.on("request", (r) => { const u = r.url(); if (u.includes("danh-muc-san-pham") || (u.includes("san-pham") && u.includes("_rsc"))) reqs.push(u.slice(0, 100)); });
  await page.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
  const TARGET = "/danh-muc-san-pham/non-bao-hiem-moto/";
  await page.waitForSelector(`a[href="${TARGET}"]`, { state: "attached" });
  await page.waitForTimeout(4000); // let the loading-boundary prefetch fully settle
  await page.route((url) => url.toString().includes("san-pham"), async (route) => {
    await new Promise((r) => setTimeout(r, 5000));
    return route.continue();
  });
  console.log("clicking:", TARGET);
  await page.locator(`a[href="${TARGET}"]:visible`).first().click();
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(500);
    const s = await page.evaluate(() => {
      const st = document.querySelector("[role=status][aria-busy]");
      return {
        url: location.pathname,
        status: !!st,
        statusLabel: st ? (st.querySelector("span") || {}).textContent : null,
        asides: document.querySelectorAll("[role=status][aria-busy] [aria-hidden] aside").length,
        anyAside: document.querySelectorAll("aside").length,
      };
    });
    console.log(`t=${(i + 1) * 500}ms`, JSON.stringify(s));
    if (s.status) break;
  }
  console.log("nav requests seen:", reqs.length, reqs);
  await browser.close();
})();
