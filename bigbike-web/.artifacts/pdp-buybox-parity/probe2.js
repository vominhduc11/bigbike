// Interaction probe: selects the first available variant, then compares the
// ACTIVE swatch + ENABLED add-to-cart button (states the static probe can't reach
// because the button starts disabled until a variant is picked).
const { chromium } = require("playwright");
const SLUG = "mu-bao-hiem-ls2-ff327-challenger-carbon";
const PATH = `/product/${SLUG}/`;

function collect() {
  const out = {};
  const info = document.querySelector(".bb-wp-pdp-info-col");
  const sizeDiv = info.querySelector(".size");
  const swatch = sizeDiv ? sizeDiv.querySelector("input:checked + label, label[for]") : null;
  // prefer the checked one's label
  const checked = sizeDiv ? sizeDiv.querySelector("input:checked") : null;
  const activeLabel = checked ? checked.nextElementSibling : swatch;
  const activeGroup = checked ? checked.parentElement : null;
  const addBtn = info.querySelector(".js-add-to-cart-btn");
  const grab = (label, el, props, pseudo) => {
    if (!el) { out[`${label}|__present`] = "MISSING"; return; }
    const cs = getComputedStyle(el, pseudo || undefined);
    for (const p of props) out[`${label}|${pseudo ? pseudo + " " : ""}${p}`] = cs[p];
  };
  grab("activeSwatch", activeLabel, ["backgroundColor", "color", "borderTopColor", "width", "height"]);
  grab("activeSwatch", activeLabel, ["content", "color", "lineHeight", "textAlign", "position"], "::after");
  grab("activeGroup", activeGroup, ["cursor", "opacity"]);
  grab("addBtnEnabled", addBtn, ["backgroundColor", "color", "opacity", "cursor", "borderTopLeftRadius"]);
  out["addBtn|disabledAttr"] = addBtn ? String(addBtn.disabled) : "MISSING";
  return out;
}

async function run(page, base) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(base + PATH, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector(".bb-wp-pdp-info-col .size input[type=radio]", { timeout: 20000 });
  await page.waitForTimeout(1000);
  // click first enabled radio
  const clicked = await page.evaluate(() => {
    const r = document.querySelector('.bb-wp-pdp-info-col .size input[type=radio]:not(:disabled)');
    if (!r) return false;
    r.click();
    return true;
  });
  await page.waitForTimeout(1000);
  const data = await page.evaluate(collect);
  data.__clicked = clicked;
  return data;
}

(async () => {
  const browser = await chromium.launch();
  const ctxO = await browser.newContext(); const ctxN = await browser.newContext();
  const o = await run(await ctxO.newPage(), "http://localhost:3000");
  const n = await run(await ctxN.newPage(), "http://localhost:3001");
  await browser.close();
  const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])].sort();
  let diffs = 0;
  console.log("clicked old/new:", o.__clicked, n.__clicked);
  console.log("addBtn disabled old/new:", o["addBtn|disabledAttr"], n["addBtn|disabledAttr"]);
  for (const k of keys) {
    if (o[k] !== n[k]) { diffs++; console.log(`  MISMATCH ${k}\n    OLD: ${o[k]}\n    NEW: ${n[k]}`); }
  }
  console.log("\nkeys:", keys.length, "mismatches:", diffs);
  // dump a few key values for sanity
  for (const k of ["activeSwatch|backgroundColor", "activeSwatch|color", "addBtnEnabled|backgroundColor", "addBtnEnabled|opacity"]) {
    console.log(`  [${k}] old=${o[k]} new=${n[k]}`);
  }
})();
