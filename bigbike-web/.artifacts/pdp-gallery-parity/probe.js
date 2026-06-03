// A/B probe for PDP gallery migration (bb-wp-gallery-* -> inline Tailwind).
// Compares OLD (:3000 docker, legacy CSS) vs NEW (:3001 build, inline Tailwind).
// Anchored on the KEPT `.bb-wp-pdp-gallery-col` shell marker (present in both).
const { chromium } = require("playwright");

const SLUG = "mu-bao-hiem-ls2-ff327-challenger-carbon";
const OLD = `http://localhost:3000/product/${SLUG}/`;
const NEW = `http://localhost:3001/product/${SLUG}/`;
const VIEWPORTS = [
  { name: "1024-edge", w: 1024, h: 900 },
  { name: "1023-edge", w: 1023, h: 900 },
  { name: "1022-edge", w: 1022, h: 900 },
  { name: "768-edge", w: 768, h: 900 },
  { name: "767-edge", w: 767, h: 900 },
];

// Visual props to compare via getComputedStyle.
const VISUAL = [
  "display", "position", "gridTemplateColumns", "flexDirection",
  "alignItems", "justifyContent", "gap", "overflowX", "overflowY",
  "backgroundColor", "color", "borderTopWidth", "borderTopColor",
  "borderTopStyle", "objectFit", "aspectRatio", "maxHeight",
  "zIndex", "cursor", "transform", "animationName", "animationDuration",
  "scrollBehavior",
];

function collect() {
  // runs in page
  const round = (n) => Math.round(n * 10) / 10;
  const out = {};
  const col = document.querySelector(".bb-wp-pdp-gallery-col");
  if (!col) return { error: "no gallery-col" };
  const root = col.firstElementChild;
  if (!root) return { error: "no gallery root" };

  const props = ["display","position","gridTemplateColumns","flexDirection",
    "alignItems","justifyContent","gap","overflowX","overflowY","backgroundColor",
    "color","borderTopWidth","borderTopColor","borderTopStyle","objectFit",
    "aspectRatio","maxHeight","zIndex","cursor","transform","animationName",
    "animationDuration","scrollBehavior","width","height","minWidth","minHeight",
    "paddingTop","paddingBottom","paddingLeft","paddingRight","flexBasis",
    "flexGrow","flexShrink","top","left","right","bottom"];

  function snap(el) {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const o = { _rect: { w: round(r.width), h: round(r.height), x: round(r.x), y: round(r.y) } };
    for (const p of props) o[p] = cs[p];
    return o;
  }

  const childCount = root.children.length;
  out.galleryRoot = snap(root);
  out._hasThumbs = childCount > 1;

  let thumbsWrap = null, mainWrap = null;
  if (childCount > 1) {
    thumbsWrap = root.children[0];
    mainWrap = root.children[1];
  } else {
    mainWrap = root.children[0];
  }

  if (thumbsWrap) {
    out.thumbsWrap = snap(thumbsWrap);
    const prevBtn = thumbsWrap.children[0];
    const thumbsContainer = thumbsWrap.children[1];
    const nextBtn = thumbsWrap.children[2];
    out.thumbPrevBtn = snap(prevBtn);
    out.thumbPrevSvg = snap(prevBtn ? prevBtn.querySelector("svg") : null);
    out.thumbNextBtn = snap(nextBtn);
    out.thumbsContainer = snap(thumbsContainer);
    if (thumbsContainer) {
      const firstThumb = thumbsContainer.children[0];
      out.firstThumb = snap(firstThumb);
      out.firstThumbImg = snap(firstThumb ? firstThumb.querySelector("img") : null);
    }
  }

  if (mainWrap) {
    out.mainWrap = snap(mainWrap);
    const mainBox = mainWrap.children[0];
    out.mainBox = snap(mainBox);
    if (mainBox) {
      const anim = mainBox.children[0];
      out.animDiv = snap(anim);
      out.mainImg = snap(mainBox.querySelector("img"));
    }
    // main nav buttons (children after mainBox)
    out.mainPrevNav = snap(mainWrap.children[1]);
    out.mainNextNav = snap(mainWrap.children[2]);
  }

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
      await page.waitForSelector(".bb-wp-pdp-gallery-col", { timeout: 15000 }).catch(() => {});
      data[label] = await page.evaluate(collect);
    }
    results[vp.name] = data;
    await ctx.close();
  }
  await browser.close();

  // Compare
  let totalMismatch = 0;
  for (const [vp, { old, new: nw }] of Object.entries(results)) {
    const mism = [];
    if (old.error || nw.error) {
      console.log(`\n## ${vp}: ERROR old=${old.error} new=${nw.error}`);
      continue;
    }
    const els = new Set([...Object.keys(old), ...Object.keys(nw)].filter((k) => !k.startsWith("_")));
    for (const el of els) {
      const a = old[el], b = nw[el];
      if (!a && !b) continue;
      if (!a || !b) { mism.push(`${el}: present old=${!!a} new=${!!b}`); continue; }
      // rect
      for (const k of ["w", "h"]) {
        if (Math.abs((a._rect?.[k] ?? 0) - (b._rect?.[k] ?? 0)) > 1.5) {
          mism.push(`${el}.rect.${k}: old=${a._rect[k]} new=${b._rect[k]}`);
        }
      }
      for (const p of VISUAL.concat(["width","height","minWidth","minHeight",
        "paddingTop","paddingBottom","paddingLeft","paddingRight","flexBasis",
        "flexGrow","flexShrink","top","left","right","bottom"])) {
        if (a[p] !== b[p]) {
          // tolerate sub-px width/height already covered by rect; only flag discrete
          if (["width","height","top","left","right","bottom","flexBasis","maxHeight","paddingLeft","paddingRight","paddingTop","paddingBottom"].includes(p)) {
            // numeric tolerance 1.5px
            const na = parseFloat(a[p]), nb = parseFloat(b[p]);
            if (!isNaN(na) && !isNaN(nb) && Math.abs(na - nb) <= 1.5) continue;
          }
          mism.push(`${el}.${p}: old="${a[p]}" new="${b[p]}"`);
        }
      }
    }
    totalMismatch += mism.length;
    console.log(`\n## ${vp} — ${mism.length} mismatch(es) [hasThumbs old=${old._hasThumbs} new=${nw._hasThumbs}]`);
    mism.forEach((m) => console.log("  - " + m));
  }
  console.log(`\n=== TOTAL MISMATCHES: ${totalMismatch} ===`);
  process.exit(totalMismatch > 0 ? 1 : 0);
})();
