import fs from 'node:fs';
import crypto from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
async function main(){
 const before=process.argv[2]==='before';
 const {sanitizeRichHtml}=await import(before?'/tmp/bigbike-gmc-continue-20261110/html-before.ts':'/root/myproject/bigbike/bigbike-web/lib/utils/html.ts');
 const catalog=JSON.parse(fs.readFileSync('/tmp/bigbike-gmc-continue-20261110/catalog.json','utf8'));
 const htmls:string[]=[];function walk(x:unknown){if(typeof x==='string' && /<(p|table|div|h[1-6]|img)\b/i.test(x))htmls.push(x);else if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x==='object')Object.values(x).forEach(walk);}catalog.forEach(walk);
 const digest=crypto.createHash('sha256');
 for(let i=0;i<htmls.length;i++){
  for(const locale of ['vi','en'] as const){const output=sanitizeRichHtml(htmls[i],{allowInlineStyles:true,allowStyleTags:true,locale});digest.update(JSON.stringify([i,locale,output]));}
  await setImmediate();if(i%100===0)global.gc?.();
 }
 const result={source:before?'before':'after',htmls:htmls.length,locales:['vi','en'],sha256:digest.digest('hex')};
 fs.writeFileSync('/tmp/bigbike-gmc-continue-20261110/html-output-'+(before?'before':'after')+'.json',JSON.stringify(result));console.log(result);
}
main();
