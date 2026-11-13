import fs from 'node:fs';
import {setImmediate} from 'node:timers/promises';
import { sanitizeRichHtml } from '/root/myproject/bigbike/bigbike-web/lib/utils/html.ts';
const catalog=JSON.parse(fs.readFileSync('/tmp/bigbike-gmc-continue-20261110/catalog.json','utf8'));
const htmls:string[]=[];
function walk(x:unknown){if(typeof x==='string' && /<(p|table|div|h[1-6]|img)\b/i.test(x))htmls.push(x);else if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x==='object')Object.values(x).forEach(walk);}
catalog.forEach(walk);
const samples:any[]=[];
const output='/root/myproject/bigbike/docs/audits/evidence/gmc-round2-2026-11-09/continuation-2026-11-10/sanitizer-memory.json';
function persist(){fs.writeFileSync(output,JSON.stringify({node:process.version,htmlStrings:htmls.length,characters:htmls.reduce((n,x)=>n+x.length,0),samples,scope:'isolated sanitizer, real content, event loop yielded per call; no production heap access'},null,2));}
function snap(label:string){const before=process.memoryUsage();global.gc?.();samples.push({label,beforeGc:before,afterGc:process.memoryUsage()});}
async function main(){
 snap('afterImportAndRealCatalog');persist();
 console.log('htmlStrings',htmls.length);
 for(let round=0;round<3;round++){
  let i=0;
  for(const html of htmls){
   sanitizeRichHtml(html,{allowInlineStyles:true,allowStyleTags:true,locale:'vi'});
   await setImmediate();
   if(++i%100===0){snap('round'+(round+1)+'_html'+i);persist();if(process.memoryUsage().heapUsed>350*1024*1024)throw Error('ISOLATED_HEAP_GUARD');}
  }
  await setImmediate();snap('afterRound'+(round+1));persist();console.log(samples[samples.length-1]);
 }
}
main();
