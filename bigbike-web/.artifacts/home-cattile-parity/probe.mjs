// Home Category-tile (.bb-cat-list, WpCategoryListItem) A/B probe.
//   node probe.mjs capture <out.json>   (vs http://localhost:3001/)
//   node probe.mjs diff <old.json> <new.json>
// Desktop-only (hidden md:block parent) -> probe >=768 only.
// NEW drops bb-cat-list/-item/-img/-desc classes -> anchor STRUCTURALLY:
//   grid = a display:grid div inside .bb-home-products-parity whose children
//          are all <a> each containing an <img> (the category tiles).
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3001";
const VPS = [768, 1024, 1280, 1536, 1920, 2560];

const FIND = () => {
  const section = document.querySelector(".bb-home-products-parity");
  let grid = null;
  if (section) {
    for (const el of section.querySelectorAll("div")) {
      const cs = getComputedStyle(el);
      if (cs.display === "grid" && el.getClientRects().length > 0 && el.children.length &&
          [...el.children].every((c) => c.tagName === "A" && c.querySelector("img"))) {
        grid = el; break;
      }
    }
  }
  return grid;
};

async function capture(out) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const data = {};
  for (const vp of VPS) {
    await page.setViewportSize({ width: vp, height: 1000 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(FIND, { timeout: 30000 });
    await page.evaluate(() => document.querySelector(".bb-home-products-parity")?.scrollIntoView());
    await page.waitForTimeout(300);
    data[vp] = await page.evaluate((findSrc) => {
      const FIND = new Function("return (" + findSrc + ")()");
      const PICK = (el, props, pseudo) => {
        if (!el) return null;
        const cs = getComputedStyle(el, pseudo || undefined);
        const o = {};
        for (const p of props) o[p] = cs[p];
        return o;
      };
      const grid = FIND();
      const items = grid ? [...grid.children] : [];
      const item = items[0] || null;
      const img = item ? item.querySelector("img") : null;
      const imgSpan = img ? img.parentElement : null;
      const desc = item ? [...item.children].find((c) => c.tagName === "SPAN" && c !== imgSpan) : null;
      return {
        grid: PICK(grid, ["display", "gridTemplateColumns", "columnGap", "rowGap", "borderTopWidth", "borderTopStyle", "borderTopColor", "borderLeftColor", "marginTop", "marginBottom"]),
        item: PICK(item, ["position", "display", "flexDirection", "alignItems", "justifyContent", "height", "paddingTop", "paddingLeft", "backgroundColor", "borderRightColor", "borderBottomColor", "textAlign", "overflow"]),
        before: PICK(item, ["content", "position", "top", "left", "backgroundImage", "backgroundSize", "backgroundRepeat", "opacity"], "::before"),
        imgSpan: PICK(imgSpan, ["position", "zIndex", "display", "alignItems", "justifyContent", "width", "height", "pointerEvents"]),
        img: PICK(img, ["display", "width", "height", "objectFit"]),
        desc: PICK(desc, ["position", "zIndex", "display", "webkitLineClamp", "overflow", "marginTop", "fontFamily", "fontWeight", "fontSize", "lineHeight", "letterSpacing", "textTransform", "color"]),
      };
    }, "" + FIND);
  }
  // Hover check @1280: ::before opacity->1, img filter+transform, desc color->white.
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(FIND, { timeout: 30000 });
  await page.evaluate(() => document.querySelector(".bb-home-products-parity")?.scrollIntoView());
  await page.waitForTimeout(300);
  const itemBox = await page.evaluate((findSrc) => {
    const FIND = new Function("return (" + findSrc + ")()");
    const g = FIND();
    const it = g && g.children[0];
    if (!it) return null;
    const r = it.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, "" + FIND);
  if (itemBox) {
    await page.mouse.move(itemBox.x, itemBox.y);
    await page.waitForTimeout(400);
    data.hover = await page.evaluate((findSrc) => {
      const FIND = new Function("return (" + findSrc + ")()");
      const PICK = (el, props, pseudo) => {
        if (!el) return null;
        const cs = getComputedStyle(el, pseudo || undefined);
        const o = {};
        for (const p of props) o[p] = cs[p];
        return o;
      };
      const grid = FIND();
      const item = grid.children[0];
      const img = item.querySelector("img");
      const imgSpan = img.parentElement;
      const desc = [...item.children].find((c) => c.tagName === "SPAN" && c !== imgSpan);
      return {
        beforeOpacity: PICK(item, ["opacity"], "::before"),
        img: PICK(img, ["filter", "transform"]),
        desc: PICK(desc, ["color"]),
      };
    }, "" + FIND);
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(data, null, 2));
  console.log("wrote", out);
}

function diff(a, b) {
  const A = JSON.parse(fs.readFileSync(a, "utf8"));
  const B = JSON.parse(fs.readFileSync(b, "utf8"));
  let n = 0;
  for (const vp of Object.keys(A)) {
    for (const grp of Object.keys(A[vp])) {
      const oa = A[vp][grp], ob = B[vp][grp];
      if (oa == null && ob == null) continue;
      if (oa == null || ob == null) { console.log(`MISMATCH @${vp} ${grp}: ${JSON.stringify(oa)} != ${JSON.stringify(ob)}`); n++; continue; }
      for (const k of Object.keys(oa)) {
        if (oa[k] !== ob[k]) { console.log(`MISMATCH @${vp} ${grp}.${k}: "${oa[k]}" != "${ob[k]}"`); n++; }
      }
    }
  }
  console.log(n === 0 ? "OK 0 mismatches" : `${n} mismatches`);
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === "capture") await capture(rest[0]);
else if (mode === "diff") diff(rest[0], rest[1]);
else console.log("usage: capture <out> | diff <old> <new>");
