import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3019";
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
const hrefs = [];
await p.goto(BASE, { waitUntil: "networkidle" });
const links = await p.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet]')].map(l=>l.href));
console.log("CSS files:", links.length);
for (const h of links) {
  const txt = await (await p.request.get(h)).text();
  const idx = txt.indexOf("bb-mobile-header-drawer{position");
  const idx2 = txt.indexOf("86vw");
  console.log(h.split("/").pop(), "| has position-rule:", idx>=0, "| has 86vw:", idx2>=0, "| len:", txt.length);
  if (idx2>=0) console.log("   around 86vw:", txt.slice(idx2-120, idx2+80));
}
await b.close();
