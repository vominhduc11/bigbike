import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newContext().then(c=>c.newPage());
await p.setViewportSize({width:1280,height:900});
await p.goto("http://localhost:3007/",{waitUntil:"domcontentloaded"});
await p.waitForSelector(".bb-site-header"); await p.waitForTimeout(300);
function read(){
  return p.evaluate(()=>{
    const sheet=document.querySelector(".bb-header-info-sheet");
    const overlay=sheet?.querySelector("button");
    const content=document.querySelector(".bb-header-info-content");
    const g=(el,ks)=>{const cs=getComputedStyle(el);const o={};for(const k of ks)o[k]=cs[k];return o;};
    return {
      sheet: sheet?g(sheet,["position","zIndex","overflowX","pointerEvents","visibility","transitionProperty","transitionDelay","transitionDuration"]):null,
      overlay: overlay?g(overlay,["position","backgroundColor","opacity","borderTopStyle","transitionProperty","transitionDuration"]):null,
      content: content?g(content,["position","width","paddingTop","paddingRight","transform","opacity","transitionProperty","transitionDuration"]):null,
    };
  });
}
const closed=await read();
const clicked=await p.evaluate(()=>{const t=document.querySelector(".bb-header-info-trigger");if(!t)return false;t.click();return true;});
console.log("clicked info-trigger:",clicked);
await p.waitForTimeout(650);
const open=await read();
console.log("CLOSED:",JSON.stringify(closed));
console.log("OPEN  :",JSON.stringify(open));
await b.close();
