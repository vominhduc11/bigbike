// Class-injection probe for a grid class: inject a div with the given className
// (+6 children) into the homepage body, read gridTemplateColumns/gap/display at
// several widths. Usage: node probe-grid.js <baseUrl> "<className>" <outFile>
const { chromium } = require("playwright");
const fs = require("fs");
const WIDTHS = [2560, 2559, 901, 900, 700, 601, 600, 390];

async function main() {
  const [base, className, out] = process.argv.slice(2);
  const browser = await chromium.launch();
  const result = {};
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    const data = await page.evaluate((cn) => {
      const host = document.createElement("div");
      host.style.width = "100%";
      const grid = document.createElement("div");
      grid.className = cn;
      for (let i = 0; i < 6; i++) { const c = document.createElement("div"); c.textContent = "x"; grid.appendChild(c); }
      host.appendChild(grid);
      document.body.appendChild(host);
      const cs = getComputedStyle(grid);
      const cols = cs.gridTemplateColumns.split(" ").length; // number of tracks
      return { display: cs.display, cols, gap: cs.gap, rowGap: cs.rowGap, columnGap: cs.columnGap };
    }, className);
    result[w] = data;
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log("wrote", out, JSON.stringify(result));
}
main().catch((e) => { console.error(e); process.exit(1); });
