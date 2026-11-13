const {chromium}=require('/root/myproject/bigbike/bigbike-web/node_modules/playwright');
const fs=require('node:fs');
const p='/tmp/bigbike-gmc-continue-20261110';
const evidence='/root/myproject/bigbike/docs/audits/evidence/gmc-round2-2026-11-09/continuation-2026-11-10';
const setFault=(detail)=>fs.writeFileSync(p+'/fault-mode.json',JSON.stringify({detail,snapshot:200}));
(async()=>{
 const browser=await chromium.launch({executablePath:'/root/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell',headless:true,args:['--no-sandbox']});
 const report={at:new Date().toISOString(),sourceImage:'sha256:f8c00411746da82a697d434204c8447840fc3796ee3d53ff6bf4fc8310580196',isolated:true,productionInterrupted:false,tests:[],errors:[]};
 try {
  for(const viewport of [{width:1440,height:900},{width:375,height:812}]){
   const context=await browser.newContext({viewport}); const page=await context.newPage();const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
   await page.route(/google-analytics\.com|googletagmanager\.com|connect\.facebook\.net|facebook\.com\/tr|clarity\.ms/,route=>route.abort());
   await page.route(/\.(jpg|jpeg|png|webp|gif)(\?|$)|\/_next\/image\//,route=>route.abort());
   let release; let failSnapshot=false; let held=true;
   const gate=new Promise(resolve=>release=resolve);
   await page.route(/\/api\/products\/.+\/snapshot\//,async route=>{
    if(held)await gate;
    if(failSnapshot)await route.fulfill({status:503,contentType:'application/json',body:'{"error":"ISOLATED_TEST"}'});
    else await route.continue();
   });
   setFault(503);
   const response=await page.goto('http://localhost:3191/product/tai-nghe-bluetooth-intercom-scs-s13/',{waitUntil:'domcontentloaded',timeout:30000});
   const btn=page.locator('[data-purchase-add]').first();await btn.waitFor();
   const locked=await btn.isDisabled();if(!locked)throw Error('Fallback unlocked before snapshot');
   await page.screenshot({path:`${evidence}/fallback-locked-${viewport.width}.png`,fullPage:false});
   held=false;release();await page.waitForFunction(()=>!document.querySelector('[data-purchase-add]')?.disabled,{},{timeout:20000});
   const unlocked=await btn.isEnabled();
   report.tests.push({viewport,status:response.status(),fallbackBeforeSnapshotLocked:locked,liveSnapshotUnlocks:unlocked});
   if(viewport.width===1440){
    failSnapshot=true;
    await page.waitForTimeout(31000);
    await page.evaluate(()=>{window.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));});
    await page.waitForFunction(()=>document.querySelector('[data-purchase-add]')?.disabled,{},{timeout:20000});
    report.tests[report.tests.length-1].snapshotFailureRelocks=await btn.isDisabled();
   }
   report.tests[report.tests.length-1].pageErrors=pageErrors;
   await context.close();
  }
  for(const status of [403,404,410]){
   setFault(status);
   const response=await fetch('http://localhost:3191/product/tai-nghe-bluetooth-intercom-scs-s13/');const html=await response.text();
   report.tests.push({upstreamStatus:status,pageStatus:response.status,hasProduct:html.includes('data-purchase-add'),notFallback:!html.includes('data-purchase-add')});
   if(html.includes('data-purchase-add'))throw Error(`4xx fallback used ${status}`);
   if(status===403){setFault(200);await fetch('http://localhost:3191/product/tai-nghe-bluetooth-intercom-scs-s13/').then(r=>r.text());}
  }
  setFault(503);
  const response=await fetch('http://localhost:3191/product/tai-nghe-bluetooth-intercom-scs-s13/');const html=await response.text();
  report.tests.push({after404410Then503:response.status,expiredOrDeletedCacheDoesNotRenderProduct:!html.includes('data-purchase-add')});
 }catch(e){report.errors.push(String(e));throw e;}
 finally{setFault(200);report.ok=report.errors.length===0;fs.writeFileSync(evidence+'/fallback-browser.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report,null,2));}
})();
