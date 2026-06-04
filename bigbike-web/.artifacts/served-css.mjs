import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3019";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:360,height:740} })).newPage();
await p.goto(BASE, { waitUntil: "networkidle" });
const rules = await p.evaluate(() => {
  const out = [];
  for (const ss of document.styleSheets) {
    let r; try { r = ss.cssRules; } catch { continue; }
    const walk = (rulesList) => {
      for (const rule of rulesList) {
        if (rule.cssRules) { walk(rule.cssRules); }
        const t = rule.cssText || "";
        if (t.includes("bb-mobile-header-drawer") && !t.includes("scrollbar")) out.push(t.slice(0, 220));
      }
    };
    walk(r);
  }
  return out;
});
console.log(rules.join("\n----\n"));
await b.close();
