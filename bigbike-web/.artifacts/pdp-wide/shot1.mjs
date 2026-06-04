import { chromium } from 'playwright';
const url = process.argv[2], tag = process.argv[3], w = +process.argv[4];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: w, height: 1100 }, deviceScaleFactor: 1 });
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(1000);
await p.screenshot({ path: `.artifacts/pdp-wide/${tag}-${w}.png` });
await b.close();
