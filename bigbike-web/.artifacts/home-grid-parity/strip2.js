// CRLF-aware strip of dead orphan CSS after the home migration:
//  - .bb-stock-* (4 rules) — ProductCard inlined the stock badge; 0 JSX refs.
//  - .bb-home-products-parity .swiper-wrapper/.swiper-slide — featured carousel
//    uses bb-fp-page-track (custom), no Swiper DOM; 0 matching elements.
const fs = require("fs");
const path = "app/globals.css";
let css = fs.readFileSync(path, "utf8");
const before = css;
const L = (...l) => l.join("\r\n");

const ops = [
  {
    find: L(
      ".bb-stock-badge {",
      "  border-radius: 0;",
      "  font-family: var(--bb-font-link);",
      "  font-size: 14px;",
      "  font-weight: 700;",
      "  letter-spacing: 0;",
      "  line-height: 12px;",
      "}",
      "",
      ".bb-stock-in {",
      "  background: var(--bb-state-success-bg);",
      "  /* state-success-text (#3d5230) = ~6:1 on the light-green bg — passes AA. */",
      "  color: var(--bb-state-success-text);",
      "  border: 1px solid var(--bb-state-success-border);",
      "}",
      "",
      ".bb-stock-low {",
      "  background: var(--bb-state-warning);",
      "  color: #000000;",
      "  border: 1px solid var(--bb-state-warning);",
      "}",
      "",
      ".bb-stock-out {",
      "  background: #dddddd;",
      "  /* #6f6f6f on #dddddd = ~3.43:1 — fails WCAG AA. Use #4a4a4a = 5.77:1. */",
      "  color: #4a4a4a;",
      "  border: 1px solid #dddddd;",
      "}",
      "",
      "",
    ),
    repl: "",
  },
  {
    find: L(
      ".bb-home-products-parity .swiper-wrapper {",
      "  align-items: stretch;",
      "}",
      "",
      ".bb-home-products-parity .swiper-slide {",
      "  height: auto;",
      "}",
      "",
      "",
    ),
    repl: "",
  },
];

ops.forEach((op, i) => {
  const n = css.split(op.find).length - 1;
  if (n !== 1) throw new Error(`op ${i + 1}: expected 1 match, found ${n}`);
  css = css.replace(op.find, op.repl);
});

const bal = (s) => (s.match(/{/g) || []).length - (s.match(/}/g) || []).length;
if (bal(before) !== bal(css)) throw new Error(`brace balance changed: ${bal(before)} -> ${bal(css)}`);

const residual = css.match(/\.bb-stock-|\.bb-home-products-parity \.swiper-/g);
if (residual) throw new Error("residual refs: " + [...new Set(residual)].join(", "));

fs.writeFileSync(path, css);
console.log(`OK. ${before.length - css.length} bytes removed. brace balance ${bal(css)}.`);
