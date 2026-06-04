import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3019";
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto(BASE, { waitUntil: "networkidle" });
const links = await p.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet]')].map(l=>l.href));
const txt = await (await p.request.get(links[0])).text();
console.log("pointer-events occurrences:", (txt.match(/pointer-events\s*:\s*auto/g)||[]).length, "auto /", (txt.match(/pointer-events\s*:\s*none/g)||[]).length, "none");
// find the base drawer rule: ".bb-mobile-header-drawer {" with possible whitespace, capture body
const re = /\.bb-mobile-header-drawer\s*\{([\s\S]*?)\}/g;
let m, i=0;
while ((m = re.exec(txt))) {
  const body = m[1].replace(/\s+/g,' ').trim();
  console.log(`[drawer ${i++}] ${body.slice(0,300)}`);
}
await b.close();
