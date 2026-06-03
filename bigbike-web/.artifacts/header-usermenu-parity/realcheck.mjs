import { chromium } from "playwright";
const PROPS = ["opacity","visibility","pointerEvents","transform","transitionDelay","transitionProperty","width","backgroundColor","boxShadow","top","right","zIndex"];
const b = await chromium.launch();
const p = await b.newContext().then(c=>c.newPage());
await p.setViewportSize({width:1280,height:900});
await p.goto("http://localhost:3007/",{waitUntil:"domcontentloaded"});
await p.waitForSelector(".bb-site-header");
await p.waitForTimeout(300);
// locate the user-menu inside .bb-user-control
const info = await p.evaluate(()=>{
  const menus=[...document.querySelectorAll(".bb-user-control [role=menu]")];
  return {count:menus.length};
});
console.log("role=menu count in user-control:", info.count);
function readMenu(){
  return p.evaluate((props)=>{
    const m=document.querySelector(".bb-user-control [role=menu]");
    if(!m) return {__missing:true};
    const cs=getComputedStyle(m); const o={};
    for(const k of props) o[k]=cs[k];
    const before=getComputedStyle(m,"::before"); o.beforeBorderBottom=before.borderBottomColor+" "+before.borderBottomWidth;
    const after=getComputedStyle(m,"::after"); o.afterHeight=after.height;
    return o;
  },PROPS);
}
const closed = await readMenu();
// open: hover the wrapper (parent of the menu)
await p.evaluate(()=>{ const m=document.querySelector(".bb-user-control [role=menu]"); m.parentElement.dispatchEvent(new MouseEvent("mouseenter",{bubbles:true})); });
await p.hover(".bb-user-control [role=menu]").catch(()=>{});
await p.waitForTimeout(400);
const open = await readMenu();
console.log("CLOSED:", JSON.stringify(closed,null,0));
console.log("OPEN  :", JSON.stringify(open,null,0));
await b.close();
