// Class-injection A/B for the carousel chrome (pagination/arrows don't render with <=4
// featured products). Injects the OLD bb-fp-* class markup (on the OLD build) vs the NEW
// inline-utility markup (on the NEW build) into a .bb-home-products-parity host and compares
// computed styles (incl carousel ::after). Modes: capture <old|new> <out> | diff <old> <new>.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";

const BASE = "http://localhost:3001";
const VIEWPORTS = [1280, 1600, 390];

const ARROW_OLD = "bb-fp-arrow absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-foreground transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&>svg]:h-9 [&>svg]:w-9 min-[1328px]:h-24 min-[1328px]:w-24 min-[1328px]:[&>svg]:h-16 min-[1328px]:[&>svg]:w-16 left-0 min-[1328px]:-left-16";
const ARROW_NEW = "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-foreground transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-md:hidden [&>svg]:h-9 [&>svg]:w-9 min-[1328px]:h-24 min-[1328px]:w-24 min-[1328px]:[&>svg]:h-16 min-[1328px]:[&>svg]:w-16 left-0 min-[1328px]:-left-16";

const CLASSES = {
  old: {
    carousel: "bb-fp-carousel relative",
    viewport: "bb-fp-viewport relative w-full overflow-hidden",
    arrow: ARROW_OLD,
    pagination: "bb-fp-pagination",
    bullet: "swiper-pagination-bullet",
    active: "swiper-pagination-bullet swiper-pagination-bullet-active",
  },
  new: {
    carousel: "relative max-md:after:content-[''] max-md:after:absolute max-md:after:top-0 max-md:after:right-0 max-md:after:bottom-[6px] max-md:after:w-12 max-md:after:bg-[linear-gradient(to_right,transparent,var(--bb-bg-page))] max-md:after:pointer-events-none max-md:after:z-[1]",
    viewport: "relative w-full overflow-x-hidden overflow-y-hidden max-md:overflow-x-auto max-md:pt-0 max-md:pb-[6px] max-md:px-[var(--bb-mobile-page-x)] max-md:[scrollbar-width:none]! max-md:[&::-webkit-scrollbar]:hidden",
    arrow: ARROW_NEW,
    pagination: "relative flex justify-center gap-[5px] mt-[60px] max-md:mt-[20px] max-md:hidden",
    bullet: "inline-block h-[10px] w-[10px] m-0 mx-[5px] p-0 border-none !rounded-[50%] bg-[#cecece] opacity-100 [transition:all_0.3s_ease] cursor-pointer",
    active: "inline-block h-[10px] w-[10px] m-0 mx-[5px] p-0 border-none !rounded-[50%] bg-[#cecece] opacity-100 [transition:all_0.3s_ease] cursor-pointer w-[20px] !rounded-[100px] bg-brand",
  },
};

const PROPS = {
  carousel: ["position"],
  carouselAfter: ["content", "position", "top", "right", "bottom", "width", "backgroundImage", "pointerEvents", "zIndex"],
  viewport: ["position", "width", "overflow", "overflowX", "overflowY", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "scrollbarWidth"],
  arrow: ["display", "position", "color", "width", "height", "borderTopWidth", "borderTopStyle", "backgroundColor", "cursor", "transitionProperty"],
  pagination: ["display", "position", "justifyContent", "gap", "marginTop"],
  bullet: ["display", "width", "height", "marginTop", "marginRight", "marginBottom", "marginLeft", "paddingTop", "borderTopWidth", "borderTopStyle", "borderTopLeftRadius", "backgroundColor", "opacity", "transitionProperty", "transitionDuration", "cursor"],
  active: ["display", "width", "height", "marginLeft", "borderTopLeftRadius", "backgroundColor"],
};

async function capture(variant, out) {
  const cls = CLASSES[variant];
  const browser = await chromium.launch();
  const result = {};
  for (const vw of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    const snap = await page.evaluate(({ cls, props }) => {
      const host = document.createElement("section");
      host.className = "bb-products-section bb-home-products-parity";
      host.style.position = "absolute"; host.style.left = "-9999px"; host.style.top = "0"; host.style.width = "1100px";
      host.innerHTML = `
        <div class="${cls.carousel}" data-k="carousel">
          <button type="button" class="${cls.arrow}" data-k="arrow"></button>
          <div class="${cls.viewport}" data-k="viewport"><div class="bb-fp-page-track"></div></div>
          <div class="${cls.pagination}" data-k="pagination">
            <button type="button" class="${cls.bullet}" data-k="bullet"></button>
            <button type="button" class="${cls.active}" data-k="active"></button>
          </div>
        </div>`;
      document.body.appendChild(host);
      const out = {};
      const measure = (el, plist, pseudo) => {
        const cs = getComputedStyle(el, pseudo || undefined);
        const r = {}; for (const p of plist) r[p] = cs[p]; return r;
      };
      const q = (k) => host.querySelector(`[data-k="${k}"]`);
      out.carousel = measure(q("carousel"), props.carousel);
      out.carouselAfter = measure(q("carousel"), props.carouselAfter, "::after");
      out.viewport = measure(q("viewport"), props.viewport);
      out.arrow = measure(q("arrow"), props.arrow);
      out.pagination = measure(q("pagination"), props.pagination);
      out.bullet = measure(q("bullet"), props.bullet);
      out.active = measure(q("active"), props.active);
      host.remove();
      return out;
    }, { cls, props: PROPS });
    result[vw] = snap;
    await ctx.close();
  }
  await browser.close();
  writeFileSync(out, JSON.stringify(result, null, 2));
  console.log("captured", variant, "->", out);
}

function diff(oldF, newF) {
  const a = JSON.parse(readFileSync(oldF, "utf8")), b = JSON.parse(readFileSync(newF, "utf8"));
  let m = 0;
  for (const vw of Object.keys(a)) for (const k of Object.keys(a[vw])) for (const p of Object.keys(a[vw][k])) {
    if (a[vw][k][p] !== b[vw][k][p]) { console.log(`[${vw}] ${k}.${p}: OLD="${a[vw][k][p]}" NEW="${b[vw][k][p]}"`); m++; }
  }
  console.log(m === 0 ? "*** 0 MISMATCH ***" : `*** ${m} MISMATCH(ES) ***`);
}

const [mode, a, b] = process.argv.slice(2);
if (mode === "capture") await capture(a, b);
else if (mode === "diff") diff(a, b);
else { console.log("usage: capture <old|new> <out> | diff <old> <new>"); process.exit(1); }
