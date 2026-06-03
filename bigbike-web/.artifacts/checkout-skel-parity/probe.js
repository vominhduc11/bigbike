// Class-injection parity probe for the CheckoutSkeleton bb-* migration.
// Injects OLD bb-* classes (on docker :3000) vs NEW Tailwind strings (on local
// :3001) into a fixed-width host in document.body, compares computed styles.
//   node probe.js capture <baseURL> <old|new> <out.json>
//   node probe.js diff <old.json> <new.json>
const { chromium } = require("playwright");
const fs = require("fs");

const VIEWPORTS = [390, 600, 601, 767, 768, 769, 1024, 1025, 1280, 1536, 1920, 2560];

const NEW = {
  layout:
    "grid grid-cols-[1fr_420px] max-[1025px]:grid-cols-1 gap-8 max-md:gap-[14px] max-w-[var(--bb-container-wide)] min-[1536px]:max-w-[1480px] min-[1920px]:max-w-[1760px] min-[2560px]:max-w-[2400px] mx-auto mb-10 max-md:mb-7 px-6 max-md:px-[var(--bb-mobile-page-x)]",
  stepper:
    "flex gap-0 mb-6 max-md:mb-[14px] border-b border-b-border max-[601px]:overflow-x-auto max-[601px]:flex-nowrap max-[601px]:[scrollbar-width:none] max-[601px]:[&::-webkit-scrollbar]:hidden",
  step:
    "flex flex-1 items-center gap-3 py-[14px] px-4 max-md:py-2.5 max-md:px-3 border-b-[3px] border-b-transparent text-muted-foreground cursor-pointer [transition:all_140ms] max-md:min-w-[132px] max-md:min-h-[var(--bb-touch-target)]",
  section:
    "bg-card border border-border rounded-none py-[22px] px-6 max-md:py-4 max-md:px-[14px] mb-[18px] max-md:mb-3",
  summary:
    "bg-card border border-border rounded-none p-[22px] max-md:py-4 max-md:px-[14px] sticky max-[769px]:static top-[calc(var(--bb-header-height)+34px+16px)] [align-self:start] max-md:mb-3",
};

const SPECIMENS = {
  layout: {
    tag: "div",
    old: "bb-checkout-layout",
    inlineStyle: "",
    props: ["display", "gridTemplateColumns", "columnGap", "rowGap", "maxWidth",
      "marginTop", "marginRight", "marginBottom", "marginLeft",
      "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  },
  stepper: {
    tag: "div",
    old: "bb-stepper",
    inlineStyle: "",
    props: ["display", "columnGap", "marginBottom", "borderBottomWidth",
      "borderBottomStyle", "borderBottomColor", "overflowX", "flexWrap"],
  },
  step: {
    tag: "div",
    old: "bb-step",
    inlineStyle: "flex:1",
    props: ["display", "flexGrow", "flexShrink", "flexBasis", "alignItems", "columnGap",
      "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "borderBottomWidth", "borderBottomStyle", "borderBottomColor",
      "color", "cursor", "transitionProperty", "transitionDuration",
      "transitionTimingFunction", "minWidth", "minHeight"],
  },
  section: {
    tag: "div",
    old: "bb-checkout-section",
    inlineStyle: "",
    props: ["backgroundColor", "borderTopWidth", "borderTopStyle", "borderTopColor",
      "borderRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "marginBottom", "boxShadow"],
  },
  summary: {
    tag: "aside",
    old: "bb-order-summary",
    inlineStyle: "",
    props: ["backgroundColor", "borderTopWidth", "borderTopStyle", "borderTopColor",
      "borderRadius", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
      "marginBottom", "position", "top", "alignSelf", "boxShadow"],
  },
};

async function capture(baseURL, variant, outPath) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const result = {};
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp, height: 900 });
    await page.goto(baseURL + "/", { waitUntil: "domcontentloaded" });
    const data = await page.evaluate(
      ({ specimens, newCls, variant, vp }) => {
        document.getElementById("__probe_host")?.remove();
        const host = document.createElement("div");
        host.id = "__probe_host";
        host.style.cssText = `position:absolute;left:0;top:0;width:${vp}px;`;
        document.body.appendChild(host);
        const out = {};
        for (const [name, spec] of Object.entries(specimens)) {
          const el = document.createElement(spec.tag);
          el.className = variant === "old" ? spec.old : newCls[name];
          if (spec.inlineStyle) el.style.cssText = spec.inlineStyle;
          host.appendChild(el);
          const cs = getComputedStyle(el);
          const o = {};
          for (const p of spec.props) o[p] = cs[p];
          out[name] = o;
        }
        return out;
      },
      { specimens: SPECIMENS, newCls: NEW, variant, vp }
    );
    result[vp] = data;
  }
  await browser.close();
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log("wrote", outPath);
}

function diff(oldPath, newPath) {
  const a = JSON.parse(fs.readFileSync(oldPath, "utf8"));
  const b = JSON.parse(fs.readFileSync(newPath, "utf8"));
  let mismatches = 0;
  for (const vp of Object.keys(a)) {
    for (const name of Object.keys(a[vp])) {
      for (const p of Object.keys(a[vp][name])) {
        const ov = a[vp][name][p];
        const nv = b[vp]?.[name]?.[p];
        if (ov !== nv) {
          mismatches++;
          console.log(`MISMATCH @${vp} ${name}.${p}: OLD="${ov}" NEW="${nv}"`);
        }
      }
    }
  }
  console.log(mismatches === 0 ? "✅ 0 mismatches" : `❌ ${mismatches} mismatches`);
  process.exit(mismatches === 0 ? 0 : 1);
}

const [, , cmd, ...rest] = process.argv;
if (cmd === "capture") capture(rest[0], rest[1], rest[2]);
else if (cmd === "diff") diff(rest[0], rest[1]);
else { console.error("usage: capture <baseURL> <old|new> <out> | diff <old> <new>"); process.exit(2); }
