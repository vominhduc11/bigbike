// A/B probe for the HOME news section (.bb-home-news-parity) on / .
// Structural anchors only (inner classes change old->new; .bb-home-news-parity kept).
// Modes: capture <base> <out> | diff <old> <new> [filter]
const { chromium } = require("playwright");
const fs = require("fs");
const VIEWPORTS = [2560, 1920, 1536, 1280, 992, 800, 768, 767, 576, 390];

async function capture(base, out) {
  const browser = await chromium.launch();
  const result = {};
  for (const vw of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vw, height: 2200 }, deviceScaleFactor: 1 });
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForSelector(".bb-home-news-parity", { timeout: 30000 }).catch(() => {});
    // explicitly load the title/heading fonts before measuring — the news title sits at a
    // 1-line/2-line wrap boundary, so measuring before Barlow Condensed loads gives a wider
    // fallback metric and a spurious 2-line title (off-by-one-line card height).
    await page.evaluate(async () => {
      const faces = ['600 20px "Barlow Condensed"', '600 14px "Barlow Condensed"', '600 16px "Barlow"'];
      try { await Promise.all(faces.map((f) => document.fonts.load(f))); } catch {}
      try { await document.fonts.ready; } catch {}
    }).catch(() => {});
    await page.waitForTimeout(600);
    result[vw] = await page.evaluate(() => {
      const grab = (el, props, pseudo) => {
        if (!el) return { __missing: true };
        const cs = getComputedStyle(el, pseudo || null);
        const o = {};
        for (const p of props) o[p] = cs[p];
        return o;
      };
      const rect = (el) => {
        if (!el) return { __missing: true };
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      };

      const section = document.querySelector(".bb-home-news-parity");
      const container = section && section.children[0];
      const blockTitle = container && container.children[0];
      const kicker = blockTitle && blockTitle.querySelector("p");
      const h2 = blockTitle && blockTitle.querySelector("h2");
      const newsList = container && container.children[1];
      const row = newsList && newsList.children[0];
      const col0 = row && row.children[0];
      const item = col0 && col0.children[0];
      const thumb = item && item.children[0];
      const thumbA = thumb && thumb.querySelector("a");
      const img = thumbA && thumbA.querySelector("img");
      const desc = item && item.children[1];
      const date = desc && desc.children[0];
      const dateP = date && date.querySelector("p");
      const inside = desc && desc.children[desc.children.length - 1];
      const titlePost = inside && inside.children[0];
      const titleA = titlePost && titlePost.querySelector("a");
      const excerpt = inside && inside.children[1];

      // collateral (shared rules must not break)
      const videoTitle = document.querySelector(".bb-home-video-title");
      const expSection = document.querySelector(".bb-home .bb-experience");
      const bannerAds = document.querySelector(".bb-home .banner-ads");

      const rowOverflow = row
        ? { overflowX: getComputedStyle(row).overflowX, scrolls: row.scrollWidth > row.clientWidth + 1 }
        : { __missing: true };

      return {
        section: grab(section, ["backgroundColor", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight"]),
        container: grab(container, ["maxWidth", "marginLeft", "paddingLeft", "paddingRight"]),
        containerRect: rect(container),
        blockTitle: grab(blockTitle, ["textAlign", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "marginBottom"]),
        kicker: grab(kicker, ["color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textTransform", "marginBottom", "display"]),
        h2: grab(h2, ["color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textTransform", "marginTop", "marginBottom"]),
        newsList: grab(newsList, ["display"]),
        row: grab(row, ["display", "gap", "marginLeft", "marginRight", "paddingLeft", "paddingRight", "gridTemplateColumns"]),
        rowOverflow,
        // NB: flexGrow/Shrink/Basis dropped — inert under ≤767 grid + masked by flex-basis at ≥768;
        // col width/maxWidth/col0Rect already prove the 33.33% column geometry.
        col0: grab(col0, ["width", "maxWidth", "paddingLeft", "paddingRight", "position"]),
        col0Rect: rect(col0),
        item: grab(item, ["boxShadow", "backgroundColor", "marginBottom", "borderTopWidth", "borderTopStyle", "borderTopColor", "borderBottomWidth"]),
        thumb: grab(thumb, ["textAlign", "display"]),
        thumbA: grab(thumbA, ["display", "overflow", "backgroundRepeat", "backgroundSize", "transition"]),
        img: grab(img, ["display", "width", "maxWidth", "height", "objectFit", "verticalAlign"]),
        imgRect: rect(img),
        desc: grab(desc, ["position", "backgroundColor"]),
        date: grab(date, ["position", "top", "left", "display", "width"]),
        dateP: grab(dateP, ["position", "margin", "padding", "backgroundColor", "color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "textTransform", "whiteSpace"]),
        datePAfter: grab(dateP, ["content", "position", "right", "bottom", "width", "height", "backgroundColor", "transform"], "::after"),
        inside: grab(inside, ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "backgroundColor"]),
        titlePost: grab(titlePost, ["margin", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textTransform", "color"]),
        titleA: grab(titleA, ["color", "textDecorationLine", "fontSize", "fontFamily", "lineHeight"]),
        titleARect: rect(titleA),
        titlePostRect: rect(titlePost),
        titleText: titleA ? { t: titleA.textContent.trim().slice(0, 80) } : { __missing: true },
        excerpt: grab(excerpt, ["margin", "fontSize", "lineHeight", "color", "display", "webkitLineClamp", "overflow"]),
        // collateral
        videoTitle: grab(videoTitle, ["color", "fontFamily", "fontSize", "lineHeight", "textTransform"]),
        expSection: grab(expSection, ["paddingTop", "backgroundColor"]),
        bannerAds: grab(bannerAds, ["paddingTop", "backgroundColor"]),
      };
    });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  const at = result[1280] || {};
  console.log("wrote", out, "| @1280 section missing:", !!(at.section || {}).__missing, "| img missing:", !!(at.img || {}).__missing);
}

function diff(of, nf, only) {
  const o = JSON.parse(fs.readFileSync(of, "utf8")), n = JSON.parse(fs.readFileSync(nf, "utf8"));
  let m = 0;
  const walk = (a, b, p, vw) => {
    if (a && typeof a === "object") for (const k of Object.keys(a)) walk(a[k], b ? b[k] : undefined, p + "/" + k, vw);
    else if (String(a) !== String(b)) { if (!only || p.includes(only)) { m++; console.log(`MISMATCH @${vw} ${p}: OLD=${a} NEW=${b}`); } }
  };
  for (const vw of Object.keys(o)) walk(o[vw], n[vw], "", vw);
  console.log(m === 0 ? "✅ 0 MISMATCHES" + (only ? " (filter: " + only + ")" : "") : `❌ ${m} MISMATCHES`);
}

const [mode, a, b, c] = process.argv.slice(2);
if (mode === "capture") capture(a, b).catch((e) => { console.error(e); process.exit(1); });
else if (mode === "diff") diff(a, b, c);
