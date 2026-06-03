// CRLF-aware strip of the home WP-grid CSS (.bb-home .container/.row/.col-*).
// Each op asserts the anchor occurs exactly once; brace balance + residual-ref
// checked after. Run: node strip.js
const fs = require("fs");
const path = "app/globals.css";
let css = fs.readFileSync(path, "utf8");
const before = css;
const L = (...lines) => lines.join("\r\n"); // CRLF join

const ops = [
  // 1. container + row + row>[col-] (keep .align-items-center after)
  {
    find: L(
      ".bb-home .container {",
      "  width: 100%;",
      "  max-width: 1200px;",
      "  margin-right: auto;",
      "  margin-left: auto;",
      "  padding-right: 15px;",
      "  padding-left: 15px;",
      "}",
      "",
      ".bb-home .row {",
      "  display: flex;",
      "  flex-wrap: wrap;",
      "  margin-right: -15px;",
      "  margin-left: -15px;",
      "}",
      "",
      ".bb-home .row > [class*=\"col-\"] {",
      "  position: relative;",
      "  width: 100%;",
      "  padding-right: 15px;",
      "  padding-left: 15px;",
      "}",
      "",
      "",
    ),
    repl: "",
  },
  // 2. col-6 + col-12 (keep .align-items-center before, .text-center after)
  {
    find: L(
      ".bb-home .col-6 {",
      "  flex: 0 0 50%;",
      "  max-width: 50%;",
      "}",
      "",
      ".bb-home .col-12 {",
      "  flex: 0 0 100%;",
      "  max-width: 100%;",
      "}",
      "",
      "",
    ),
    repl: "",
  },
  // 3. @media 576 (col-sm-6) + @media 768 (col-md-3/4/8/12) — whole blocks
  {
    find: L(
      "@media (min-width: 576px) {",
      "  .bb-home .col-sm-6 {",
      "    flex: 0 0 50%;",
      "    max-width: 50%;",
      "  }",
      "}",
      "",
      "@media (min-width: 768px) {",
      "  .bb-home .col-md-3 {",
      "    flex: 0 0 25%;",
      "    max-width: 25%;",
      "  }",
      "",
      "  .bb-home .col-md-4 {",
      "    flex: 0 0 33.333333%;",
      "    max-width: 33.333333%;",
      "  }",
      "",
      "  .bb-home .col-md-8 {",
      "    flex: 0 0 66.666667%;",
      "    max-width: 66.666667%;",
      "  }",
      "",
      "  .bb-home .col-md-12 {",
      "    flex: 0 0 100%;",
      "    max-width: 100%;",
      "  }",
      "}",
      "",
      "",
    ),
    repl: "",
  },
  // 4. ≤767 group: drop the .bb-home .container member, keep the other two
  {
    find: L(
      "  .bb-home .container,",
      "  .bb-product-archive .container.bb-wp-container,",
    ),
    repl: "  .bb-product-archive .container.bb-wp-container,",
  },
  // 5. ≤767 SEO container padding rule (now dead — SEO div dropped .container)
  {
    find: L(
      "  .bb-home .content-bottom.bb-seo-content .container {",
      "    padding-inline: var(--bb-mobile-page-x);",
      "  }",
      "",
      "",
    ),
    repl: "",
  },
  // 6. Tier-2 ≥1536 container max-width
  {
    find: L(
      "  /* Tier 2 — homepage WP legacy .container */",
      "  .bb-home .container {",
      "    max-width: 1360px;",
      "  }",
      "",
      "",
    ),
    repl: "",
  },
  // 7. Tier-2 ≥1920 container max-width (unique via 1600px)
  {
    find: L(
      "  /* Tier 2 */",
      "  .bb-home .container {",
      "    max-width: 1600px;",
      "  }",
      "",
      "",
    ),
    repl: "",
  },
  // 8. Tier-2 ≥2560 container max-width (unique via 2240px)
  {
    find: L(
      "  /* Tier 2 */",
      "  .bb-home .container {",
      "    max-width: 2240px;",
      "  }",
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

// brace balance
const bal = (s) => (s.match(/{/g) || []).length - (s.match(/}/g) || []).length;
if (bal(before) !== bal(css)) throw new Error(`brace balance changed: ${bal(before)} -> ${bal(css)}`);

// residual-ref check: no .bb-home .container/.row/.col-* selectors remain
const residual = css.match(/\.bb-home \.(container|row|col-(6|12|sm-\d|md-\d+))\b/g);
if (residual) throw new Error("residual refs: " + [...new Set(residual)].join(", "));

fs.writeFileSync(path, css);
console.log(`OK. ${before.length - css.length} bytes removed. brace balance ${bal(css)}.`);
