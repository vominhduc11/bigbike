// Class-injection A/B probe for the home Brand carousel section wrapper (.partner-slide).
// Synthetic .bb-home > .partner-slide host injected into the real homepage (loads globals).
//   node probe.js capture old <out.json>   (OLD build on :3001)
//   node probe.js capture new <out.json>   (NEW build on :3001)
//   node probe.js diff <old.json> <new.json>

const { chromium } = require("@playwright/test");
const fs = require("fs");

const PORT = 3001;
const WIDTHS = [390, 767, 768, 800, 1023, 1024, 1280, 1536, 1920, 2560];

const VARIANTS = {
  old: { wrapper: "partner-slide pt-120 pb-120" },
  new: {
    wrapper:
      "partner-slide pt-30 pb-30 max-[1024px]:pt-20 max-[1024px]:pb-20 max-md:pt-8 max-md:pb-6 max-md:px-[var(--bb-mobile-page-x)] max-md:bg-background max-md:text-foreground",
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
      host.innerHTML = `<div class="bb-home"><div class="${c.wrapper}" data-w>x</div></div>`;
      document.body.appendChild(host);
      const s = getComputedStyle(host.querySelector("[data-w]"));
      const props = [
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "backgroundColor",
        "color",
      ];
      const o = {};
      props.forEach((p) => (o[p] = s[p]));
      return { wrapper: o };
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
