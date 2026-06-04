import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3019";
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
await p.goto(BASE, { waitUntil: "networkidle" });
const links = await p.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet]')].map(l=>l.href));
const txt = await (await p.request.get(links[0])).text();
// find every ".bb-mobile-header-drawer{" (simple selector, not descendant/child)
const re = /\.bb-mobile-header-drawer\{[^}]*\}/g;
let m; const hits=[];
while ((m = re.exec(txt))) hits.push(m[0]);
console.log("simple-drawer rules found:", hits.length);
hits.forEach((h,i)=>console.log(`[${i}] `+h));
console.log("=== any 'pointer-events:auto' count:", (txt.match(/pointer-events:auto/g)||[]).length);
console.log("=== drawer with pointer-events:", /\.bb-mobile-header-drawer\{[^}]*pointer-events/.test(txt));
await b.close();
