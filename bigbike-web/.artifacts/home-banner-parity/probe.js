// Class-injection A/B probe for the home PromoBanner (.banner-ads) migration.
// Injects a synthetic .bb-home > .banner-ads > .container > .row > .col-md-12 > img
// subtree into the real homepage (which loads globals.css) and reads computed styles.
// OLD build: run with `old` (legacy bb-* classes present).
// NEW build: run with `new` (banner-ads marker kept + inline Tailwind utilities).
//   The NEW class strings MUST be byte-identical to what page.tsx ships so Tailwind
//   compiles them.
//
//   node probe.js capture old <out.json>   (against OLD build on :3001)
//   node probe.js capture new <out.json>   (against NEW build on :3001)
//   node probe.js diff <old.json> <new.json>

const { chromium } = require("@playwright/test");
const fs = require("fs");

const PORT = 3001;
const WIDTHS = [390, 800, 1280, 1536, 1920, 2560];

const VARIANTS = {
  old: {
    wrapper: "banner-ads pt-60",
    container: "container",
    row: "row",
    col: "col-md-12",
    img: "lazy",
  },
  new: {
    wrapper:
      "banner-ads pt-15 pb-0 max-[1024px]:pt-13 max-md:pt-5 max-md:pb-2 max-md:px-[var(--bb-mobile-page-x)] max-md:bg-background",
    container: "container !px-0 max-md:border max-md:border-border max-md:bg-card",
    row: "row",
    col: "col-md-12",
    img: "lazy w-full",
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
        `<div class="bb-home"><div class="${c.wrapper}" data-w>` +
        `<div class="${c.container}" data-c><div class="${c.row}">` +
        `<div class="${c.col}"><img class="${c.img}" data-i ` +
        `src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"/>` +
        `</div></div></div></div></div>`;
      document.body.appendChild(host);
      const pick = (el, props) => {
        const s = getComputedStyle(el);
        const o = {};
        props.forEach((p) => (o[p] = s[p]));
        return o;
      };
      const w = host.querySelector("[data-w]");
      const ct = host.querySelector("[data-c]");
      const im = host.querySelector("[data-i]");
      return {
        wrapper: pick(w, [
          "paddingTop",
          "paddingRight",
          "paddingBottom",
          "paddingLeft",
          "backgroundColor",
        ]),
        container: pick(ct, [
          "paddingTop",
          "paddingRight",
          "paddingBottom",
          "paddingLeft",
          "maxWidth",
          "width",
          "borderTopWidth",
          "borderTopStyle",
          "borderTopColor",
          "borderLeftWidth",
          "borderLeftColor",
          "backgroundColor",
        ]),
        img: pick(im, ["width", "display", "maxWidth"]),
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
