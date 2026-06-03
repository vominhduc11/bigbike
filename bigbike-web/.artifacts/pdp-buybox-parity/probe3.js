// Verifies two novel pseudos the main probes couldn't reach:
//  (A) color swatch active ::after "✓" checkmark  (color product, in-stock)
//  (B) out-of-stock red badge via has-[.bb-pdp-stock-badge--out]:after:bg-brand
const { chromium } = require("playwright");
const COLOR_SLUG = "gang-tay-mo-to-ilm-thoang-khi-cho-nam-va-nu-jc08";
const OOS_SLUG = "mu-bao-hiem-ls2-ff327-challenger-carbon-fold"; // all variants OOS

async function colorState(page, base) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`${base}/product/${COLOR_SLUG}/`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector(".bb-wp-pdp-info-col .size input[type=radio]", { timeout: 20000 });
  await page.waitForTimeout(1200);
  const clicked = await page.evaluate(() => {
    // click first enabled COLOR radio (its label has empty text + bg swatch)
    const r = document.querySelector('.bb-wp-pdp-info-col .size input[type=radio]:not(:disabled)');
    if (!r) return false; r.click(); return true;
  });
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const checked = document.querySelector(".bb-wp-pdp-info-col .size input:checked");
    const label = checked ? checked.nextElementSibling : null;
    const out = { clicked: !!checked };
    if (label) {
      const a = getComputedStyle(label, "::after");
      out["after.content"] = a.content;
      out["after.color"] = a.color;
      out["after.position"] = a.position;
      out["after.lineHeight"] = a.lineHeight;
      out["after.textAlign"] = a.textAlign;
      out["label.position"] = getComputedStyle(label).position;
      out["label.color"] = getComputedStyle(label).color;
    } else out.label = "MISSING";
    return out;
  });
}

async function oosBadge(page, base) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`${base}/product/${OOS_SLUG}/`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector(".bb-wp-pdp-info-col", { timeout: 20000 });
  await page.waitForTimeout(1500);
  return page.evaluate(() => {
    const info = document.querySelector(".bb-wp-pdp-info-col");
    const kids = (el) => Array.from(el.children).filter((c) => c.tagName === "DIV");
    const summary = kids(info)[1];
    const statusCol = kids(summary)[1];
    const statusP = statusCol ? statusCol.querySelector("p") : null;
    const wrap = statusP ? statusP.querySelector("span") : null;
    const out = {};
    if (statusP) {
      const af = getComputedStyle(statusP, "::after");
      out["after.backgroundColor"] = af.backgroundColor;
      out["after.transform"] = af.transform;
      out["wrap.hasOutClass"] = wrap ? String(wrap.className.includes("bb-pdp-stock-badge--out") || wrap.matches('[class*="--out"]')) : "noWrap";
      out["label.text"] = statusP.textContent.trim();
    } else out.statusP = "MISSING";
    return out;
  });
}

(async () => {
  const browser = await chromium.launch();
  async function pair(fn, title) {
    const cO = await browser.newContext(); const cN = await browser.newContext();
    const o = await fn(await cO.newPage(), "http://localhost:3000");
    const n = await fn(await cN.newPage(), "http://localhost:3001");
    await cO.close(); await cN.close();
    const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])].sort();
    let diffs = 0;
    console.log(`\n===== ${title} =====`);
    for (const k of keys) {
      const m = o[k] !== n[k];
      if (m) diffs++;
      console.log(`  ${m ? "MISMATCH " : "ok       "}${k}: old=${JSON.stringify(o[k])} new=${JSON.stringify(n[k])}`);
    }
    console.log(`  -> ${diffs} mismatches`);
    return diffs;
  }
  let t = 0;
  t += await pair(colorState, "COLOR swatch active ::after ✓");
  t += await pair(oosBadge, "OUT-OF-STOCK red badge");
  await browser.close();
  console.log(`\nTOTAL mismatches: ${t}`);
})();
