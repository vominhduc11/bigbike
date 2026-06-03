// Class-injection A/B probe for the home VIDEO section leaf
// (section .videos-slide / .videos-slide--inner / title-wrapper :has / h2 .bb-home-video-title).
//   node probe.js capture old <out.json>   (OLD = ada9ccf4 build on :3001)
//   node probe.js capture new <out.json>   (NEW build on :3001)
//   node probe.js diff <old.json> <new.json>

const { chromium } = require("@playwright/test");
const fs = require("fs");

const PORT = 3001;
const WIDTHS = [390, 767, 768, 800, 1023, 1024, 1280, 1536, 1920, 2560];

const VARIANTS = {
  old: {
    section: "videos-slide",
    inner: "videos-slide--inner",
    wrapper: "text-center text-white",
    h2: "bb-home-video-title",
  },
  new: {
    section: "videos-slide pt-20 pb-0 max-[1024px]:pt-16 max-md:pt-7 max-md:bg-background",
    inner:
      "pb-16 max-[1024px]:pb-13 max-md:pb-10 max-md:bg-[color:var(--bb-bg-surface-dark)]",
    wrapper:
      "text-center text-white pt-18 max-[1024px]:pt-12 max-md:pt-9 pb-13 max-[1024px]:pb-8 max-md:pb-5",
    h2: "my-0 mx-auto max-w-[820px] text-white font-heading text-[length:var(--fs-h1)] max-[1024px]:text-[length:var(--fs-h2)] max-md:text-[length:var(--fs-h3)] font-semibold leading-[1.12] max-[1024px]:leading-[1.1] max-md:leading-[1.12] tracking-normal uppercase text-balance",
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
    await page.setViewportSize({ width, height: 1200 });
    const sample = await page.evaluate((c) => {
      document.getElementById("__probe_host")?.remove();
      const host = document.createElement("div");
      host.id = "__probe_host";
      host.style.cssText = `position:absolute;left:0;top:0;width:${window.innerWidth}px`;
      host.innerHTML =
        `<div class="bb-home"><section class="${c.section}" data-sec>` +
        `<div class="${c.inner}" data-inner>` +
        `<div class="relative z-[1] mx-auto w-full max-w-[var(--bb-container-xl)] px-[15px]">` +
        `<div class="${c.wrapper}" data-wrap>` +
        `<h2 class="${c.h2}" data-h2>Trải nghiệm sản phẩm cùng BigBike.vn</h2>` +
        `</div></div></div></section></div>`;
      document.body.appendChild(host);
      const pick = (el, props) => {
        const s = getComputedStyle(el);
        const o = {};
        props.forEach((p) => (o[p] = s[p]));
        return o;
      };
      return {
        section: pick(host.querySelector("[data-sec]"), [
          "paddingTop",
          "paddingBottom",
          "paddingLeft",
          "paddingRight",
          "backgroundColor",
        ]),
        inner: pick(host.querySelector("[data-inner]"), [
          "paddingTop",
          "paddingBottom",
          "backgroundColor",
        ]),
        wrapper: pick(host.querySelector("[data-wrap]"), ["paddingTop", "paddingBottom"]),
        h2: pick(host.querySelector("[data-h2]"), [
          "marginTop",
          "marginBottom",
          "marginLeft",
          "marginRight",
          "maxWidth",
          "color",
          "fontFamily",
          "fontSize",
          "fontWeight",
          "lineHeight",
          "letterSpacing",
          "textTransform",
          "textWrap",
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
