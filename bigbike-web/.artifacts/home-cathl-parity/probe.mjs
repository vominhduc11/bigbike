// Home Category-highlights (.category-list) A/B probe: computed-style parity.
//   node probe.mjs capture <out.json>   (vs http://localhost:3001/)
//   node probe.mjs diff <old.json> <new.json>
// NEW drops .item/.item--* classes -> anchor STRUCTURALLY:
//   wrapper = .category-list
//   col = .category-list .col-md-4  (KEPT WP-grid)
//   item = col > div (first child)
//   item.children = [thumbnail div, category <a> (hidden), h3 title, btn <a>]
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3001";
// Edges: 390/767 mobile [Fix1], 768 base start, 1280 base, 1920 (h360), 2560 (h480).
const VPS = [390, 767, 768, 1280, 1920, 2560];

async function capture(out) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const data = {};
  for (const vp of VPS) {
    await page.setViewportSize({ width: vp, height: 1000 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".category-list .col-md-4", { timeout: 30000 });
    await page.evaluate(() => document.querySelector(".category-list")?.scrollIntoView());
    await page.waitForTimeout(300);
    data[vp] = await page.evaluate(() => {
      const PICK = (el, props) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = cs[p];
        return o;
      };
      const wrap = document.querySelector(".category-list");
      const cols = wrap ? [...wrap.querySelectorAll(".col-md-4")] : [];
      const firstItem = cols[0] ? cols[0].querySelector(":scope > div") : null;
      const lastItem = cols.length ? cols[cols.length - 1].querySelector(":scope > div") : null;
      const ch = firstItem ? [...firstItem.children] : [];
      const thumb = ch[0] || null;
      const thumbImg = thumb ? thumb.querySelector("img") : null;
      const catA = ch.find((c) => c.tagName === "A") || null; // first <a> = category (hidden)
      const h3 = firstItem ? firstItem.querySelector("h3") : null;
      const titleA = h3 ? h3.querySelector("a") : null;
      const aTags = ch.filter((c) => c.tagName === "A");
      const btn = aTags.length ? aTags[aTags.length - 1] : null; // last <a> = btn
      const btnI = btn ? btn.querySelector("i") : null;
      return {
        wrap: PICK(wrap, ["paddingTop", "paddingBottom", "paddingLeft", "paddingRight"]),
        item: PICK(firstItem, ["position", "height", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "borderTopWidth", "borderTopStyle", "borderTopColor", "backgroundColor", "textTransform", "marginBottom"]),
        lastItemMb: PICK(lastItem, ["marginBottom"]),
        thumb: PICK(thumb, ["position", "right", "bottom"]),
        thumbImg: PICK(thumbImg, ["maxHeight"]),
        catA: PICK(catA, ["display"]),
        title: PICK(h3, ["marginTop", "marginBottom", "maxWidth", "fontFamily", "fontSize", "fontWeight", "lineHeight", "webkitLineClamp", "display", "overflow", "textTransform"]),
        titleA: PICK(titleA, ["color"]),
        btn: PICK(btn, ["color", "fontFamily", "fontSize", "fontWeight", "textTransform"]),
        btnI: PICK(btnI, ["marginLeft"]),
      };
    });
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
