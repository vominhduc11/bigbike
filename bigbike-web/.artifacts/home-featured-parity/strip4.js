// bb-kicker group migration: all 7 JSX usages inlined per-context profile (grep-confirmed 0
// bb-kicker left in tsx/ts). Remove all bb-kicker rules; split the .bb-kicker,.bb-product-brand
// group to keep .bb-product-brand. .bb-section-head .bb-kicker rules were dead (skeleton uses
// SkelText placeholders, no real bb-kicker child).
const fs = require("fs");
const path = process.argv[2];
let text = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const ops = [
  { label: "K1 base .bb-kicker", find: `.bb-kicker {
  margin-bottom: var(--bb-space-3);
  color: var(--bb-text-brand);
  font-size: var(--bb-text-section-kicker);
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
`, repl: "" },
  { label: "K2 section-head kicker (one-liner)", find: `.bb-section-head .bb-kicker { font-family: var(--bb-font-cta); font-size: var(--bb-text-section-kicker); line-height: var(--bb-line-section-kicker); letter-spacing: 0; text-transform: uppercase; color: var(--bb-text-brand); margin: 0 0 10px; display: block; }
`, repl: "" },
  { label: "K3 products-section kicker (+comment)", find: `/* Header: cfn giua, sub-title xAm #cecece, tiAu 'e 'am */
.bb-products-section .bb-kicker {
  color: var(--bb-text-brand);
  font-family: var(--bb-font-cta);
  font-size: var(--bb-text-section-kicker);
  line-height: var(--bb-line-section-kicker);
  letter-spacing: 0;
  text-transform: uppercase;
  margin: 0 0 10px;
}
`, repl: "" },
  { label: "K4 split kicker/product-brand group", find: `.bb-kicker,
.bb-product-brand {
  color: var(--bb-color-red-700);
  font-family: var(--bb-font-cta);
  letter-spacing: 0;
  text-transform: uppercase;
}`, repl: `.bb-product-brand {
  color: var(--bb-color-red-700);
  font-family: var(--bb-font-cta);
  letter-spacing: 0;
  text-transform: uppercase;
}` },
  { label: "K5 products-section+section-head kicker group", find: `.bb-products-section .bb-kicker,
.bb-section-head .bb-kicker {
  color: var(--bb-text-brand);
  font-family: var(--bb-font-cta);
  font-size: var(--bb-text-section-kicker);
  line-height: var(--bb-line-section-kicker);
  letter-spacing: 0;
  text-transform: uppercase;
}
`, repl: "" },
  { label: "K6 home-products-parity kicker", find: `.bb-home-products-parity .bb-kicker {
  margin: 0 0 10px;
  color: var(--bb-text-muted);
  font-family: var(--bb-font-cta);
  font-size: var(--bb-text-section-kicker);
  line-height: var(--bb-line-section-kicker);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
`, repl: "" },
  { label: "K7 mobile featured kicker + ::before", find: `  .bb-home-products-parity .bb-products-header .bb-kicker {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    font-family: var(--bb-font-cta);
    font-size: 10px;
    letter-spacing: 0.18em;
  }

  .bb-home-products-parity .bb-products-header .bb-kicker::before {
    width: 16px;
    height: 1px;
    background: var(--bb-action-primary);
    content: "";
  }

`, repl: "" },
  { label: "K8 .bb-home kicker", find: `.bb-home .bb-kicker {
  color: var(--bb-text-muted);
  letter-spacing: 0.15em;
}
`, repl: "" },
  { label: "K9 section-head kicker color", find: `.bb-section-head .bb-kicker {
  color: var(--bb-text-brand);
}
`, repl: "" },
];

for (const op of ops) {
  const n = text.split(op.find).length - 1;
  if (n !== 1) throw new Error(`${op.label}: expected 1 match, found ${n}`);
  text = text.replace(op.find, op.repl);
}

text = text.replace(/\n{3,}/g, "\n\n");
const kickerRefs = (text.match(/bb-kicker/g) || []).length;
const brandRefs = (text.match(/bb-product-brand/g) || []).length;
const opens = (text.match(/{/g) || []).length, closes = (text.match(/}/g) || []).length;
if (opens !== closes) throw new Error(`brace imbalance { ${opens} } ${closes}`);

text = text.replace(/\n/g, "\r\n");
fs.writeFileSync(path, text);
console.log(`OK. braces ${opens}/${closes}. residual bb-kicker=${kickerRefs} (want 0); bb-product-brand kept=${brandRefs}`);
