import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
await p.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
await p.waitForSelector("#home-exp-heading");
const r = await p.evaluate(() => {
  const k = document.querySelector("#home-exp-heading").previousElementSibling;
  const par = k.parentElement;
  const root = getComputedStyle(document.documentElement);
  const feat = document.querySelector("#home-products-heading").previousElementSibling;
  return {
    kicker_lh: getComputedStyle(k).lineHeight,
    kicker_fs: getComputedStyle(k).fontSize,
    parent_lh: getComputedStyle(par).lineHeight,
    parent_class: par.className,
    grandparent_lh: getComputedStyle(par.parentElement).lineHeight,
    featured_lh: getComputedStyle(feat).lineHeight,
    featured_fs: getComputedStyle(feat).fontSize,
    lineSectionKicker: root.getPropertyValue("--bb-line-section-kicker"),
    textSectionKicker: root.getPropertyValue("--bb-text-section-kicker"),
    kicker_class: k.className,
  };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
