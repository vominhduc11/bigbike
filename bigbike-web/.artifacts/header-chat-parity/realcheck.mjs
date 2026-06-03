import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newContext().then(c=>c.newPage());
await p.setViewportSize({width:1280,height:900});
await p.goto("http://localhost:3007/",{waitUntil:"domcontentloaded"});
await p.waitForSelector(".bb-floating-chat-anchor",{timeout:15000}).catch(()=>{});
await p.waitForTimeout(1400); // let the load-in scale anim settle
const closed = await p.evaluate(()=>{
  const a=document.querySelector(".bb-floating-chat-anchor");
  const wrap=a?.querySelector(":scope > div"); // bb-chat-float wrapper
  if(!wrap) return {__noFab:true};
  const innerBtn=wrap.querySelector("button");
  const block=innerBtn?.parentElement;
  const cs=innerBtn?getComputedStyle(innerBtn):null;
  const wcs=getComputedStyle(wrap);
  return {
    hasFab:!!innerBtn,
    wrapFlexDir:wcs.flexDirection, wrapAlign:wcs.alignItems, wrapAnim:wcs.animationName,
    innerW:cs?.width, innerH:cs?.height, innerRadius:cs?.borderRadius, innerBg:cs?.backgroundColor,
  };
});
console.log("CLOSED:",JSON.stringify(closed));
// click to open
let open={__noClick:true};
if(closed.hasFab){
  await p.evaluate(()=>document.querySelector(".bb-floating-chat-anchor button")?.click());
  await p.waitForTimeout(300);
  open=await p.evaluate(()=>{
    const btns=[...document.querySelectorAll("button[aria-label='Đóng hỗ trợ']")];
    const inner=btns[0]; const cs=inner?getComputedStyle(inner):null;
    const item=inner?.querySelector(":scope > div > div"); // first icon-item (chat, should be hidden)
    const panel=document.querySelector("a[href^='tel:'],a[href*='zalo'],a[href*='messenger']");
    return {hasOpenFab:!!inner, openBg:cs?.backgroundColor, openRadius:cs?.borderRadius,
            firstIconDisplay:item?getComputedStyle(item).display:null, hasPanelItem:!!panel};
  });
}
console.log("OPEN  :",JSON.stringify(open));
await b.close();
