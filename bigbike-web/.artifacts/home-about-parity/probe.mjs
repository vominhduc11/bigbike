// Home About-section (.about-bigbike) A/B probe: computed-style parity old vs new.
//   node probe.mjs capture <out.json>   (vs http://localhost:3001/)
//   node probe.mjs diff <old.json> <new.json>
// Structural anchors (NEW drops the .block-title class -> anchor by DOM position):
//   wrapper = .about-bigbike
//   titleBlock = .about-bigbike .container > div:first-child  (kicker+h2 wrapper)
//   h2 = .about-bigbike h2
//   content = .about-bigbike .block-content   (class kept as richtext marker)
//   contentP = first <p> inside .block-content (RICHTEXT - must stay identical)
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3001";
// Edges: 390 mobile (<=767 pt/mb override), 767/768 mobile<->desktop boundary,
// 1280 desktop, 1536/1920/2560 (title clamp is vw-continuous; confirm old==new).
const VPS = [390, 767, 768, 1280, 1536, 1920, 2560];

async function capture(out) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const data = {};
  for (const vp of VPS) {
    await page.setViewportSize({ width: vp, height: 1000 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".about-bigbike", { timeout: 30000 });
    await page.evaluate(() => document.querySelector(".about-bigbike")?.scrollIntoView());
    await page.waitForTimeout(300);
    data[vp] = await page.evaluate(() => {
      const PICK = (el, props) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = cs[p];
        return o;
      };
      const wrap = document.querySelector(".about-bigbike");
      const container = wrap ? wrap.querySelector(".container") : null;
      const titleBlock = container ? container.querySelector(":scope > div") : null;
      const h2 = wrap ? wrap.querySelector("h2") : null;
      const content = wrap ? wrap.querySelector(".block-content") : null;
      const contentP = content ? content.querySelector("p") : null;
      const BOX = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"];
      const TXT = ["margin", "color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textTransform", "textAlign"];
      return {
        wrap: PICK(wrap, [...BOX]),
        titleBlock: PICK(titleBlock, ["marginBottom", "textAlign"]),
        h2: PICK(h2, TXT),
        content: PICK(content, ["maxWidth", "marginLeft", "marginRight", "textAlign"]),
        contentP: PICK(contentP, ["margin", "color", "fontSize", "lineHeight"]),
        h2text: h2 ? h2.textContent.trim().slice(0, 40) : null,
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
      if (typeof oa === "string") { if (oa !== ob) { console.log(`MISMATCH @${vp} ${grp}: "${oa}" != "${ob}"`); n++; } continue; }
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
