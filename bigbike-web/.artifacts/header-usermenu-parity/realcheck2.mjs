import { chromium } from "playwright";
const PROPS = ["opacity","visibility","pointerEvents","transform","transitionDelay","transitionProperty","transitionDuration"];
const b = await chromium.launch();
const p = await b.newContext().then(c=>c.newPage());
await p.setViewportSize({width:1280,height:900});
await p.goto("http://localhost:3007/",{waitUntil:"domcontentloaded"});
await p.waitForSelector(".bb-site-header");
await p.waitForTimeout(300);
// click the user trigger button (sibling of the menu, inside the wrapper)
const clicked = await p.evaluate(()=>{
  const m=document.querySelector(".bb-user-control [role=menu]");
  const btn=m.parentElement.querySelector("button");
  if(!btn) return false;
  btn.click();
  return true;
});
console.log("clicked trigger:", clicked);
await p.waitForTimeout(450);
const open = await p.evaluate((props)=>{
  const m=document.querySelector(".bb-user-control [role=menu]");
  const cs=getComputedStyle(m); const o={};
  for(const k of props) o[k]=cs[k];
  return o;
}, PROPS);
console.log("OPEN(real):", JSON.stringify(open));
console.log("OPEN(expected): opacity 1, visibility visible, pointerEvents auto, transform matrix(1,0,0,1,0,0), delay 0s,0s,0s,0s");
await b.close();
