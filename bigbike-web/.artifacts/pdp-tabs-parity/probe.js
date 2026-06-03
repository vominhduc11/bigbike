// A/B probe for PDP tabs migration (bb-wp-tabs shell -> inline Tailwind).
// Markers `.bb-wp-tabs` (section) + `.tab-panel` (panels) are KEPT in both builds
// (they host the line-height reset), so they anchor the probe directly.
const { chromium } = require("playwright");

const SLUG = "mu-bao-hiem-ls2-ff327-challenger-carbon";
const OLD = `http://localhost:3000/product/${SLUG}/`;
const NEW = `http://localhost:3001/product/${SLUG}/`;
const VIEWPORTS = [
  { name: "1280-desktop", w: 1280, h: 900 },
  { name: "1024-edge", w: 1024, h: 900 },
  { name: "1023-edge", w: 1023, h: 900 },
  { name: "1022-edge", w: 1022, h: 900 },
  { name: "768-edge", w: 768, h: 900 },
  { name: "767-edge", w: 767, h: 900 },
  { name: "390-mobile", w: 390, h: 900 },
];

function collect() {
  const round = (n) => Math.round(n * 10) / 10;
  const out = {};
  const sec = document.querySelector(".bb-wp-tabs");
  if (!sec) return { error: "no .bb-wp-tabs" };

  const P = ["display","position","flexWrap","width","maxWidth","marginTop","marginBottom",
    "marginLeft","marginRight","paddingLeft","paddingRight","paddingTop","paddingBottom",
    "height","overflowX","overflowY","borderTopWidth","borderTopStyle","borderTopColor",
    "backgroundColor","color","fontFamily","fontSize","fontWeight","lineHeight","textAlign",
    "textDecorationLine","textTransform","zIndex","listStyleType","letterSpacing","scrollMarginTop"];
  const PSEUDO = ["content","display","position","top","left","right","height","width",
    "zIndex","backgroundColor","borderTopColor","borderTopWidth","borderLeftColor","transform",
    "marginBottom","fontFamily","fontSize","fontWeight","color","textTransform","letterSpacing","lineHeight"];

  function snap(el, withPseudo) {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const o = { _rect: { w: round(r.width), h: round(r.height) } };
    for (const p of P) o[p] = cs[p];
    if (withPseudo) {
      const b = getComputedStyle(el, "::before"), a = getComputedStyle(el, "::after");
      o._before = {}; o._after = {};
      for (const p of PSEUDO) { o._before[p] = b[p]; o._after[p] = a[p]; }
    }
    return o;
  }

  out.section = snap(sec, false);
  const navWrap = sec.children[0];
  out.navWrap = snap(navWrap, false);
  const ul = navWrap ? navWrap.firstElementChild : null;
  out.ul = snap(ul, true); // ::before divider
  const firstLi = ul ? ul.children[0] : null;
  out.firstLi = snap(firstLi, false);
  const firstLink = firstLi ? firstLi.children[0] : null;
  out.firstLink = snap(firstLink, true); // ::after skew (active link)
  const secondLi = ul ? ul.children[1] : null;
  const secondLink = secondLi ? secondLi.children[0] : null;
  out.secondLink = snap(secondLink, true); // ::after skew (inactive link)

  const panels = sec.querySelectorAll(".tab-panel");
  out._panelCount = panels.length;
  out.panel0 = snap(panels[0], true); // active -> ::before section title on mobile
  out.panel1 = snap(panels[1], true); // inactive

  return out;
}

(async () => {
  const browser = await chromium.launch();
  const results = {};
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const data = {};
    for (const [label, url] of [["old", OLD], ["new", NEW]]) {
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForSelector(".bb-wp-tabs", { timeout: 15000 }).catch(() => {});
      data[label] = await page.evaluate(collect);
    }
    results[vp.name] = data;
    await ctx.close();
  }
  await browser.close();

  let total = 0;
  const numericTol = new Set(["width","maxWidth","marginTop","marginBottom","marginLeft","marginRight",
    "paddingLeft","paddingRight","paddingTop","paddingBottom","height","top","left","right","lineHeight",
    "borderTopWidth","fontSize","marginBottom","scrollMarginTop"]);
  function cmp(path, a, b, mism) {
    if (a == null && b == null) return;
    if (a == null || b == null) { mism.push(`${path}: present old=${a!=null} new=${b!=null}`); return; }
    if (typeof a === "object" && a._rect) {
      for (const k of ["w","h"]) if (Math.abs((a._rect[k]||0)-(b._rect[k]||0))>1.5) mism.push(`${path}.rect.${k}: ${a._rect[k]} vs ${b._rect[k]}`);
    }
    for (const k of Object.keys(a)) {
      if (k === "_rect") continue;
      if (k === "_before" || k === "_after") { cmpFlat(`${path}${k}`, a[k], b[k], mism); continue; }
      cmpVal(`${path}.${k}`, k, a[k], b[k], mism);
    }
  }
  function cmpFlat(path, a, b, mism) {
    if (!a || !b) return;
    for (const k of Object.keys(a)) cmpVal(`${path}.${k}`, k, a[k], b[k], mism);
  }
  function cmpVal(path, key, a, b, mism) {
    if (a === b) return;
    if (numericTol.has(key)) { const na=parseFloat(a),nb=parseFloat(b); if(!isNaN(na)&&!isNaN(nb)&&Math.abs(na-nb)<=1.5) return; }
    mism.push(`${path}: old="${a}" new="${b}"`);
  }

  for (const [vp, { old, new: nw }] of Object.entries(results)) {
    const mism = [];
    if (old.error || nw.error) { console.log(`\n## ${vp}: ERROR old=${old.error} new=${nw.error}`); continue; }
    for (const el of new Set([...Object.keys(old), ...Object.keys(nw)])) {
      if (el.startsWith("_")) continue;
      cmp(el, old[el], nw[el], mism);
    }
    total += mism.length;
    console.log(`\n## ${vp} — ${mism.length} mismatch(es) [panels old=${old._panelCount} new=${nw._panelCount}]`);
    mism.forEach((m) => console.log("  - " + m));
  }
  console.log(`\n=== TOTAL MISMATCHES: ${total} ===`);
  process.exit(total > 0 ? 1 : 0);
})();
