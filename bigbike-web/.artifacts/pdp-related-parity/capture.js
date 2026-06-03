// Capture related-carousel decoration computed styles from ONE server into a JSON.
// Usage: node capture.js <baseUrl> <outFile>
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.argv[2];
const OUT = process.argv[3];
const SLUG = "mu-bao-hiem-ls2-ff327-challenger-carbon";
const URL = `${BASE}/product/${SLUG}/`;
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
  const section = container.parentElement.parentElement.parentElement;
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
    const o = { _w: round(r.width), _h: round(r.height) };
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
  const out = {};
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForSelector(".bb-wp-related-track", { timeout: 15000 }).catch(() => {});
    out[vp.name] = await page.evaluate(collect);
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  const ok = Object.values(out).every((v) => v && !v.error);
  console.log(`captured ${BASE} -> ${OUT} | all-rendered=${ok}`);
})();
