/**
 * BigBike-web responsive audit harness (standalone, not a Playwright test).
 *
 * Drives chromium against the dev server (http://localhost:3001), discovers all
 * routes, iterates a wide viewport matrix, and measures:
 *   - element-level horizontal overflow via getBoundingClientRect (layout-based,
 *     so it bypasses the global `overflow-x:hidden` mask that hides true bleed)
 *   - documentElement scrollWidth vs clientWidth (real horizontal scrollbar)
 *   - container-edge alignment across top-level sections (left/right insets)
 *   - section vertical gaps (negative/overlap + abnormally large gaps)
 *   - screenshots for a representative subset for visual review
 *
 * Output: e2e/_audit/out/report.json (+ per-route screenshots under out/shots/)
 *
 * Run:  node e2e/_audit/audit.mjs            (full)
 *       node e2e/_audit/audit.mjs --quick    (subset routes, key viewports)
 *       node e2e/_audit/audit.mjs --tag=after (label the run / output file)
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "out");
const SHOTS = join(OUT, "shots");
mkdirSync(SHOTS, { recursive: true });

const BASE = process.env.BB_BASE || "http://localhost:3001";
const argv = process.argv.slice(2);
const QUICK = argv.includes("--quick");
const TAG = (argv.find((a) => a.startsWith("--tag=")) || "--tag=baseline").split("=")[1];

// width x height — full matrix from the audit brief (mains + intermediates)
const VIEWPORTS_FULL = [
  [360, 800], [390, 844], [430, 932], [480, 900], [576, 900], [640, 900],
  [768, 1024], [820, 1180], [992, 900], [1024, 900], [1200, 900], [1280, 900],
  [1366, 900], [1440, 1000], [1536, 960], [1728, 1080], [1920, 1080],
  [2048, 1152], [2560, 1440],
];
const VIEWPORTS_QUICK = [[360, 800], [768, 1024], [1280, 900], [1920, 1080]];
const VIEWPORTS = QUICK ? VIEWPORTS_QUICK : VIEWPORTS_FULL;

// Static routes always tested.
const STATIC_ROUTES = [
  "/",
  "/san-pham",
  "/danh-muc-san-pham",
  "/brands",
  "/tin-tuc",
  "/gioi-thieu",
  "/lien-he",
  "/huong-dan-mua-hang",
  "/bao-hanh",
  "/so-sanh",
  "/gio-hang",
  "/thanh-toan",
  "/tim-kiem?q=ao",
  "/dang-nhap",
  "/dang-ky",
  "/quen-mat-khau",
  "/xac-nhan-email",
  "/tai-khoan",
  "/tai-khoan/don-hang",
  "/tai-khoan/yeu-thich",
  "/tai-khoan/doi-tra",
  "/tai-khoan/edit-account",
];

// Routes that get full-page screenshots (subset) at SHOT_VIEWPORTS.
const SHOT_ROUTE_HINTS = [
  "/", "/san-pham", "/danh-muc-san-pham", "/tin-tuc", "/dang-nhap",
  "/gio-hang", "/thanh-toan", "/gioi-thieu", "/lien-he", "/brands", "/so-sanh",
];
const SHOT_VIEWPORTS = QUICK ? [[390, 844], [1280, 900]] : [[390, 844], [768, 1024], [1280, 900], [1920, 1080]];

function slug(s) {
  return s.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "root";
}

// In-page measurement. Returns overflow offenders, scroll metrics, alignment.
function measure() {
  const TOL = 1.5; // px tolerance for sub-pixel overflow noise (must be in-page scope)
  const innerW = window.innerWidth;
  const docEl = document.documentElement;
  const scroll = {
    scrollWidth: docEl.scrollWidth,
    clientWidth: docEl.clientWidth,
    innerWidth: innerW,
    hasHScroll: docEl.scrollWidth > docEl.clientWidth + 1,
  };

  const clipsX = (cs) =>
    cs.overflowX === "hidden" || cs.overflowX === "clip" ||
    cs.overflowX === "auto" || cs.overflowX === "scroll";

  // Classify where an overflowing element is first clipped. If the nearest
  // clipping ancestor is a real scroll/carousel container, the bleed is
  // contained (intended). If nothing clips before html/body, the content is
  // silently cut by the global overflow-x:hidden guard => a REAL defect.
  function nearestClipper(el) {
    let p = el.parentElement;
    while (p && p !== docEl) {
      const tag = p.tagName.toLowerCase();
      if (tag === "body") return "html-body";
      const cs = getComputedStyle(p);
      if (clipsX(cs)) return (p.getAttribute("class") || tag).slice(0, 44);
      p = p.parentElement;
    }
    return "html-body";
  }

  const all = Array.from(document.querySelectorAll("body *"));
  const raw = [];
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;
    if (cs.position === "fixed") continue; // fixed chrome handled separately
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.right <= 0 || r.left >= innerW) continue; // entirely off-canvas (drawers)
    const overRight = r.right - innerW;
    const overLeft = -r.left;
    const over = Math.max(overRight, overLeft);
    if (over <= TOL) continue;
    raw.push({
      el, side: overRight >= overLeft ? "right" : "left",
      over: Math.round(over), left: Math.round(r.left), right: Math.round(r.right),
      width: Math.round(r.width), tag: el.tagName.toLowerCase(),
      id: el.id || "", cls: (el.getAttribute("class") || "").slice(0, 120),
    });
  }
  // Keep only outermost offenders (drop a child if an ancestor overflows >=).
  const set = new Set(raw.map((o) => o.el));
  let offenders = raw.filter((o) => {
    let p = o.el.parentElement;
    while (p) {
      if (set.has(p)) {
        const po = raw.find((x) => x.el === p);
        if (po && po.over >= o.over - 1) return false;
      }
      p = p.parentElement;
    }
    return true;
  });
  offenders = offenders.map((o) => ({ ...o, clip: nearestClipper(o.el) }));
  const realBleed = offenders.filter((o) => o.clip === "html-body")
    .map(({ el, ...r }) => r).sort((a, b) => b.over - a.over).slice(0, 10);
  const contained = offenders.filter((o) => o.clip !== "html-body")
    .map(({ el, ...r }) => r).sort((a, b) => b.over - a.over).slice(0, 8);

  // Fixed elements bleeding past viewport (chat btn, sticky bars)
  const fixedOver = [];
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed") continue;
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.left >= innerW || r.right <= 0) continue;
    const over = Math.max(r.right - innerW, -r.left);
    if (over > TOL) fixedOver.push({ over: Math.round(over), left: Math.round(r.left), right: Math.round(r.right), tag: el.tagName.toLowerCase(), cls: (el.getAttribute("class") || "").slice(0, 80) });
  }

  // Content-rail alignment: collect centered content containers (not full-bleed,
  // roughly symmetric L/R inset) and report distinct left insets. Divergent
  // insets within one page = sections not sharing a common container gutter.
  const railSel = ".bb-container, .container, .bb-section, .bb-page-head, .bb-breadcrumb, .bb-pdp, .bb-checkout-layout, .bb-account-layout, .bb-cat-layout, .bb-cat-seo, .bb-products-section .bb-container, [class*='container']";
  const railRoot = document.querySelector("main.bb-main") || document.querySelector("main") || document.body;
  const rails = [];
  for (const el of Array.from(railRoot.querySelectorAll(railSel))) {
    if (el.closest("header, footer")) continue; // header/footer rails intentionally differ
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.height <= 0 || r.width <= 0) continue;
    const inset = Math.round(r.left);
    const rightInset = Math.round(innerW - r.right);
    if (r.width >= innerW - 4) continue;          // full-bleed
    if (inset < 4) continue;                       // touches left edge
    if (inset > innerW / 2) continue;              // off-canvas/weird
    if (Math.abs(inset - rightInset) > 24) continue; // not a centered rail
    rails.push({ inset, cls: (el.getAttribute("class") || "").slice(0, 50), width: Math.round(r.width) });
  }
  const distinctLefts = [...new Set(rails.map((r) => r.inset))].sort((a, b) => a - b);
  const railMisalign = distinctLefts.length > 1 && (distinctLefts[distinctLefts.length - 1] - distinctLefts[0]) > 8;

  // Top-level section vertical rhythm: overlap (negative gap) + huge gaps.
  const main = document.querySelector("main.bb-main") || document.querySelector("main");
  const sections = [];
  if (main) {
    let nodes = Array.from(main.children);
    if (nodes.length === 1 && nodes[0].children.length > 1) nodes = Array.from(nodes[0].children);
    for (const node of nodes) {
      if (getComputedStyle(node).display === "none") continue;
      const r = node.getBoundingClientRect();
      if (r.height <= 1) continue;
      sections.push({ cls: (node.getAttribute("class") || node.tagName.toLowerCase()).slice(0, 50), top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) });
    }
  }
  const gaps = [];
  for (let i = 1; i < sections.length; i++) gaps.push({ between: [sections[i - 1].cls, sections[i].cls], gap: sections[i].top - sections[i - 1].bottom });
  const overlap = gaps.filter((g) => g.gap < -2);

  return { scroll, realBleed, contained, fixedOver, distinctLefts, railMisalign, rails: rails.slice(0, 20), sections, overlap };
}

async function discoverDynamic(page) {
  const found = {};
  const grab = async (listPath, re, key) => {
    try {
      await page.goto(BASE + listPath, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(800);
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
      const m = hrefs.find((h) => h && re.test(h));
      if (m) found[key] = m.startsWith("http") ? new URL(m).pathname + new URL(m).search : m;
    } catch (e) { /* ignore */ }
  };
  await grab("/san-pham", /\/product\//, "product");
  await grab("/danh-muc-san-pham", /\/danh-muc-san-pham\/[^/?#]+$/, "category");
  await grab("/brands", /\/brands\/[^/?#]+$/, "brand");
  await grab("/tin-tuc", /\/tin-tuc\/[^/?#]+$/, "article");
  // policy + guide + cms catch-all from footer links on home
  await grab("/", /\/chinh-sach\/[^/?#]+$/, "policy");
  await grab("/huong-dan", /\/huong-dan\/[^/?#]+/, "guide");
  return found;
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();

  console.log(`[audit:${TAG}] discovering dynamic routes...`);
  const dyn = await discoverDynamic(page);
  console.log("[audit] dynamic:", JSON.stringify(dyn));

  let routes = [...STATIC_ROUTES];
  for (const v of Object.values(dyn)) if (v && !routes.includes(v)) routes.push(v);
  if (QUICK) routes = routes.filter((r) => ["/", "/san-pham", "/dang-nhap", "/gio-hang", dyn.product, dyn.category].includes(r));
  if (process.env.BB_ONLY) routes = process.env.BB_ONLY.split(",").map((s) => s.trim()).filter(Boolean);

  const report = { tag: TAG, base: BASE, when: "", viewports: VIEWPORTS, dynamic: dyn, routes: {} };

  for (const route of routes) {
    const rrep = { finalUrl: null, error: null, byViewport: {} };
    for (const [w, h] of VIEWPORTS) {
      await page.setViewportSize({ width: w, height: h });
      const key = `${w}x${h}`;
      try {
        const resp = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 45000 });
        rrep.status = resp ? resp.status() : null;
        await page.waitForTimeout(QUICK ? 500 : 700);
        // scroll to bottom to trigger lazy content, then back to top
        await page.evaluate(async () => {
          await new Promise((res) => {
            let y = 0; const step = () => { window.scrollTo(0, y); y += window.innerHeight; if (y < document.body.scrollHeight) requestAnimationFrame(step); else res(); };
            step();
          });
        });
        await page.waitForTimeout(200);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(150);
        rrep.finalUrl = new URL(page.url()).pathname + new URL(page.url()).search;
        const m = await page.evaluate(measure);
        rrep.byViewport[key] = m;
      } catch (e) {
        rrep.byViewport[key] = { error: String(e).slice(0, 200) };
      }
    }

    // Screenshots for subset
    const isShot = SHOT_ROUTE_HINTS.includes(route) || route === dyn.product || route === dyn.category || route === dyn.article;
    if (isShot) {
      for (const [w, h] of SHOT_VIEWPORTS) {
        await page.setViewportSize({ width: w, height: h });
        try {
          await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 45000 });
          await page.waitForTimeout(800);
          await page.evaluate(async () => { await new Promise((res) => { let y = 0; const step = () => { window.scrollTo(0, y); y += window.innerHeight; if (y < document.body.scrollHeight) requestAnimationFrame(step); else res(); }; step(); }); });
          await page.waitForTimeout(300);
          await page.evaluate(() => window.scrollTo(0, 0));
          const name = `${TAG}__${slug(route)}__${w}x${h}.png`;
          await page.screenshot({ path: join(SHOTS, name), fullPage: true });
        } catch (e) { /* ignore */ }
      }
    }
    report.routes[route] = rrep;
    const totalBleed = Object.values(rrep.byViewport).reduce((n, v) => n + ((v.realBleed && v.realBleed.length) || 0), 0);
    console.log(`[audit] ${route}  status=${rrep.status}  final=${rrep.finalUrl}  realBleed(sum)=${totalBleed}`);
  }

  await browser.close();
  const outFile = join(OUT, `report-${TAG}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`\n[audit:${TAG}] wrote ${outFile}`);

  // Console summary: routes×viewports with real bleed / hscroll / misalign / overlap
  console.log("\n==== SUMMARY (issues only) ====");
  let issueCount = 0;
  for (const [route, rrep] of Object.entries(report.routes)) {
    for (const [vp, m] of Object.entries(rrep.byViewport)) {
      if (m.error) { console.log(`! ${route} @ ${vp}  ERROR ${m.error}`); issueCount++; continue; }
      const bleed = (m.realBleed || []).length;
      const hs = m.scroll && m.scroll.hasHScroll;
      const fx = (m.fixedOver || []).length;
      const misalign = m.railMisalign;
      const overlap = (m.overlap || []).length;
      if (bleed || hs || fx || misalign || overlap) {
        issueCount++;
        const bits = [];
        if (hs) bits.push(`HSCROLL(${m.scroll.scrollWidth}>${m.scroll.clientWidth})`);
        if (bleed) bits.push(`BLEED×${bleed}[${m.realBleed.slice(0, 3).map((o) => `${(o.cls || o.tag).slice(0, 28)}:${o.over}px`).join(", ")}]`);
        if (fx) bits.push(`fixedOver×${fx}`);
        if (misalign) bits.push(`railMisalign=${JSON.stringify(m.distinctLefts)}`);
        if (overlap) bits.push(`OVERLAP×${overlap}`);
        console.log(`- ${route} @ ${vp}: ${bits.join(" | ")}`);
      }
    }
  }
  console.log(`==== END (${issueCount} route×viewport cells with issues) ====`);
}

run().catch((e) => { console.error(e); process.exit(1); });
