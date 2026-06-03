const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("http://localhost:3001/san-pham", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector('a[href*="/product/"]', { timeout: 20000 });
  let delayed = 0;
  await page.route("**/*", async (route) => {
    const req = route.request();
    const u = req.url();
    const isRsc = u.includes("_rsc") || req.headers()["rsc"] === "1";
    if (isRsc && /\/product\//.test(u)) { delayed++; console.log("DELAY", u.slice(0,90)); await new Promise(r=>setTimeout(r,4000)); }
    return route.continue();
  });
  const href = await page.$eval('a[href*="/product/"]', a => a.getAttribute("href"));
  console.log("clicking href=", href);
  await page.$('a[href*="/product/"]').then(l=>l.click());
  await page.waitForTimeout(1500);
  const hasSkel = await page.evaluate(() => !!document.querySelector('[role="status"][aria-busy="true"]'));
  const url = page.url();
  console.log("after click url=", url, "hasSkel=", hasSkel, "delayedReqs=", delayed);
  await browser.close();
})();
