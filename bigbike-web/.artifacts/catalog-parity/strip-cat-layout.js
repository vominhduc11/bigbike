// Strip the now-dead .bb-cat-layout CSS (skeleton grid migrated to inline `bbCatLayout`).
// Removes: base + 3 @media one-liners, the <=767 override line, and splits it out of
// the shared `background: var(--bb-bg-page)` selector group. CRLF-aware, verified.
const fs = require("fs");
const PATH = "c:/Users/ADMIN/OneDrive/Documents/bigbike/bigbike-web/app/globals.css";
let css = fs.readFileSync(PATH, "utf8");
const before = css.length;
const nl = (s) => s.replace(/\n/g, "\r\n");

function replaceOnce(label, from, to) {
  from = nl(from);
  to = nl(to);
  const i = css.indexOf(from);
  if (i === -1) throw new Error(`[${label}] 'from' not found`);
  if (css.indexOf(from, i + 1) !== -1) throw new Error(`[${label}] 'from' NOT unique`);
  css = css.slice(0, i) + to + css.slice(i + from.length);
  console.log(`[${label}] ok`);
}

// A. base rule + 3 @media one-liners (4 consecutive lines) -> remove entirely.
replaceOnce(
  "base+media",
  ".bb-cat-layout { display: grid; grid-template-columns: 220px 1fr; gap: 28px; width: min(100% - calc(var(--bb-page-padding-mobile) * 2), var(--bb-container-xl)); margin-inline: auto; margin-top: 32px; padding-bottom: 48px; }\n@media (min-width: 768px) { .bb-cat-layout { width: min(100% - calc(var(--bb-page-padding-tablet) * 2), var(--bb-container-xl)); } }\n@media (min-width: 1024px) { .bb-cat-layout { width: min(100% - calc(var(--bb-page-padding-desktop) * 2), var(--bb-container-xl)); grid-template-columns: 240px 1fr; } }\n@media (min-width: 1280px) { .bb-cat-layout { grid-template-columns: 260px 1fr; gap: 36px; } }\n",
  "",
);

// B. the <=767 override line inside its media block.
replaceOnce(
  "mobile-line",
  "\n  .bb-cat-layout { grid-template-columns: 1fr; margin-top: 24px; padding-bottom: 40px; gap: 0; }",
  "",
);

// C. split out of the bg-page group (drop the .bb-cat-layout, line).
replaceOnce(
  "bg-group",
  ".bb-page,\n.bb-cat-layout,\n.bb-products-section,",
  ".bb-page,\n.bb-products-section,",
);

if (/bb-cat-layout/.test(css)) throw new Error("leftover bb-cat-layout refs!");
const o = (css.match(/{/g) || []).length, c = (css.match(/}/g) || []).length;
if (o !== c) throw new Error(`file unbalanced ${o}/${c}`);
fs.writeFileSync(PATH, css, "utf8");
console.log(`DONE ${before} -> ${css.length} (-${before - css.length}). braces ${o}/${c}. 0 leftovers.`);
