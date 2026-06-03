import { chromium } from "playwright";
import fs from "node:fs";

const PORT = process.env.PORT || "3009";
const OUT = process.env.OUT || "old.json";
const BASE = `http://localhost:${PORT}`;

const WIDTHS = [360, 390, 430, 500, 501, 600, 767, 768, 1024, 1280, 1536, 1920];
const SCROLLS = ["top", "scrolled"];

const LOGO_PROPS = [
  "display", "alignItems", "justifyContent", "paddingTop", "paddingRight",
  "paddingLeft", "position", "top", "left", "width", "height", "transform",
  "zIndex", "overflow", "pointerEvents",
];
const IMG_PROPS = [
  "display", "visibility", "opacity", "width", "maxWidth", "height",
  "maxHeight", "position", "top", "left", "transform", "filter",
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector(".bb-logo .hide-desktop", { state: "attached", timeout: 20000 });
// kill all transitions/animations so scroll-swap opacity/visibility is deterministic
await page.addStyleTag({
  content: "*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important;transition-delay:0s!important}",
});

const result = {};
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  for (const sc of SCROLLS) {
    const data = await page.evaluate(
      ({ LOGO_PROPS, IMG_PROPS, scrolled }) => {
        if (scrolled) document.documentElement.setAttribute("data-header-scrolled", "");
        else document.documentElement.removeAttribute("data-header-scrolled");
        const k2k = (s) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
        const pickEl = (el, props) => {
          if (!el) return null;
          const cs = getComputedStyle(el);
          const o = {};
          for (const p of props) o[p] = cs.getPropertyValue(k2k(p));
          return o;
        };
        return {
          logo: pickEl(document.querySelector(".bb-logo"), LOGO_PROPS),
          hideMobile: pickEl(document.querySelector(".bb-logo .hide-mobile"), IMG_PROPS),
          hideDesktop: pickEl(document.querySelector(".bb-logo .hide-desktop"), IMG_PROPS),
        };
      },
      { LOGO_PROPS, IMG_PROPS, scrolled: sc === "scrolled" },
    );
    result[`${w}|${sc}`] = data;
  }
}

await browser.close();
fs.writeFileSync(`.artifacts/logo-parity/${OUT}`, JSON.stringify(result, null, 2));
console.log("wrote", OUT, "keys:", Object.keys(result).length);
