// Strip DEAD bb-archive-product* / bb-archive-rating CSS from globals.css.
// These classes have ZERO live JSX usage: the ProductCard archive variant was
// migrated to inline Tailwind (commit f4389916) and SaleBadge replaced
// bb-archive-product-sale. Verified via grep across bigbike-web (only globals.css
// + a .bak + SaleBadge's comment reference them).
//
// Content-anchored (not line numbers) -> order-independent + safe.
const fs = require("fs");

const PATH = "c:/Users/ADMIN/OneDrive/Documents/bigbike/bigbike-web/app/globals.css";
let css = fs.readFileSync(PATH, "utf8");
const before = css.length;

// File is CRLF; author anchors with \n and convert here so they match.
const nl = (s) => s.replace(/\n/g, "\r\n");

function removeSpan(label, start, end) {
  start = nl(start);
  end = nl(end);
  const i = css.indexOf(start);
  if (i === -1) throw new Error(`[${label}] start anchor not found`);
  if (css.indexOf(start, i + 1) !== -1) throw new Error(`[${label}] start anchor NOT unique`);
  const j = css.indexOf(end, i);
  if (j === -1) throw new Error(`[${label}] end anchor not found after start`);
  const cut = css.slice(i, j + end.length);
  const open = (cut.match(/{/g) || []).length;
  const close = (cut.match(/}/g) || []).length;
  if (open !== close) throw new Error(`[${label}] removed span not brace-balanced (${open}{ vs ${close}})`);
  let k = i;
  if (css.slice(0, k).endsWith("\n\n")) k = k - 1; // swallow one leading blank line
  css = css.slice(0, k) + css.slice(j + end.length);
  console.log(`[${label}] removed ${cut.length} chars (${open} rules)`);
}

function replaceOnce(label, from, to) {
  from = nl(from);
  to = nl(to);
  const i = css.indexOf(from);
  if (i === -1) throw new Error(`[${label}] 'from' not found`);
  if (css.indexOf(from, i + 1) !== -1) throw new Error(`[${label}] 'from' NOT unique`);
  css = css.slice(0, i) + to + css.slice(i + from.length);
  console.log(`[${label}] rewrote selector list`);
}

// ---- A. main standalone block (was ~6060-6211) ----
removeSpan(
  "main-block",
  ".bb-archive-product {\n  margin: 30px 0 0;\n  color: #000000;\n}",
  ".bb-archive-rating .text-brand {\n  color: var(--bb-rating-star);\n}",
);

// ---- B. responsive (<=767) standalone block (was ~8343-8412) ----
removeSpan(
  "mobile-block",
  "  .bb-archive-product {\n    height: 100%;\n    margin: 0;",
  "  .bb-archive-rating {\n    margin-top: 8px;\n    font-size: 14px;\n  }",
);

// ---- C. [Fix 6] standalone rule + comment (was ~9610-9614) ----
removeSpan(
  "fix6-cta",
  "  /* [Fix 6] Archive product-card CTA bar was 40px tall",
  "  .bb-archive-product-cart a {\n    min-height: 44px;\n  }",
);

// ---- C2. dead price text-align rule inside the <=767 block (was ~6451) ----
removeSpan(
  "mobile767-price",
  "  .bb-archive-product-price {\n    text-align: left;\n  }",
  "  .bb-archive-product-price {\n    text-align: left;\n  }",
);

// ---- C3. entire dead @media (max-width:430px) block (was ~6456-6462) ----
removeSpan(
  "media430-block",
  "@media (max-width: 430px) {\n  .bb-archive-product-title,",
  ".bb-archive-product-price p {\n    font-size: 14px;\n  }\n}",
);

// ---- D. grouped contrast-normalizers: drop dead members, keep bb-fp-* / others ----
replaceOnce(
  "price-current",
  ".bb-home-products-parity .bb-fp-price-current,\n.bb-archive-product-price,\n.bb-archive-product-price p {",
  ".bb-home-products-parity .bb-fp-price-current {",
);
replaceOnce(
  "price-old",
  ".bb-home-products-parity .bb-fp-price-old,\n.bb-archive-product-price p.old {",
  ".bb-home-products-parity .bb-fp-price-old {",
);
replaceOnce(
  "rating-star",
  ".bb-archive-rating .text-brand,\n.bb-archive-rating [class*=\"text-[var(--bb-rating-star)]\"],\n.bb-fp-rating .text-brand {",
  ".bb-fp-rating .text-brand {",
);
replaceOnce(
  "object-fit-group",
  "  .bb-product-image > span > img,\n  .bb-archive-product-img,\n  .bb-home-products-parity .bb-fp-thumb img,",
  "  .bb-product-image > span > img,\n  .bb-home-products-parity .bb-fp-thumb img,",
);
replaceOnce(
  "line-clamp-group",
  "  .bb-home-products-parity .bb-fp-title a,\n  .bb-archive-product-title a,\n  .bb-category-body h3 {",
  "  .bb-home-products-parity .bb-fp-title a,\n  .bb-category-body h3 {",
);

// ---- verify: no bb-archive-product* / bb-archive-rating left, braces balanced ----
const leftovers = (css.match(/bb-archive-product|bb-archive-rating/g) || []).length;
if (leftovers !== 0) {
  const re = /bb-archive-product[\w-]*|bb-archive-rating/g;
  let m;
  while ((m = re.exec(css))) {
    const ctx = css.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\r?\n/g, "\\n");
    console.log(`  LEFTOVER @${m.index}: ...${ctx}...`);
  }
  throw new Error(`STILL ${leftovers} bb-archive-product/rating refs left!`);
}
const open = (css.match(/{/g) || []).length;
const close = (css.match(/}/g) || []).length;
if (open !== close) throw new Error(`FILE brace mismatch: ${open}{ vs ${close}}`);

fs.writeFileSync(PATH, css, "utf8");
console.log(`\nDONE. ${before} -> ${css.length} chars (-${before - css.length}). braces ${open}/${close} balanced. 0 leftovers.`);
