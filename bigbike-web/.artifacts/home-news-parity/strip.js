// Content-anchored strip of home-news CSS from globals.css.
// SPLICE = remove [startAnchor .. end-of-endAnchor] inclusive. REPLACE = exact 1x replace.
// Run: node .artifacts/home-news-parity/strip.js
const fs = require("fs");
const path = "app/globals.css";
let css = fs.readFileSync(path, "utf8");
fs.writeFileSync(path + ".bak", css);
const origLen = css.length;

const crlf = (s) => s.replace(/\n/g, "\r\n"); // file is uniformly CRLF

function splice(label, start, end) {
  start = crlf(start); end = crlf(end);
  const i = css.indexOf(start);
  if (i < 0) throw new Error(`SPLICE start not found: ${label}`);
  if (css.indexOf(start, i + 1) >= 0) throw new Error(`SPLICE start NOT unique: ${label}`);
  const j = css.indexOf(end, i);
  if (j < 0) throw new Error(`SPLICE end not found: ${label}`);
  let cut = j + end.length;
  // swallow following blank line(s)
  while (css[cut] === "\n") cut++;
  css = css.slice(0, i) + css.slice(cut);
  console.log("spliced", label, `(${cut - i} chars)`);
}

function replace(label, find, repl) {
  find = crlf(find); repl = crlf(repl);
  const n = css.split(find).length - 1;
  if (n !== 1) throw new Error(`REPLACE expected 1 occurrence, got ${n}: ${label}`);
  css = css.replace(find, repl);
  console.log("replaced", label);
}

// A. base .bb-home .news--* + parity overrides (5152-5259)
splice("A news base+overrides",
  ".bb-home .news--item {\n  box-shadow: 0 3px 6px rgba(0, 0, 0, .16);\n}",
  ".bb-home .bb-home-news-parity .news--item-inside p {\n  line-height: 17.5px;\n}");

// B. section padding + block-title padding (5508-5515)
splice("B section+blocktitle padding",
  ".bb-home .bb-home-news-parity {\n  padding-top: 60px;\n  padding-bottom: 0;\n}",
  ".bb-home .bb-home-news-parity .block-title {\n  padding-bottom: 40px;\n}");

// C. tablet padding group split (5590-5593)
replace("C tablet banner+news 52",
  "  .bb-home .banner-ads,\n  .bb-home .bb-home-news-parity {\n    padding-top: 52px;\n  }",
  "  .bb-home .banner-ads {\n    padding-top: 52px;\n  }");

// D. mobile padding group split + remove news block-title pb (5667-5674)
replace("D mobile banner+news 40 + news blocktitle 28",
  "  .bb-home .banner-ads,\n  .bb-home .bb-home-news-parity {\n    padding-top: 40px;\n  }\n\n  .bb-home .bb-home-news-parity .block-title {\n    padding-bottom: 28px;\n  }",
  "  .bb-home .banner-ads {\n    padding-top: 40px;\n  }");

// E. dark bg group split (6152-6160) — drop news
replace("E dark bg group",
  "  .bb-home-mobile-categories,\n  .bb-home-products-parity,\n  .bb-home .bb-experience,\n  .bb-home .bb-home-news-parity,\n  .bb-home .partner-slide,\n  .bb-home .content-bottom {\n    background: var(--bb-mobile-shell-bg);\n    color: var(--bb-text-inverse);\n  }",
  "  .bb-home-mobile-categories,\n  .bb-home-products-parity,\n  .bb-home .bb-experience,\n  .bb-home .partner-slide,\n  .bb-home .content-bottom {\n    background: var(--bb-mobile-shell-bg);\n    color: var(--bb-text-inverse);\n  }");

// F. dark title color group split (6162-6170) — drop news h2
replace("F dark title group",
  "  .bb-mobile-section-header h2,\n  .bb-home-products-parity .bb-products-title,\n  .bb-home .bb-experience-title,\n  body .bb-home .bb-home-news-parity .block-title h2 {\n    color: var(--bb-text-inverse);\n    font-size: 24px;\n    line-height: 1.05;\n    letter-spacing: 0;\n  }",
  "  .bb-mobile-section-header h2,\n  .bb-home-products-parity .bb-products-title,\n  .bb-home .bb-experience-title {\n    color: var(--bb-text-inverse);\n    font-size: 24px;\n    line-height: 1.05;\n    letter-spacing: 0;\n  }");

// G. dark mobile carousel block (6340-6398)
splice("G dark carousel block",
  "  .bb-home .bb-home-news-parity {\n    padding-top: 20px;\n  }",
  "  .bb-home .bb-home-news-parity .news--item-inside p:not(.title-post) {\n    color: var(--bb-text-inverse-muted);\n    font-size: 13px;\n    line-height: 1.35;\n  }");

// H1. reskin bg group (6622-6631) — drop news
replace("H1 reskin bg group",
  "  .bb-home,\n  .bb-home-mobile-categories,\n  .bb-home-products-parity,\n  .bb-home .bb-experience,\n  .bb-home .bb-home-news-parity,\n  .bb-home .partner-slide,\n  .bb-home .content-bottom {\n    background: var(--bb-bg-page);\n    color: var(--bb-text-primary);\n  }",
  "  .bb-home,\n  .bb-home-mobile-categories,\n  .bb-home-products-parity,\n  .bb-home .bb-experience,\n  .bb-home .partner-slide,\n  .bb-home .content-bottom {\n    background: var(--bb-bg-page);\n    color: var(--bb-text-primary);\n  }");

// H2. reskin item group (6637-6644) — drop news--item
replace("H2 reskin item group",
  "  .bb-home-mobile-category-card,\n  .bb-home-mobile-trust-card,\n  .bb-home .bb-home-news-parity .news--item,\n  .bb-home-products-parity .bb-fp-item {\n    border-color: var(--bb-border-subtle);\n    background: var(--bb-bg-surface);\n    color: var(--bb-text-primary);\n  }",
  "  .bb-home-mobile-category-card,\n  .bb-home-mobile-trust-card,\n  .bb-home-products-parity .bb-fp-item {\n    border-color: var(--bb-border-subtle);\n    background: var(--bb-bg-surface);\n    color: var(--bb-text-primary);\n  }");

// H3. reskin title color group (6646-6658) — drop 3 news selectors
replace("H3 reskin title group",
  "  .bb-home-mobile-category-card .text-foreground,\n  .bb-home-mobile-trust-card .text-foreground,\n  .bb-mobile-section-header h2,\n  .bb-home-products-parity .bb-products-title,\n  .bb-home .bb-experience-title,\n  body .bb-home .bb-home-news-parity .block-title h2,\n  .bb-home-video-title,\n  .bb-home-products-parity .bb-fp-title,\n  .bb-home-products-parity .bb-fp-title a,\n  .bb-home .bb-home-news-parity .news--item-inside .title-post,\n  .bb-home .bb-home-news-parity .news--item-inside .title-post a {\n    color: var(--bb-text-primary);\n  }",
  "  .bb-home-mobile-category-card .text-foreground,\n  .bb-home-mobile-trust-card .text-foreground,\n  .bb-mobile-section-header h2,\n  .bb-home-products-parity .bb-products-title,\n  .bb-home .bb-experience-title,\n  .bb-home-video-title,\n  .bb-home-products-parity .bb-fp-title,\n  .bb-home-products-parity .bb-fp-title a {\n    color: var(--bb-text-primary);\n  }");

// H4. reskin excerpt color group (6669-6673) — drop news
replace("H4 reskin excerpt group",
  "  .bb-home-mobile-trust-card .text-muted-foreground,\n  .bb-home .bb-experience-desc,\n  .bb-home .bb-home-news-parity .news--item-inside p:not(.title-post) {\n    color: var(--bb-text-secondary);\n  }",
  "  .bb-home-mobile-trust-card .text-muted-foreground,\n  .bb-home .bb-experience-desc {\n    color: var(--bb-text-secondary);\n  }");

// H5. reskin block-title padding-inline group (6679-6683) — drop news
replace("H5 reskin blocktitle padding-inline",
  "  .bb-home-products-parity .bb-products-header,\n  .bb-home .bb-home-news-parity .block-title,\n  .bb-home .bb-experience-header > div {\n    padding-inline: var(--bb-mobile-page-x);\n  }",
  "  .bb-home-products-parity .bb-products-header,\n  .bb-home .bb-experience-header > div {\n    padding-inline: var(--bb-mobile-page-x);\n  }");

// H6. reskin row padding-inline group (6685-6688) — drop news .row
replace("H6 reskin row padding-inline",
  "  .bb-home-products-parity .bb-fp-viewport,\n  .bb-home .bb-home-news-parity .row {\n    padding-inline: var(--bb-mobile-page-x);\n  }",
  "  .bb-home-products-parity .bb-fp-viewport {\n    padding-inline: var(--bb-mobile-page-x);\n  }");

// H7. reskin desc/inside bg group (6690-6694) — drop 2 news selectors
replace("H7 reskin desc/inside bg",
  "  .bb-home-products-parity .bb-fp-desc,\n  .bb-home .bb-home-news-parity .news--item-desc,\n  .bb-home .bb-home-news-parity .news--item-inside {\n    background: var(--bb-bg-surface);\n  }",
  "  .bb-home-products-parity .bb-fp-desc {\n    background: var(--bb-bg-surface);\n  }");

// I. max-width/fs-h2 group (7329-7340) — drop news h2
replace("I fs-h2 group",
  "  .bb-mobile-section-header h2,\n  .bb-home-products-parity .bb-products-title,\n  .bb-home .bb-experience-title,\n  body .bb-home .bb-home-news-parity .block-title h2,\n  .bb-home .content-bottom.wyswyg h1,\n  .bb-home .content-bottom.wyswyg h2 {\n    max-width: 100%;\n    font-size: var(--fs-h2);\n    line-height: 1.08;\n    overflow-wrap: normal;\n    text-wrap: balance;\n  }",
  "  .bb-mobile-section-header h2,\n  .bb-home-products-parity .bb-products-title,\n  .bb-home .bb-experience-title,\n  .bb-home .content-bottom.wyswyg h1,\n  .bb-home .content-bottom.wyswyg h2 {\n    max-width: 100%;\n    font-size: var(--fs-h2);\n    line-height: 1.08;\n    overflow-wrap: normal;\n    text-wrap: balance;\n  }");

// brace balance check
const opens = (css.match(/\{/g) || []).length, closes = (css.match(/\}/g) || []).length;
if (opens !== closes) throw new Error(`BRACE IMBALANCE: { ${opens} } ${closes}`);

// residual news-selector check
const residual = (css.match(/bb-home-news-parity/g) || []).length;
fs.writeFileSync(path, css);
console.log(`OK. removed ${origLen - css.length} chars. braces ${opens}/${closes}. residual 'bb-home-news-parity' refs: ${residual}`);
