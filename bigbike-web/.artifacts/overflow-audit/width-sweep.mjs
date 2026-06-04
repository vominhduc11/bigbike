import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const EMAIL = process.env.BB_EMAIL, PASS = process.env.BB_PASS;
const WIDTHS = [360,375,390,400,412,414,428,430,480,540,600,640,667,700,740,767];
function measure(){const d=document.documentElement.scrollWidth,w=window.innerWidth,o=d-w;let off=[];if(o>1){for(const el of document.querySelectorAll("*")){const r=el.getBoundingClientRect();if(r.width===0||r.height===0)continue;if(r.right>w+1)off.push({tag:el.tagName.toLowerCase(),cls:(el.getAttribute("class")||"").slice(0,90),right:Math.round(r.right)});}off.sort((a,b)=>b.right-a.right);}return{o,w,off:off.slice(0,4)};}
const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});const p=await c.newPage();
await p.goto(BASE+"/dang-nhap/",{waitUntil:"networkidle"});await p.fill("#login-username",EMAIL);await p.fill("#login-password",PASS);
await Promise.all([p.waitForLoadState("networkidle"),p.click('button[type="submit"]')]);await p.waitForTimeout(1500);
const routes=["/tai-khoan/","/tai-khoan/yeu-thich/","/tai-khoan/doi-tra/"];
for(const route of routes){console.log("\n### "+route);for(const w of WIDTHS){await p.setViewportSize({width:w,height:844});await p.goto(BASE+route,{waitUntil:"networkidle"});await p.waitForTimeout(350);const m=await p.evaluate(measure);if(m.o>1){console.log(`  [${w}] OVERFLOW +${m.o}px`);for(const x of m.off)console.log(`     ${x.tag}.${x.cls} r=${x.right}`);}else{console.log(`  [${w}] ok`);}}}
await b.close();
