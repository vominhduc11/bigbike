const { chromium } = require("playwright");
const fs = require("fs");
const OUT = ".artifacts/checkout-parity";
const OLD = "http://localhost:3000", NEW = "http://localhost:3001";
const WIDTHS = [1280, 700, 390];
const seed = async (p, base) => {
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await p.evaluate(async () => {
    const ck = n => { const m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : null; };
    const api = (me, pa, bo) => fetch("http://localhost:8080" + pa, { method: me, headers: { "Content-Type": "application/json", "X-CSRF-Token": ck("bb_csrf") || "" }, credentials: "include", body: bo ? JSON.stringify(bo) : undefined }).then(r => r.status);
    await api("POST", "/api/v1/customer/auth/login", { login: "duc237022@gmail.com", password: "12345678", remember: true });
    await api("DELETE", "/api/v1/cart/clear");
    await api("POST", "/api/v1/cart/items", { productId: "wp-prod-6093", productVariantId: "wp-var-6094", quantity: 2 });
  });
};
const PROBE = () => {
  const out = {};
  const g = (el, ps) => { if (!el) return "MISSING"; const c = getComputedStyle(el); return ps.map(p => p + "=" + c[p]).join("; "); };
  const W = el => el ? Math.round(el.getBoundingClientRect().width) : "M";
  const form = document.querySelector("form.checkout");
  if (!form) return { error: "no form" };
  const row = form.children[1];
  const main = row.children[0], side = row.children[1];
  out.row = g(row, ["display", "gridTemplateColumns", "gap"]);
  out.mainW = W(main); out.sideW = W(side);
  out.main = g(main, ["minWidth"]);
  out.side = g(side, ["minWidth", "marginTop"]);
  out.title = g(document.querySelector(".check-out-title"), ["paddingLeft", "marginBottom", "paddingBottom", "borderBottomWidth", "borderBottomColor"]);
  out.titleH1 = g(document.querySelector(".check-out-title h1"), ["fontFamily", "fontSize", "fontWeight", "lineHeight", "textTransform", "color"]);
  const bill = main.querySelector("section");
  out.step = g(bill, ["borderWidth", "borderColor", "backgroundColor", "padding", "marginBottom"]);
  const stepTitle = bill.children[0];
  out.stepTitle = g(stepTitle, ["marginBottom"]);
  const h2 = stepTitle.querySelector("h2");
  out.stepH2 = g(h2, ["display", "alignItems", "gap", "margin", "fontFamily", "fontSize", "fontWeight", "lineHeight", "textTransform"]);
  out.stepSpan = g(h2.querySelector("span"), ["display", "width", "height", "flexBasis", "alignItems", "justifyContent", "backgroundColor", "color", "fontFamily"]);
  out.fieldsGrid = g(bill.children[1], ["display", "gridTemplateColumns", "gap"]);
  out.formGroup = g(bill.querySelector("#billing_full_name").closest("div"), ["margin", "minWidth"]);
  out.label = g(document.querySelector('label[for="billing_full_name"]'), ["fontSize", "lineHeight", "color"]);
  out.formControl = g(document.querySelector("#billing_full_name"), ["minHeight", "width", "height", "borderColor", "fontSize", "padding"]);
  out.orderComments = g(document.querySelector("#order_comments").closest("div"), ["marginTop", "margin"]);
  const ship = main.querySelectorAll("section")[1];
  const methodBlock = ship.children[1];
  out.methodBlock = g(methodBlock, ["display", "marginTop", "borderTopWidth", "borderTopColor", "paddingTop", "gap", "gridTemplateColumns"]);
  out.methodH3 = g(methodBlock.querySelector("h3"), ["margin", "fontFamily", "fontSize", "fontWeight", "textTransform", "lineHeight"]);
  const radioRow = document.querySelector('label[for^="shipping_method_"]');
  out.radioRow = g(radioRow, ["display", "minHeight", "alignItems", "gap", "borderWidth", "borderColor", "backgroundColor", "padding"]);
  const rspans = radioRow ? radioRow.querySelectorAll("span") : [];
  out.radioLabel = g(rspans[0], ["minWidth", "flexGrow", "fontWeight"]);
  out.radioPrice = g(rspans[1], ["color", "fontFamily", "fontWeight", "whiteSpace"]);
  const pay = document.querySelector("#payment");
  out.payment = g(pay, ["marginTop", "borderTopWidth", "borderTopColor", "paddingTop"]);
  out.payList = g(pay.querySelector("ul"), ["display", "gap", "margin", "padding", "listStyleType"]);
  out.payLabel = g(document.querySelector('label[for^="payment_method_"]'), ["display", "minHeight", "alignItems", "gap", "borderWidth", "padding"]);
  const submit = document.querySelector('button[type="submit"]');
  out.placeOrder = g(submit.parentElement, ["marginTop"]);
  out.submitBtn = g(submit, ["width", "minHeight", "fontFamily", "fontSize", "fontWeight", "letterSpacing", "textTransform", "backgroundColor", "color"]);
  out.summaryCard = g(side.children[0], ["borderWidth", "borderColor", "backgroundColor", "padding"]);
  out.summaryTitle = g(side.querySelector("h3"), ["margin", "fontFamily", "fontSize", "fontWeight", "lineHeight", "textTransform"]);
  out.reviewOrder = g(document.querySelector("#order_review"), ["overflowX"]);
  out.shopTable = g(document.querySelector("#order_review table"), ["minWidth", "borderCollapse"]);
  const cards = document.querySelectorAll("#order_review > div");
  out.totalCard = g(cards[0], ["marginTop", "borderWidth", "borderColor", "backgroundColor", "padding"]);
  out.payCard = g(cards[1], ["marginTop", "borderWidth", "borderColor", "backgroundColor", "padding"]);
  return out;
};
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  await seed(p, NEW);
  const results = {};
  for (const w of WIDTHS) {
    await p.setViewportSize({ width: w, height: 1100 });
    for (const [label, origin] of [["old", OLD], ["new", NEW]]) {
      await p.goto(origin + "/thanh-toan/", { waitUntil: "networkidle" });
      await p.waitForSelector("form.checkout", { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(600);
      results[`${w}_${label}`] = await p.evaluate(PROBE);
      await p.screenshot({ path: `${OUT}/co-${w}-${label}.png`, fullPage: true });
    }
  }
  fs.writeFileSync(`${OUT}/probe-result.json`, JSON.stringify(results, null, 2));
  let mism = 0;
  for (const w of WIDTHS) {
    const o = results[`${w}_old`], n = results[`${w}_new`];
    if (!o || o.error) { console.log(`[${w}] OLD: ${JSON.stringify(o)}`); continue; }
    if (!n || n.error) { console.log(`[${w}] NEW: ${JSON.stringify(n)}`); continue; }
    for (const k of Object.keys(o)) if (JSON.stringify(o[k]) !== JSON.stringify(n[k])) { mism++; console.log(`\n[${w}] DIFF @ ${k}\n  OLD: ${o[k]}\n  NEW: ${n[k]}`); }
  }
  console.log(`\n=== ${mism} mismatches across ${WIDTHS.join("/")} ===`);
  await b.close();
})();
