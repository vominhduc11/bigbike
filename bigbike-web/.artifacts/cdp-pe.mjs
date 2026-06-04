import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3019";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
await p.goto(BASE, { waitUntil: "networkidle" });
await p.evaluate(() => document.querySelector(".bb-menu-toggle")?.click());
await p.waitForSelector(".bb-mobile-header-panel.is-open");
await p.waitForTimeout(600);
const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: ".bb-mobile-header-drawer" });
const matched = await cdp.send("CSS.getMatchedStylesForNode", { nodeId });
const hits = [];
for (const m of (matched.matchedCSSRules||[])) {
  const r = m.rule;
  const peProp = r.style?.cssProperties?.find(pr => pr.name === "pointer-events");
  if (peProp) {
    const media = (r.media||[]).map(x=>x.text).join(" & ");
    hits.push({ selector: r.selectorList?.text, value: peProp.value, media, origin: r.origin });
  }
}
// inherited (parent) pe rules
const inh = [];
for (const ie of (matched.inherited||[])) {
  for (const m of (ie.matchedCSSRules||[])) {
    const peProp = m.rule.style?.cssProperties?.find(pr => pr.name === "pointer-events");
    if (peProp) inh.push({ selector: m.rule.selectorList?.text, value: peProp.value, media: (m.rule.media||[]).map(x=>x.text).join(" & ") });
  }
}
console.log(JSON.stringify({ directRules: hits, inheritedRules: inh }, null, 2));
await b.close();
