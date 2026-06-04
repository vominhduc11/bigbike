import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3018";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => { const t = document.querySelector(".bb-menu-toggle"); if (t) t.click(); });
await page.waitForTimeout(800);
const info = await page.evaluate(() => {
  const navs = [...document.querySelectorAll("nav")];
  const drawer = document.querySelector(".bb-mobile-header-drawer");
  const navInDrawer = drawer ? drawer.querySelector("nav") : null;
  return {
    navCount: navs.length,
    drawerExists: !!drawer,
    navInDrawerText: navInDrawer ? navInDrawer.innerText.slice(0, 400) : null,
    toggleButtons: navInDrawer ? navInDrawer.querySelectorAll("button[aria-expanded]").length : 0,
    allButtons: navInDrawer ? navInDrawer.querySelectorAll("button").length : 0,
    links: navInDrawer ? [...navInDrawer.querySelectorAll("a")].map(a=>a.textContent.trim()).slice(0,15) : [],
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
