const { chromium } = require("playwright");
const fs = require("fs");
const OUT = ".artifacts/account-parity";
const OLD = "http://localhost:3000", NEW = "http://localhost:3001";
const WIDTHS = [1280, 800, 390];
const login = async (p, base) => {
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await p.evaluate(async () => {
    const ck = n => { const m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : null; };
    await fetch("http://localhost:8080/api/v1/customer/auth/login", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": ck("bb_csrf") || "" }, credentials: "include", body: JSON.stringify({ login: "duc237022@gmail.com", password: "12345678", remember: true }) });
  });
};
const PROBE = () => {
  const out = {};
  const g = (el, ps) => { if (!el) return "MISSING"; const c = getComputedStyle(el); return ps.map(p => p + "=" + c[p]).join("; "); };
  const layout = document.querySelector(".bb-account-layout");
  if (!layout) return { error: "no layout" };
  const aside = layout.querySelector("aside");
  const main = [...layout.children].find(c => c.tagName !== "ASIDE");
  out.layout = g(layout, ["display", "gridTemplateColumns", "gap"]);
  out.sidebar = g(aside, ["position", "alignSelf", "top"]);
  const userCard = aside.children[0];
  out.userCard = g(userCard, ["display", "alignItems", "gap", "backgroundColor", "borderColor", "borderWidth", "padding", "marginBottom"]);
  out.avatar = g(aside.querySelector(".bb-account-avatar"), ["width", "height", "borderRadius", "backgroundColor", "color", "borderColor"]);
  const info = userCard.children[1];
  out.info = g(info, ["flexGrow", "minWidth"]);
  out.infoB = g(info.querySelector("b"), ["display", "fontFamily", "fontSize", "fontWeight", "textTransform", "letterSpacing", "color", "lineHeight", "whiteSpace", "textOverflow"]);
  out.infoSpan = g(info.querySelector("span"), ["display", "fontSize", "color", "marginTop", "whiteSpace"]);
  const navEl = aside.querySelector("nav");
  out.nav = g(navEl, ["display", "backgroundColor", "borderWidth", "padding", "overflowX"]);
  const navA = navEl.querySelector("a");
  out.navA = g(navA, ["display", "alignItems", "gap", "width", "padding", "fontFamily", "fontSize", "color", "borderBottomWidth", "borderBottomColor"]);
  out.navActive = g(navEl.querySelector('a[href="/tai-khoan/don-hang/"]'), ["color", "fontWeight"]);
  const navABefore = navA ? getComputedStyle(navA, "::before") : null;
  out.navABefore = navABefore ? `w=${navABefore.width}; h=${navABefore.height}; bg=${navABefore.backgroundColor}; opacity=${navABefore.opacity}; clip=${navABefore.clipPath}` : "M";
  out.main = g(main, ["minWidth"]);
  const h1 = main.querySelector("h1, h2");
  out.headerWrap = g(h1 ? h1.parentElement : null, ["display", "justifyContent", "alignItems", "marginBottom", "paddingBottom", "borderBottomWidth", "borderBottomColor"]);
  out.h1 = g(h1, ["display", "alignItems", "gap", "fontFamily", "fontSize", "fontWeight", "textTransform", "letterSpacing", "color", "margin"]);
  if (h1) { const cb = getComputedStyle(h1, "::before"); out.h1Before = `width=${cb.width}; height=${cb.height}; borderLeftWidth=${cb.borderLeftWidth}; borderLeftColor=${cb.borderLeftColor}; borderTopColor=${cb.borderTopColor}`; }
  return out;
};
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  await login(p, NEW);
  const results = {};
  for (const w of WIDTHS) {
    await p.setViewportSize({ width: w, height: 1100 });
    for (const [label, origin] of [["old", OLD], ["new", NEW]]) {
      await p.goto(origin + "/tai-khoan/don-hang/", { waitUntil: "networkidle" });
      await p.waitForSelector(".bb-account-layout", { timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(700);
      results[`${w}_${label}`] = await p.evaluate(PROBE);
      await p.screenshot({ path: `${OUT}/acct-${w}-${label}.png`, fullPage: true });
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
