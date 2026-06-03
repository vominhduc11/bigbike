const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("http://localhost:3001/san-pham", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector('a[href*="/product/"]', { timeout: 20000 });
  await page.waitForTimeout(2500); // let prefetches finish BEFORE arming the delay
  await page.route("**/*", async (route) => {
    const req = route.request();
    const u = req.url();
    const isRsc = u.includes("_rsc") || req.headers()["rsc"] === "1";
    if (isRsc && /\/product\//.test(u)) { await new Promise(r=>setTimeout(r,5000)); }
    return route.continue();
  });
  await page.$('a[href*="/product/"]').then(l=>l.click());
  for (let t=0; t<=12000; t+=500) {
    const s = await page.evaluate(() => !!document.querySelector('[role="status"][aria-busy="true"]'));
    if (s) { console.log("SKELETON at t=", t, "url=", page.url()); break; }
    await page.waitForTimeout(500);
  }
  const fin = await page.evaluate(() => !!document.querySelector('[role="status"][aria-busy="true"]'));
  console.log("final hasSkel=", fin, "url=", page.url());
  await browser.close();
})();
