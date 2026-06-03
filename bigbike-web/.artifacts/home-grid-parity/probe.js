// Class-injection A/B probe for the home WP-grid cleanup migration.
// Injects synthetic .bb-home subtrees (container / row / col-md-4 / col-md-12 /
// promo container / SEO container) into a real page (which loads globals.css)
// and reads computed styles. OLD vs NEW use byte-identical class strings to what
// page.tsx ships, so Tailwind compiles them in the NEW build.
//
//   node probe.js capture old <out.json>   (against OLD build on :3001)
//   node probe.js capture new <out.json>   (against NEW build on :3001)
//   node probe.js diff <old.json> <new.json>

const { chromium } = require("@playwright/test");
const fs = require("fs");

const PORT = Number(process.env.PORT || 3001);
const WIDTHS = [390, 767, 768, 1280, 1536, 1920, 2560];

const CONTAINER_NEW =
  "mx-auto w-full max-w-[var(--bb-container-xl)] px-[15px] max-md:max-w-none max-md:px-[var(--bb-mobile-page-x)]";
const ROW_NEW = "flex flex-wrap -mx-[15px]";
const COL4_NEW =
  "relative w-full px-[15px] md:flex-[0_0_33.333333%] md:max-w-[33.333333%]";
const COL12_NEW =
  "relative w-full px-[15px] md:flex-[0_0_100%] md:max-w-full";
const PROMO_NEW =
  "mx-auto w-full max-w-[var(--bb-container-xl)] px-0 max-md:max-w-none max-md:border max-md:border-border max-md:bg-card";
const SEO_NEW =
  "bb-seo-content-body mx-auto w-full max-w-[var(--bb-container-xl)] px-[15px] max-md:max-w-none max-md:px-[var(--bb-mobile-page-x)]";

const VARIANTS = {
  old: {
    container: "container",
    row: "row",
    col4: "col-md-4",
    col12: "col-md-12",
    promo: "container !px-0 max-md:border max-md:border-border max-md:bg-card",
    seo: "container bb-seo-content-body",
  },
  new: {
    container: CONTAINER_NEW,
    row: ROW_NEW,
    col4: COL4_NEW,
    col12: COL12_NEW,
    promo: PROMO_NEW,
    seo: SEO_NEW,
  },
};

async function capture(variant, out) {
  const cls = VARIANTS[variant];
  if (!cls) throw new Error("variant must be old|new");
  const browser = await chromium.launch();
  const result = {};
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1200 });
    const sample = await page.evaluate((c) => {
      document.getElementById("__probe_host")?.remove();
      const host = document.createElement("div");
      host.id = "__probe_host";
      host.style.cssText = `position:absolute;left:0;top:0;width:${window.innerWidth}px`;
      host.innerHTML =
        `<div class="bb-home">` +
        `<div class="${c.container}" data-container></div>` +
        `<div class="${c.row}" data-row>` +
        `<div class="${c.col4}" data-col4></div>` +
        `</div>` +
        `<div class="${c.row}">` +
        `<div class="${c.col12}" data-col12></div>` +
        `</div>` +
        `<div class="${c.promo}" data-promo></div>` +
        `<div class="content-bottom wyswyg bb-seo-content">` +
        `<div class="${c.seo}" data-seo></div>` +
        `</div>` +
        `</div>`;
      document.body.appendChild(host);
      const pick = (sel, props) => {
        const el = host.querySelector(sel);
        const s = getComputedStyle(el);
        const o = {};
        props.forEach((p) => (o[p] = s[p]));
        return o;
      };
      const RAIL = ["maxWidth", "width", "marginLeft", "marginRight", "paddingLeft", "paddingRight"];
      const COL = ["position", "flexGrow", "flexShrink", "flexBasis", "maxWidth", "paddingLeft", "paddingRight"];
      return {
        container: pick("[data-container]", RAIL),
        row: pick("[data-row]", ["display", "flexWrap", "marginLeft", "marginRight"]),
        col4: pick("[data-col4]", COL),
        col12: pick("[data-col12]", COL),
        promo: pick("[data-promo]", [...RAIL, "borderTopWidth", "borderTopStyle", "borderTopColor", "borderLeftWidth", "backgroundColor"]),
        seo: pick("[data-seo]", RAIL),
      };
    }, cls);
    result[width] = sample;
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log("wrote", out);
}

function diff(oldF, newF) {
  const a = JSON.parse(fs.readFileSync(oldF, "utf8"));
  const b = JSON.parse(fs.readFileSync(newF, "utf8"));
  let mism = 0;
  for (const w of Object.keys(a)) {
    for (const el of Object.keys(a[w])) {
      for (const p of Object.keys(a[w][el])) {
        const ov = a[w][el][p];
        const nv = b[w]?.[el]?.[p];
        if (ov !== nv) {
          mism++;
          console.log(`MISMATCH @${w} ${el}.${p}: OLD=${ov}  NEW=${nv}`);
        }
      }
    }
  }
  console.log(mism === 0 ? "✅ 0 mismatch" : `❌ ${mism} mismatches`);
}

const [, , mode, a1, a2] = process.argv;
if (mode === "capture") capture(a1, a2);
else if (mode === "diff") diff(a1, a2);
else console.log("usage: capture old|new <out> | diff <old> <new>");
