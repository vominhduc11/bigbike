import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3018";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await page.evaluate(() => { const t = document.querySelector(".bb-menu-toggle"); if (t) t.click(); });
await page.waitForSelector(".bb-mobile-header-panel.is-open");
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const cls = (el) => el===document.documentElement?'html':el===document.body?'body':(el.tagName.toLowerCase()+ (el.className?.baseVal!==undefined?('.'+el.className.baseVal):(typeof el.className==='string'?('.'+el.className.split(' ').slice(0,2).join('.')):'')));
  function chain(sel) {
    const el = document.querySelector(sel);
    if (!el) return [sel, "NOT FOUND"];
    const out = [];
    let cur = el.parentElement;
    while (cur) {
      const cs = getComputedStyle(cur);
      const flags = [];
      if (cs.transform !== "none") flags.push("transform");
      if (cs.filter !== "none") flags.push("filter");
      if (cs.perspective !== "none") flags.push("perspective");
      if (cs.willChange !== "auto") flags.push("will-change:"+cs.willChange);
      if (cs.contain !== "none") flags.push("contain:"+cs.contain);
      if (cs.position !== "static") flags.push("pos:"+cs.position);
      if (cs.overflow !== "visible") flags.push("ovf:"+cs.overflow);
      out.push(cls(cur) + (flags.length?("  <<< "+flags.join(",")):""));
      cur = cur.parentElement;
    }
    return out;
  }
  return { overlayChain: chain(".bb-mobile-header-overlay"), panelChain: chain(".bb-mobile-header-panel") };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
