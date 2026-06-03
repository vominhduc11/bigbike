// Commit 2 — featured section header. bb-products-title + bb-section-title are used
// ONLY on the one featured <h2> (grep-confirmed) → fully dead once that h2 is inlined.
// Remove all their rules (split groups, keep co-selectors). Remove bb-products-header
// LAYOUT rules (migrated inline) but KEEP the class on the div as the deferred-kicker
// hook (.bb-home-products-parity .bb-products-header .bb-kicker[::before] stay).
const fs = require("fs");
const path = process.argv[2];
let text = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const ops = [
  // ---- HEADER layout removals ----
  { label: "H1 base header", find: `.bb-products-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1.5rem;
}
`, repl: "" },
  { label: "H2 header color", find: `.bb-products-header {
  color: var(--bb-text-primary);
}
`, repl: "" },
  { label: "H3 section>header", find: `.bb-products-section .bb-products-header {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0;
  padding-bottom: 2.5rem;
}
`, repl: "" },
  { label: "H4 section-head/header border group", find: `.bb-section-head,
.bb-products-header {
  border-bottom: 1px solid rgba(221, 221, 221, 0.28);
  padding-bottom: 24px;
  margin-bottom: 32px;
}`, repl: `.bb-section-head {
  border-bottom: 1px solid rgba(221, 221, 221, 0.28);
  padding-bottom: 24px;
  margin-bottom: 32px;
}` },
  { label: "H5 home-parity header", find: `.bb-home-products-parity .bb-products-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin: 0 0 40px;
  padding: 0;
  border-bottom: 0;
  text-align: center;
}
`, repl: "" },
  { label: "H6 spacing-pass header mb40", find: `.bb-home-products-parity .bb-products-header {
  margin-bottom: 40px;
}
`, repl: "" },
  { label: "H7 mobile header mb28", find: `  .bb-home-products-parity .bb-products-header {
    margin-bottom: 28px;
  }
`, repl: "" },
  { label: "H8 mobile header pad/align", find: `  .bb-home-products-parity .bb-products-header {
    margin-bottom: 14px;
    padding: 0 14px;
    text-align: left;
  }
`, repl: "" },
  { label: "H9 mobile header padding-inline", find: `  .bb-home-products-parity .bb-products-header {
    padding-inline: var(--bb-mobile-page-x);
  }
`, repl: "" },
  // ---- TITLE removals (bb-products-title + bb-section-title fully dead) ----
  { label: "T1 base products-title", find: `.bb-products-title {
  font-family: var(--bb-font-heading);
  font-size: var(--bb-text-section-title);
  font-weight: 600;
  text-transform: uppercase;
  color: var(--bb-text-primary);
  margin: 0;
  line-height: var(--bb-line-section-title);
  letter-spacing: 0;
}
`, repl: "" },
  { label: "T2 base section-title", find: `.bb-section-title { font-family: var(--bb-font-heading); text-transform: uppercase; font-size: var(--bb-text-section-title); font-weight: 600; letter-spacing: 0; line-height: var(--bb-line-section-title); margin: 0; color: var(--bb-text-primary); }
`, repl: "" },
  { label: "T3 color group", find: `.bb-section-title,
.bb-page-head h1,
.bb-products-title {
  color: var(--bb-text-primary);
}`, repl: `.bb-page-head h1 {
  color: var(--bb-text-primary);
}` },
  { label: "T4 reskin section-title color", find: `
.bb-section-title { color: var(--bb-text-primary); }`, repl: "" },
  { label: "T5 section>section-title color", find: `.bb-products-section .bb-section-title { color: var(--bb-text-primary); }
`, repl: "" },
  { label: "T6 section>products-title", find: `.bb-products-section .bb-products-title {
  text-align: center;
  font-weight: 600;
}
`, repl: "" },
  { label: "T7 page-h1 font group", find: `.bb-page h1,
.bb-section-title,
.bb-products-title,
.bb-page-head h1 {
  color: var(--bb-text-primary);
  font-family: var(--bb-font-heading);
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.5;
  text-transform: uppercase;
}`, repl: `.bb-page h1,
.bb-page-head h1 {
  color: var(--bb-text-primary);
  font-family: var(--bb-font-heading);
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.5;
  text-transform: uppercase;
}` },
  { label: "T8 font-size group + comment", find: `/* WP section title: Barlow Condensed 50px/60px desktop; scales via brand tokens on tablet/mobile. */
.bb-section-title,
.bb-products-title {
  font-size: var(--bb-text-section-title);
  line-height: var(--bb-line-section-title);
}
`, repl: "" },
  { label: "T9 mobile font-size @media", find: `@media (max-width: 767px) {
  .bb-section-title,
  .bb-products-title {
    font-size: var(--bb-text-section-title);
    line-height: var(--bb-line-section-title);
  }
}
`, repl: "" },
  { label: "T10 home-parity products-title", find: `.bb-home-products-parity .bb-products-title {
  margin: 0;
  color: #000;
  font-family: var(--bb-font-heading);
  font-size: var(--bb-text-section-title);
  font-weight: 600;
  line-height: var(--bb-line-section-title);
  letter-spacing: 0;
  text-align: center;
  text-transform: uppercase;
}
`, repl: "" },
  { label: "T11 mobile dark title group", find: `  .bb-mobile-section-header h2,
  .bb-home-products-parity .bb-products-title {
    color: var(--bb-text-inverse);
    font-size: 24px;
    line-height: 1.05;
    letter-spacing: 0;
  }`, repl: `  .bb-mobile-section-header h2 {
    color: var(--bb-text-inverse);
    font-size: 24px;
    line-height: 1.05;
    letter-spacing: 0;
  }` },
  { label: "T12 mobile light title group", find: `  .bb-home-mobile-category-card .text-foreground,
  .bb-home-mobile-trust-card .text-foreground,
  .bb-mobile-section-header h2,
  .bb-home-products-parity .bb-products-title {
    color: var(--bb-text-primary);
  }`, repl: `  .bb-home-mobile-category-card .text-foreground,
  .bb-home-mobile-trust-card .text-foreground,
  .bb-mobile-section-header h2 {
    color: var(--bb-text-primary);
  }` },
  { label: "T13 mobile fs-h2 title group", find: `  .bb-mobile-section-header h2,
  .bb-home-products-parity .bb-products-title,
  .bb-home .content-bottom.wyswyg h1,
  .bb-home .content-bottom.wyswyg h2 {`, repl: `  .bb-mobile-section-header h2,
  .bb-home .content-bottom.wyswyg h1,
  .bb-home .content-bottom.wyswyg h2 {` },
];

for (const op of ops) {
  const n = text.split(op.find).length - 1;
  if (n !== 1) throw new Error(`${op.label}: expected 1 match, found ${n}`);
  text = text.replace(op.find, op.repl);
}

// collapse 3+ consecutive newlines to 2 (one blank line)
text = text.replace(/\n{3,}/g, "\n\n");

// verify residuals
const titleRefs = (text.match(/bb-products-title|bb-section-title/g) || []).length;
const headerRefs = (text.match(/bb-products-header/g) || []).length;
const opens = (text.match(/{/g) || []).length, closes = (text.match(/}/g) || []).length;
if (opens !== closes) throw new Error(`brace imbalance { ${opens} } ${closes}`);

text = text.replace(/\n/g, "\r\n");
fs.writeFileSync(path, text);
console.log(`OK. braces ${opens}/${closes}. residual bb-products-title/bb-section-title=${titleRefs} (want 0); bb-products-header=${headerRefs} (want 2 = kicker rules)`);
