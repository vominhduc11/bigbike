// A/B probe for bb-news-card (ArticleCard default variant) on the 404/not-found page.
// Modes:
//   node probe-card.js capture <baseUrl> <outFile>
//   node probe-card.js diff <oldJson> <newJson>
// Anchors structurally (classes differ old<->new): a card = <a> with exactly 2 element
// children whose 2nd child's first child is a <span> (the date badge).
const { chromium } = require("playwright");
const fs = require("fs");

const VIEWPORTS = [1280, 768, 767, 390];
const NOT_FOUND_URL = "/khong-ton-tai-blog-probe-xyz/";

const PROPS = {
  card: ["display","flexDirection","backgroundColor","borderTopStyle","borderTopWidth","borderTopColor","borderRadius","boxShadow","textDecorationLine","color","transitionProperty","transitionDuration"],
  imgWrap: ["position","aspectRatio","overflow","flexShrink","backgroundColor"],
  img: ["display","objectFit","transitionProperty","transitionDuration"],
  date: ["position","top","left","zIndex","display","alignItems","height","minWidth","paddingTop","paddingRight","paddingBottom","paddingLeft","backgroundColor","color","fontFamily","fontSize","fontWeight","letterSpacing","textTransform","whiteSpace","borderRadius","clipPath"],
  body: ["position","paddingTop","paddingRight","paddingBottom","paddingLeft","display","flexDirection","rowGap","flexGrow","backgroundColor"],
  bodyInside: ["display","flexDirection","rowGap","flexGrow"],
  title: ["fontFamily","fontSize","fontWeight","color","textTransform","lineHeight","marginTop","marginBottom","transitionProperty","transitionDuration","display","webkitLineClamp"],
  excerpt: ["fontSize","color","lineHeight","marginTop","marginBottom","minHeight","display","webkitLineClamp"],
};

const HOVER_PROPS = {
  card: ["boxShadow","borderTopColor"],
  img: ["transform"],
  title: ["color"],
};

function pick(styleObj, names) {
  const o = {};
  for (const n of names) o[n] = styleObj[n];
  return o;
}

async function capture(base, out) {
  const browser = await chromium.launch();
  const result = {};
  for (const vw of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vw, height: 1000 }, deviceScaleFactor: 1 });
    await page.goto(base + NOT_FOUND_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    // recent-articles cards render client-after-data; wait for a card.
    await page.waitForFunction(() => {
      return [...document.querySelectorAll("a")].some((a) => {
        const k = a.children;
        return k.length === 2 && k[1].children.length >= 2 && k[1].children[0].tagName === "SPAN";
      });
    }, { timeout: 60000 }).catch(() => {});

    const data = await page.evaluate((PROPS) => {
      const card = [...document.querySelectorAll("a")].find((a) => {
        const k = a.children;
        return k.length === 2 && k[1].children.length >= 2 && k[1].children[0].tagName === "SPAN";
      });
      if (!card) return { __missing: true };
      card.setAttribute("data-probe", "card");
      const imgWrap = card.children[0];
      const img = imgWrap.querySelector("img");
      const body = card.children[1];
      const date = body.children[0];
      const bodyInside = body.children[1];
      const category = bodyInside.children[0];
      const title = bodyInside.children[1];
      const excerpt = bodyInside.children[2];
      const els = { card, imgWrap, img, date, body, bodyInside, title, excerpt };
      const out = {};
      for (const key of Object.keys(PROPS)) {
        const el = els[key];
        if (!el) { out[key] = { __missing: true }; continue; }
        const cs = getComputedStyle(el);
        const o = {};
        for (const p of PROPS[key]) o[p] = cs[p];
        out[key] = o;
      }
      out.__tag = { title: title && title.tagName, category: category && category.tagName };
      return out;
    }, PROPS);

    // hover state (desktop only)
    let hover = null;
    if (vw === 1280 && !data.__missing) {
      await page.hover("[data-probe=card]");
      await page.waitForTimeout(450);
      hover = await page.evaluate((HOVER_PROPS) => {
        const card = document.querySelector("[data-probe=card]");
        const img = card.children[0].querySelector("img");
        const title = card.children[1].children[1].children[1];
        const grab = (el, names) => { const cs = getComputedStyle(el); const o = {}; for (const n of names) o[n] = cs[n]; return o; };
        return { card: grab(card, HOVER_PROPS.card), img: grab(img, HOVER_PROPS.img), title: grab(title, HOVER_PROPS.title) };
      }, HOVER_PROPS);
    }
    result[vw] = { data, hover };
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log("wrote", out);
}

function diff(oldFile, newFile) {
  const o = JSON.parse(fs.readFileSync(oldFile, "utf8"));
  const n = JSON.parse(fs.readFileSync(newFile, "utf8"));
  let mismatches = 0;
  for (const vw of Object.keys(o)) {
    const walk = (a, b, path) => {
      if (a && typeof a === "object") {
        for (const k of Object.keys(a)) walk(a[k], b ? b[k] : undefined, path + "/" + k);
      } else {
        if (String(a) !== String(b)) { mismatches++; console.log(`MISMATCH @${vw} ${path}\n   OLD: ${a}\n   NEW: ${b}`); }
      }
    };
    walk(o[vw], n[vw], "");
  }
  console.log(mismatches === 0 ? "\n✅ 0 MISMATCHES" : `\n❌ ${mismatches} MISMATCHES`);
}

const [mode, a, b] = process.argv.slice(2);
if (mode === "capture") capture(a, b).catch((e) => { console.error(e); process.exit(1); });
else if (mode === "diff") diff(a, b);
else { console.error("usage: capture <base> <out> | diff <old> <new>"); process.exit(1); }
