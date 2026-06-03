// A/B probe for PDP related-carousel migration (decoration -> inline Tailwind;
// .bb-wp-related-track mechanism kept). Anchored on the kept .bb-wp-related-track.
const { chromium } = require("playwright");
const SLUG = "mu-bao-hiem-ls2-ff327-challenger-carbon";
const OLD = `http://localhost:3000/product/${SLUG}/`;
const NEW = `http://localhost:3001/product/${SLUG}/`;
const VIEWPORTS = [
  { name: "1280-desktop", w: 1280, h: 900 },
  { name: "1024-edge", w: 1024, h: 900 },
  { name: "900-tablet", w: 900, h: 1000 },
  { name: "390-mobile", w: 390, h: 900 },
];

function collect() {
  const round = (n) => Math.round(n * 10) / 10;
  const track = document.querySelector(".bb-wp-related-track");
  if (!track) return { error: "no .bb-wp-related-track" };
  const swiperContainer = track.parentElement;
  const woo = swiperContainer.parentElement;
  const nextBtn = woo.children[0], prevBtn = woo.children[1];
  const container = woo.parentElement;
  const productList = container.parentElement;
  const row = productList.parentElement;
  const section = row.parentElement;
  const blockTitle = section.children[0];
  const subTitle = blockTitle ? blockTitle.children[0] : null;
  const heading = blockTitle ? blockTitle.children[1] : null;
  const slide0 = track.children[0];

  const P = ["display","position","width","maxWidth","marginTop","marginBottom","marginLeft",
    "marginRight","paddingLeft","paddingRight","textAlign","top","left","right","zIndex","height",
    "borderTopStyle","borderTopWidth","backgroundColor","color","fontFamily","fontSize","fontWeight",
    "lineHeight","letterSpacing","textTransform","cursor","overflow","gap","transform","flexBasis","flexGrow","flexShrink"];
  function snap(el) {
    if (!el) return null;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const o = { _rect: { w: round(r.width), h: round(r.height) } };
    for (const p of P) o[p] = cs[p];
    return o;
  }
  return {
    section: snap(section), blockTitle: snap(blockTitle), subTitle: snap(subTitle),
    heading: snap(heading), container: snap(container), woo: snap(woo),
    nextBtn: snap(nextBtn), prevBtn: snap(prevBtn), swiperContainer: snap(swiperContainer),
    track: snap(track), slide0: snap(slide0),
  };
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
      await page.waitForSelector(".bb-wp-related-track", { timeout: 15000 }).catch(() => {});
      data[label] = await page.evaluate(collect);
    }
    results[vp.name] = data;
    await ctx.close();
  }
  await browser.close();

  const numericTol = new Set(["width","maxWidth","marginTop","marginBottom","marginLeft","marginRight",
    "paddingLeft","paddingRight","top","left","right","height","lineHeight","fontSize","gap","borderTopWidth","flexBasis"]);
  let total = 0;
  for (const [vp, { old, new: nw }] of Object.entries(results)) {
    const mism = [];
    if (old.error || nw.error) { console.log(`\n## ${vp}: ERR old=${old.error} new=${nw.error}`); continue; }
    for (const el of new Set([...Object.keys(old), ...Object.keys(nw)])) {
      const a = old[el], b = nw[el];
      if (!a || !b) { if (a || b) mism.push(`${el}: present old=${!!a} new=${!!b}`); continue; }
      for (const k of ["w","h"]) if (Math.abs((a._rect[k]||0)-(b._rect[k]||0))>1.5) mism.push(`${el}.rect.${k}: ${a._rect[k]} vs ${b._rect[k]}`);
      for (const k of Object.keys(a)) {
        if (k === "_rect" || a[k] === b[k]) continue;
        if (numericTol.has(k)) { const na=parseFloat(a[k]),nb=parseFloat(b[k]); if(!isNaN(na)&&!isNaN(nb)&&Math.abs(na-nb)<=1.5) continue; }
        mism.push(`${el}.${k}: old="${a[k]}" new="${b[k]}"`);
      }
    }
    total += mism.length;
    console.log(`\n## ${vp} — ${mism.length} mismatch(es)`);
    mism.forEach((m) => console.log("  - " + m));
  }
  console.log(`\n=== TOTAL MISMATCHES: ${total} ===`);
  process.exit(total > 0 ? 1 : 0);
})();
