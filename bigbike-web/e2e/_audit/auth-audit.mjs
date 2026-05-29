import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "out");
const SHOTS = join(OUT, "shots");
mkdirSync(SHOTS, { recursive: true });
const BASE = "http://localhost:3001";
const USER = process.env.BB_USER, PASS = process.env.BB_PASS;
if (!USER || !PASS) { console.error("set BB_USER / BB_PASS"); process.exit(1); }

const VPS = [[360, 800], [390, 844], [768, 1024], [1024, 900], [1280, 900], [1536, 960], [1920, 1080], [2560, 1440]];

function measure() {
  const TOL = 1.5, innerW = window.innerWidth, docEl = document.documentElement;
  const clipsX = (cs) => ["hidden", "clip", "auto", "scroll"].includes(cs.overflowX);
  function nearestClipper(el) { let p = el.parentElement; while (p && p !== docEl) { const t = p.tagName.toLowerCase(); if (t === "body") return "html-body"; if (clipsX(getComputedStyle(p))) return ((p.getAttribute("class") || t)).slice(0, 40); p = p.parentElement; } return "html-body"; }
  const all = Array.from(document.querySelectorAll("body *"));
  const raw = [];
  for (const el of all) { const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0" || cs.position === "fixed") continue; const r = el.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0 || r.right <= 0 || r.left >= innerW) continue; const over = Math.max(r.right - innerW, -r.left); if (over <= TOL) continue; raw.push({ el, over: Math.round(over), cls: (el.getAttribute("class") || el.tagName).slice(0, 70) }); }
  const set = new Set(raw.map((o) => o.el));
  const realBleed = raw.filter((o) => { let p = o.el.parentElement; while (p) { if (set.has(p)) { const po = raw.find((x) => x.el === p); if (po && po.over >= o.over - 1) return false; } p = p.parentElement; } return true; }).filter((o) => nearestClipper(o.el) === "html-body").map((o) => ({ over: o.over, cls: o.cls })).sort((a, b) => b.over - a.over).slice(0, 8);
  // rails inside main
  const railRoot = document.querySelector("main.bb-main") || document.querySelector("main") || document.body;
  const rails = [];
  for (const el of railRoot.querySelectorAll(".bb-container, .container, .bb-account-layout, .bb-page, [class*='container']")) { if (el.closest("header, footer")) continue; const cs = getComputedStyle(el); if (cs.display === "none") continue; const r = el.getBoundingClientRect(); if (r.height <= 0 || r.width <= 0) continue; const inset = Math.round(r.left), rightInset = Math.round(innerW - r.right); if (r.width >= innerW - 4 || inset < 4 || inset > innerW / 2 || Math.abs(inset - rightInset) > 24) continue; rails.push(inset); }
  const distinctLefts = [...new Set(rails)].sort((a, b) => a - b);
  return { hasHScroll: docEl.scrollWidth > docEl.clientWidth + 1, scrollW: docEl.scrollWidth, clientW: docEl.clientWidth, realBleed, distinctLefts, railMisalign: distinctLefts.length > 1 && distinctLefts[distinctLefts.length - 1] - distinctLefts[0] > 8 };
}

const b = await chromium.launch();
const ctx = await b.newContext({ deviceScaleFactor: 1, reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();

// login
await p.goto(BASE + "/dang-nhap?tiep=%2Ftai-khoan%2F", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(700);
await p.fill('input[name="login"]', USER);
await p.fill('input[name="password"]', PASS);
await p.click('button[type="submit"]');
await p.waitForTimeout(3500);
const url = new URL(p.url()).pathname;
console.log("after-login url:", url);
if (url.includes("/dang-nhap")) {
  const err = await p.$$eval("[role='alert'], .text-destructive, .bb-auth-error, .woocommerce-error", (es) => es.map((e) => e.textContent.trim()).filter(Boolean));
  console.log("LOGIN FAILED. messages:", JSON.stringify(err));
  await b.close(); process.exit(0);
}
console.log("LOGIN OK");

// discover account sub-routes
await p.goto(BASE + "/tai-khoan", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1000);
const links = await p.$$eval("a[href]", (as) => [...new Set(as.map((a) => a.getAttribute("href")).filter((h) => h && (h.includes("/tai-khoan") || h.includes("/order-received"))))]);
const editAddr = links.find((h) => h.includes("/edit-address/")) || null;
const orderDetail = links.find((h) => /\/tai-khoan\/don-hang\/[^/]+\/?$/.test(h) && !h.endsWith("/don-hang/") && !h.endsWith("/don-hang")) || null;
console.log("discovered account links:", JSON.stringify(links));

let routes = ["/tai-khoan", "/tai-khoan/don-hang", "/tai-khoan/yeu-thich", "/tai-khoan/doi-tra", "/tai-khoan/edit-account"];
if (editAddr) routes.push(editAddr);
if (orderDetail) routes.push(orderDetail);

const report = {};
for (const route of routes) {
  report[route] = {};
  for (const [w, h] of VPS) {
    await p.setViewportSize({ width: w, height: h });
    try {
      const res = await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
      await p.waitForTimeout(800);
      await p.evaluate(async () => { await new Promise((r) => { let y = 0; const s = () => { window.scrollTo(0, y); y += window.innerHeight; if (y < document.body.scrollHeight) requestAnimationFrame(s); else r(); }; s(); }); });
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200);
      const finalP = new URL(p.url()).pathname;
      const m = await p.evaluate(measure);
      report[route][`${w}x${h}`] = { status: res.status(), finalP, ...m };
      if (w === 390 || w === 1280) await p.screenshot({ path: join(SHOTS, `auth__${route.replace(/[^a-z0-9]/gi, "_")}__${w}x${h}.png`), fullPage: true });
    } catch (e) { report[route][`${w}x${h}`] = { error: String(e).slice(0, 80) }; }
  }
  const final0 = Object.values(report[route])[0]?.finalP;
  console.log(`audited ${route} (final=${final0})`);
}
writeFileSync(join(OUT, "report-auth.json"), JSON.stringify(report, null, 2));

console.log("\n==== AUTH SUMMARY (issues only) ====");
let n = 0;
for (const [route, vps] of Object.entries(report)) for (const [vp, m] of Object.entries(vps)) {
  if (m.error) { console.log(`! ${route} @ ${vp} ERR ${m.error}`); n++; continue; }
  const bits = [];
  if (m.hasHScroll) bits.push(`HSCROLL(${m.scrollW}>${m.clientW})`);
  if (m.realBleed && m.realBleed.length) bits.push(`BLEED×${m.realBleed.length}[${m.realBleed.slice(0, 2).map((o) => o.cls.slice(0, 24) + ":" + o.over).join(", ")}]`);
  if (m.railMisalign) bits.push(`railMisalign=${JSON.stringify(m.distinctLefts)}`);
  if (bits.length) { console.log(`- ${route} @ ${vp}: ${bits.join(" | ")}`); n++; }
}
console.log(`==== END (${n} issue cells) — final redirect check: if any final shows /dang-nhap, login expired ====`);
await b.close();
