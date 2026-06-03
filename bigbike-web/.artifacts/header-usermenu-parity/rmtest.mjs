import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ reducedMotion: "reduce" });
const p = await ctx.newPage();
await p.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await p.waitForSelector(".bb-site-header");
const r = await p.evaluate(() => {
  const d = document.createElement("div");
  d.style.transition = "opacity 140ms linear, visibility 0s linear 140ms";
  document.body.appendChild(d);
  const cs = getComputedStyle(d);
  // also test a div with a class to confirm @media works at all
  return { dur: cs.transitionDuration, delay: cs.transitionDelay, prop: cs.transitionProperty };
});
console.log("plain div under reduce:", JSON.stringify(r));
await b.close();
