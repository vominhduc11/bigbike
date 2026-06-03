// Class-injection A/B probe for the home Brand-carousel MOBILE fallback
// (.bb-brand-mobile-grid / -cell / -cell img / -cell span). Injected into the
// real homepage (loads globals) under a synthetic .bb-home host.
//   node probe.js capture old <out.json>   (OLD = c1220852 build on :3001)
//   node probe.js capture new <out.json>   (NEW build on :3001)
//   node probe.js diff <old.json> <new.json>

const { chromium } = require("@playwright/test");
const fs = require("fs");

const PORT = 3001;
const WIDTHS = [374, 390, 429, 430, 500, 599, 600, 700, 767, 768, 1280];

const VARIANTS = {
  old: {
    grid: "bb-brand-mobile-grid md:hidden",
    cell: "bb-brand-mobile-cell",
    img: "",
    span: "",
  },
  new: {
    grid: "md:hidden grid max-md:grid-cols-2 min-[430px]:max-md:grid-cols-3 min-[600px]:max-md:grid-cols-4 max-md:gap-2",
    cell:
      "max-md:flex max-md:items-center max-md:justify-center max-md:bg-card max-md:p-2.5 max-md:text-foreground max-md:font-heading max-md:text-[12px] max-md:font-semibold max-md:leading-[1.05] max-md:text-center max-md:uppercase max-md:min-h-[78px] max-md:border max-md:border-border",
    img: "max-md:!max-w-[86%] max-md:max-h-[44px] max-md:!object-contain",
    span:
      "max-md:flex max-md:min-h-[42px] max-md:w-full max-md:items-center max-md:justify-center max-md:border max-md:border-dashed max-md:border-[var(--bb-border-default)] max-md:bg-[var(--bb-bg-surface-raised)] max-md:px-1.5 max-md:py-1 max-md:text-muted-foreground",
  },
};

async function capture(variant, out) {
  const c = VARIANTS[variant];
  if (!c) throw new Error("variant must be old|new");
  const browser = await chromium.launch();
  const result = {};
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 1400 });
    const sample = await page.evaluate((c) => {
      document.getElementById("__probe_host")?.remove();
      const host = document.createElement("div");
      host.id = "__probe_host";
      host.style.cssText = `position:absolute;left:0;top:0;width:${window.innerWidth}px`;
      const imgsrc =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      host.innerHTML =
        `<div class="bb-home"><div class="${c.grid}" data-grid>` +
        `<a class="${c.cell}" data-cella><img class="${c.img}" data-img src="${imgsrc}"/></a>` +
        `<a class="${c.cell}" data-cellb><span class="${c.span}" data-span>BrandName</span></a>` +
        `</div></div>`;
      document.body.appendChild(host);
      const pick = (el, props) => {
        const s = getComputedStyle(el);
        const o = {};
        props.forEach((p) => (o[p] = s[p]));
        return o;
      };
      const cellProps = [
        "display",
        "alignItems",
        "justifyContent",
        "backgroundColor",
        "paddingTop",
        "paddingLeft",
        "color",
        "fontFamily",
        "fontSize",
        "fontWeight",
        "lineHeight",
        "textAlign",
        "textTransform",
        "minHeight",
        "borderTopWidth",
        "borderTopStyle",
        "borderTopColor",
        "aspectRatio",
      ];
      return {
        grid: pick(host.querySelector("[data-grid]"), [
          "display",
          "gridTemplateColumns",
          "columnGap",
          "rowGap",
          "borderTopWidth",
          "backgroundColor",
        ]),
        cellImg: pick(host.querySelector("[data-cella]"), cellProps),
        img: pick(host.querySelector("[data-img]"), [
          "maxWidth",
          "maxHeight",
          "objectFit",
          "display",
        ]),
        cellSpan: pick(host.querySelector("[data-cellb]"), cellProps),
        span: pick(host.querySelector("[data-span]"), [
          "display",
          "minHeight",
          "width",
          "alignItems",
          "justifyContent",
          "borderTopStyle",
          "borderTopWidth",
          "borderTopColor",
          "backgroundColor",
          "paddingTop",
          "paddingLeft",
          "color",
          "fontFamily",
          "fontSize",
          "textTransform",
        ]),
      };
    }, c);
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
  for (const w of Object.keys(a))
    for (const el of Object.keys(a[w]))
      for (const p of Object.keys(a[w][el])) {
        const ov = a[w][el][p],
          nv = b[w]?.[el]?.[p];
        if (ov !== nv) {
          mism++;
          console.log(`MISMATCH @${w} ${el}.${p}: OLD=${ov}  NEW=${nv}`);
        }
      }
  console.log(mism === 0 ? "✅ 0 mismatch" : `❌ ${mism} mismatches`);
}

const [, , mode, a1, a2] = process.argv;
if (mode === "capture") capture(a1, a2);
else if (mode === "diff") diff(a1, a2);
else console.log("usage: capture old|new <out> | diff <old> <new>");
