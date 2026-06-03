// Strip DEAD bb-fp-* CARD-ITEM rules from globals.css.
// ProductCard featured variant (both surfaces) is fully inline Tailwind — it emits
// NONE of bb-fp-item/thumb/sale/cart/desc/inside/title/price/rating. Those rules are dead.
// KEEP carousel chrome (bb-fp-carousel/viewport/page-track/arrow/pagination + swiper bullets)
// and the section header (bb-products-header/-title/-section-head). Surgically remove only the
// card members from grouped selectors (preserve the bb-product-* / bb-home-mobile-* / section-header co-selectors).
const fs = require("fs");
const path = process.argv[2];
const raw = fs.readFileSync(path, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
let lines = raw.split(/\r?\n/); // lines[i] == file line (i+1), no trailing \r

const KEEP_TOKENS = [
  "bb-fp-carousel", "bb-fp-viewport", "bb-fp-page-track", "bb-fp-arrow",
  "bb-fp-pagination", "bb-products-header", "bb-products-title", "bb-section-head",
];

// In-place selector-member replacements (drop a card member, fix the trailing comma).
const replaceOps = [
  { line: 2718, old: ".bb-product-card,", new: ".bb-product-card {" },
  { line: 2727, old: ".bb-product-card:hover,", new: ".bb-product-card:hover {" },
  { line: 2870, old: ".bb-product-image,", new: ".bb-product-image {" },
  { line: 2876, old: ".bb-product-image,", new: ".bb-product-image {" },
  { line: 2882, old: ".bb-product-image > span > img,", new: ".bb-product-image > span > img {" },
  { line: 2891, old: ".bb-product-card:hover .bb-product-image > span > img,", new: ".bb-product-card:hover .bb-product-image > span > img {" },
  { line: 2953, old: ".bb-product-price b,", new: ".bb-product-price b {" },
  { line: 2962, old: ".bb-product-price s,", new: ".bb-product-price s {" },
  { line: 2974, old: ".bb-product-tag,", new: ".bb-product-tag {" },
  { line: 3100, old: ".bb-product-card,", new: ".bb-product-card {" },
  { line: 5450, old: ".bb-home-mobile-trust-card,", new: "  .bb-home-mobile-trust-card {" },
  { line: 5460, old: ".bb-home-products-parity .bb-products-title,", new: "  .bb-home-products-parity .bb-products-title {" },
  { line: 6039, old: ".bb-product-image > span > img,", new: "  .bb-product-image > span > img {" },
];

// Whole-block / member deletions (1-based inclusive). first/last = substring anchors for boundary verify.
const deleteOps = [
  { start: 2506, end: 2618, first: "WP-style product card", last: "bb-fp-rating" },
  { start: 2672, end: 2674, first: "bb-fp-item", last: "bb-fp-cart a" },
  { start: 2719, end: 2719, first: "bb-fp-item {", last: "bb-fp-item {" },
  { start: 2728, end: 2728, first: "bb-fp-item:hover {", last: "bb-fp-item:hover {" },
  { start: 2797, end: 2805, first: "bb-fp-cart a {", last: "}" },
  { start: 2871, end: 2871, first: "bb-fp-thumb {", last: "bb-fp-thumb {" },
  { start: 2877, end: 2877, first: "bb-fp-thumb {", last: "bb-fp-thumb {" },
  { start: 2883, end: 2883, first: "bb-fp-thumb img {", last: "bb-fp-thumb img {" },
  { start: 2892, end: 2892, first: "bb-fp-item:hover .bb-fp-thumb img {", last: "bb-fp-item:hover .bb-fp-thumb img {" },
  { start: 2934, end: 2944, first: "Card title sits", last: "}" },
  { start: 2954, end: 2954, first: "bb-fp-price-current {", last: "bb-fp-price-current {" },
  { start: 2963, end: 2963, first: "bb-fp-price-old {", last: "bb-fp-price-old {" },
  { start: 2969, end: 2969, first: "bb-fp-price-current,", last: "bb-fp-price-current," },
  { start: 2975, end: 2975, first: "bb-fp-sale p {", last: "bb-fp-sale p {" },
  { start: 2989, end: 3009, first: "bb-fp-cart {", last: "}" },
  { start: 3011, end: 3036, first: "bb-fp-item {", last: "}" },
  { start: 3101, end: 3101, first: "bb-fp-item {", last: "bb-fp-item {" },
  { start: 3279, end: 3444, first: "bb-home-products-parity .bb-fp-item {", last: "}" },
  { start: 3479, end: 3506, first: "Featured products: desktop image frame", last: "}" },
  { start: 3508, end: 3511, first: "1536px", last: "Arrow guard" },
  { start: 3513, end: 3515, first: "bb-home-products-parity .bb-fp-item {", last: "}" },
  { start: 3521, end: 3528, first: "2560px", last: "}" },
  { start: 4672, end: 4674, first: "bb-home-products-parity .bb-fp-item {", last: "}" },
  { start: 4737, end: 4739, first: "bb-home-products-parity .bb-fp-item {", last: "}" },
  { start: 5203, end: 5239, first: "bb-home-products-parity .bb-fp-item {", last: "" },
  { start: 5451, end: 5451, first: "bb-home-products-parity .bb-fp-item {", last: "bb-home-products-parity .bb-fp-item {" },
  { start: 5461, end: 5462, first: "bb-home-products-parity .bb-fp-title,", last: "bb-fp-title a {" },
  { start: 5491, end: 5493, first: "bb-home-products-parity .bb-fp-desc {", last: "}" },
  { start: 5783, end: 5795, first: "bb-fp-price-current,", last: "}" },
  { start: 6040, end: 6040, first: "bb-home-products-parity .bb-fp-thumb img {", last: "bb-home-products-parity .bb-fp-thumb img {" },
  { start: 6043, end: 6054, first: "", last: "}" },
  { start: 6068, end: 6068, first: "bb-home-products-parity .bb-fp-title a,", last: "bb-home-products-parity .bb-fp-title a," },
];

// --- verify replace ops ---
for (const op of replaceOps) {
  const cur = lines[op.line - 1];
  if (cur === undefined || cur.trim() !== op.old.trim()) {
    throw new Error(`REPLACE mismatch at line ${op.line}: expected "${op.old.trim()}" got "${cur && cur.trim()}"`);
  }
}
// --- verify delete ops (boundaries + no keep-token inside) ---
for (const op of deleteOps) {
  const f = lines[op.start - 1], l = lines[op.end - 1];
  if (op.first && (f === undefined || !f.includes(op.first)))
    throw new Error(`DELETE start mismatch ${op.start}: want "${op.first}" got "${f}"`);
  if (op.last && (l === undefined || !l.includes(op.last)))
    throw new Error(`DELETE end mismatch ${op.end}: want "${op.last}" got "${l}"`);
  for (let i = op.start - 1; i <= op.end - 1; i++) {
    for (const k of KEEP_TOKENS) {
      if (lines[i].includes(k))
        throw new Error(`DELETE op ${op.start}-${op.end} would remove KEEP token "${k}" at line ${i + 1}: "${lines[i]}"`);
    }
  }
}
// --- check delete ranges don't overlap ---
const sorted = [...deleteOps].sort((a, b) => a.start - b.start);
for (let i = 1; i < sorted.length; i++)
  if (sorted[i].start <= sorted[i - 1].end)
    throw new Error(`Overlapping delete ranges: ${sorted[i - 1].start}-${sorted[i - 1].end} & ${sorted[i].start}-${sorted[i].end}`);

// --- apply replaces (in place) ---
for (const op of replaceOps) lines[op.line - 1] = op.new;
// --- apply deletes (descending so indices stay valid) ---
const before = lines.length;
for (const op of [...deleteOps].sort((a, b) => b.start - a.start)) {
  lines.splice(op.start - 1, op.end - op.start + 1);
}
const removed = before - lines.length;

const out = lines.join(eol);
// --- brace balance ---
const opens = (out.match(/{/g) || []).length, closes = (out.match(/}/g) || []).length;
if (opens !== closes) throw new Error(`Brace imbalance: { ${opens} } ${closes}`);
// --- residual dead-card check ---
const deadTokens = ["bb-fp-item", "bb-fp-thumb", "bb-fp-sale", "bb-fp-cart", "bb-fp-desc", "bb-fp-inside", "bb-fp-title", "bb-fp-price", "bb-fp-rating"];
const residual = [];
out.split(eol).forEach((ln, i) => { for (const t of deadTokens) if (ln.includes(t)) residual.push(`${i + 1}: ${ln.trim()}`); });

fs.writeFileSync(path, out);
console.log(`removed ${removed} lines; braces { ${opens} } ${closes} balanced`);
console.log(`residual dead-card refs: ${residual.length}`);
if (residual.length) console.log(residual.join("\n"));
