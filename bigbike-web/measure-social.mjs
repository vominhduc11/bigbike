import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 800 } });
await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
const toggles = await p.$$('footer button[aria-expanded]');
for (const t of toggles) {
  const txt = (await t.innerText()).toLowerCase();
  if (txt.includes('hội') || txt.includes('xã')) { await t.click(); }
}
await p.waitForTimeout(400);
const data = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('footer a.inline-flex').forEach(a => {
    const spans = a.querySelectorAll(':scope > span');
    if (spans.length < 2) return;
    const iconBox = spans[0].getBoundingClientRect();
    const svg = spans[0].querySelector('svg');
    const glyph = svg ? svg.getBoundingClientRect() : null;
    const textBox = spans[1].getBoundingClientRect();
    const cs = getComputedStyle(a);
    out.push({
      label: spans[1].innerText,
      display: cs.display, gap: cs.gap,
      iconBoxRight: Math.round(iconBox.right),
      svgRight: glyph ? Math.round(glyph.right) : null,
      textLeft: Math.round(textBox.left),
      boxToText: Math.round(textBox.left - iconBox.right),
      svgToText: glyph ? Math.round(textBox.left - glyph.right) : null,
    });
  });
  return out;
});
console.log(JSON.stringify(data, null, 2));
await b.close();
