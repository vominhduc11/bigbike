import { chromium } from "playwright";
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.setViewportSize({ width: 1280, height: 1000 });
await p.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
const out = await p.evaluate(() => {
  const section = document.querySelector(".bb-home-products-parity");
  let grid = null;
  for (const el of section.querySelectorAll("div")) {
    const cs = getComputedStyle(el);
    if (cs.display === "grid" && el.children.length && [...el.children].every((c) => c.tagName === "A" && c.querySelector("img"))) { grid = el; break; }
  }
  const item = grid.children[0];
  const kids = [...item.children].map(c => c.tagName + "." + (c.className||"").toString().slice(0,40));
  const img = item.querySelector("img");
  return { itemTag: item.tagName, kids, imgParentTag: img.parentElement.tagName, imgParentClass: (img.parentElement.className||"").toString().slice(0,40), itemHTML: item.outerHTML.slice(0, 500) };
});
console.log(JSON.stringify(out, null, 2));
await b.close();
