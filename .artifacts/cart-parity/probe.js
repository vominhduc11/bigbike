const { chromium } = require("playwright");
const fs = require("fs");

const OLD = "http://localhost:3000";
const NEW = "http://localhost:3001";
const API = "http://localhost:8080";
const OUT = ".artifacts/cart-parity";
const LOGIN = { login: "duc237022@gmail.com", password: "12345678", remember: true };
const PROD = "wp-prod-6093";
const VARIANTS = ["wp-var-6094", "wp-var-6095"];
const WIDTHS = [1280, 700, 390];

async function seed(page) {
  await page.goto(NEW + "/", { waitUntil: "networkidle" });
  return page.evaluate(async ({ API, LOGIN, PROD, VARIANTS }) => {
    const ck = (n) => { const m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : null; };
    const api = async (method, path, body) => {
      const csrf = ck("bb_csrf");
      const r = await fetch(API + path, { method, headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}) }, credentials: "include", body: body ? JSON.stringify(body) : undefined });
      return r.status;
    };
    const login = await api("POST", "/api/v1/customer/auth/login", LOGIN);
    const clear = await api("DELETE", "/api/v1/cart/clear");
    const adds = [];
    for (const v of VARIANTS) adds.push(await api("POST", "/api/v1/cart/items", { productId: PROD, productVariantId: v, quantity: 2 }));
    return { login, clear, adds };
  }, { API, LOGIN, PROD, VARIANTS });
}

const PROBE = () => {
  const out = {};
  const g = (el, ps, pseudo) => {
    if (!el) return "MISSING";
    const cs = getComputedStyle(el, pseudo || null);
    return ps.map((p) => `${p}=${cs[p]}`).join("; ");
  };
  const W = (el) => (el ? Math.round(el.getBoundingClientRect().width) : "MISSING");
  const form = document.querySelector("#main-content form");
  if (!form) return { error: "no form" };
  const row = form.querySelector(":scope > div");
  const main = row.children[0];
  const side = row.children[1];
  const item = form.querySelector('[role="listitem"]');

  out.row = g(row, ["display", "flexWrap", "alignItems", "marginLeft"]);
  out.mainW = W(main); out.sideW = W(side);
  out.main = g(main, ["display", "flexBasis", "maxWidth", "position", "paddingLeft"]);
  out.side = g(side, ["flexBasis", "maxWidth", "marginTop"]);

  const availWrap = main.children[0];
  out.availWrap = g(availWrap, ["marginBottom", "fontSize"]);
  const availH3 = availWrap.querySelector("h3");
  out.availH3 = g(availH3, ["fontFamily", "fontSize", "fontWeight", "color", "paddingRight", "lineHeight", "display"]);
  const badge = availH3.querySelector("span");
  out.badge = g(badge, ["position", "width", "height", "fontSize", "textAlign", "transform"]);
  out.badgeAfter = g(badge, ["width", "height", "borderRadius", "backgroundColor", "boxShadow", "transform"], "::after");
  out.badgeB = g(badge.querySelector("b"), ["zIndex", "color", "paddingTop", "lineHeight", "verticalAlign"]);

  out.item = g(item, ["display", "flexWrap", "alignItems", "padding", "paddingTop", "borderBottomWidth", "borderBottomColor", "gridTemplateColumns", "marginBottom", "borderTopWidth"]);
  const thumbCell = item.children[0];
  out.thumbCell = g(thumbCell, ["flexBasis", "maxWidth", "minWidth", "padding"]);
  const thumb = thumbCell.querySelector("div") || thumbCell.firstElementChild;
  out.thumb = g(thumb, ["width", "minHeight", "display", "alignItems", "justifyContent", "maxWidth"]);
  const infoCell = item.children[1];
  out.infoCell = g(infoCell, ["flexBasis", "paddingLeft"]);
  out.infoH3 = g(infoCell.querySelector("h3"), ["fontFamily", "fontSize", "fontWeight", "color", "lineHeight", "marginBottom"]);
  out.infoP = g(infoCell.querySelectorAll("p")[infoCell.querySelectorAll("p").length - 1], ["margin", "color"]);
  const plus = item.querySelector('button[aria-label^="Tăng"]');
  out.plus = g(plus, ["display", "width", "height", "color", "fontSize", "lineHeight", "verticalAlign", "minWidth", "minHeight", "backgroundColor"]);
  const qInput = item.querySelector('input[type="number"]');
  out.qInput = g(qInput, ["display", "width", "height", "fontSize", "fontWeight", "textAlign", "color", "minHeight", "borderWidth"]);
  const remove = item.querySelector('button[aria-label="Xóa sản phẩm"]');
  out.remove = g(remove, ["display", "width", "height", "color", "alignItems", "justifyContent", "minWidth", "minHeight"]);

  const updateBtn = main.querySelector('button[name="update_cart"]');
  out.updateRow = g(updateBtn.closest("div"), ["marginBottom", "textAlign"]);
  out.updateBtn = g(updateBtn, ["minWidth", "height", "backgroundColor", "color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "paddingLeft", "borderWidth"]);
  const actionRow = updateBtn.closest("div").nextElementSibling;
  out.actionRow = g(actionRow, ["display", "alignItems", "justifyContent", "gap", "flexDirection"]);
  const links = actionRow.querySelectorAll("a, span");
  out.continueLink = g(links[0], ["display", "height", "backgroundColor", "color", "fontFamily", "fontWeight", "textTransform", "lineHeight", "paddingLeft", "paddingRight", "borderRadius"]);
  out.submitLink = g(links[1], ["display", "minWidth", "height", "backgroundColor", "color", "textAlign", "lineHeight", "borderWidth", "borderColor", "borderStyle"]);

  const cartTotals = side.children[0].children[0];
  out.h2 = g(cartTotals.querySelector("h2"), ["fontFamily", "fontSize", "fontWeight", "color", "lineHeight", "marginBottom"]);
  const sumItems = cartTotals.querySelector("div");
  out.sumItems = g(sumItems, ["display", "flexWrap", "justifyContent", "gap", "marginBottom"]);
  const shipBlock = [...cartTotals.children].find((c) => c.querySelector("p") && /vận chuyển|Phí/.test(c.textContent));
  out.shipP = g(shipBlock ? shipBlock.querySelector("p") : null, ["margin", "color", "fontSize", "fontStyle", "lineHeight"]);
  const proceed = [...side.querySelectorAll("a, span")].find((e) => /Tiến hành/.test(e.textContent));
  out.proceed = g(proceed, ["display", "width", "minHeight", "padding", "backgroundColor", "color", "fontFamily", "fontSize", "fontWeight", "lineHeight", "textAlign", "borderRadius"]);

  const promoForm = side.querySelector("fieldset") ? side.querySelector("fieldset").closest("div").parentElement : null;
  out.promoForm = g(promoForm, ["padding", "borderWidth", "borderColor"]);
  out.legend = g(side.querySelector("legend"), ["marginBottom", "color", "fontSize", "fontWeight"]);
  out.couponInput = g(document.querySelector("#coupon_code"), ["width", "height", "borderWidth", "borderColor", "color", "paddingLeft"]);
  out.applyBtn = g(document.querySelector('button[name="apply_coupon"]'), ["position", "width", "height", "backgroundColor", "color", "fontSize", "fontWeight"]);

  const totalSummary = side.children[2];
  out.totalSummary = g(totalSummary, ["marginTop", "padding", "borderTopWidth", "borderTopColor", "borderBottomWidth"]);
  const totalPrice = totalSummary.querySelector("strong").parentElement;
  out.totalPrice = g(totalPrice, ["margin", "color", "fontSize"]);
  out.totalSumItems = g(totalSummary.querySelector("div"), ["display", "justifyContent", "gap", "marginBottom"]);
  return out;
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const s = await seed(page);
  console.log("SEED:", JSON.stringify(s));

  const results = {};
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 1000 });
    for (const [label, origin] of [["old", OLD], ["new", NEW]]) {
      await page.goto(origin + "/gio-hang/", { waitUntil: "networkidle" });
      await page.waitForSelector('input[type="number"]', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(400);
      const data = await page.evaluate(PROBE);
      results[`${w}_${label}`] = data;
      await page.screenshot({ path: `${OUT}/cart-${w}-${label}.png`, fullPage: true });
    }
  }
  fs.writeFileSync(`${OUT}/probe-result.json`, JSON.stringify(results, null, 2));

  // diff
  let mism = 0;
  for (const w of WIDTHS) {
    const o = results[`${w}_old`], n = results[`${w}_new`];
    if (!o || o.error) { console.log(`[${w}] OLD error: ${JSON.stringify(o)}`); continue; }
    if (!n || n.error) { console.log(`[${w}] NEW error: ${JSON.stringify(n)}`); continue; }
    for (const k of Object.keys(o)) {
      if (JSON.stringify(o[k]) !== JSON.stringify(n[k])) {
        mism++;
        console.log(`\n[${w}] DIFF @ ${k}\n  OLD: ${o[k]}\n  NEW: ${n[k]}`);
      }
    }
  }
  console.log(`\n=== ${mism} mismatches across ${WIDTHS.length} widths ===`);
  await browser.close();
})();
