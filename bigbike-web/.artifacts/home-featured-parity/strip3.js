// Commit 3 — carousel chrome. Migrated bb-fp-carousel/viewport/arrow/pagination + bullets
// to inline Tailwind in FeaturedProductsCarousel.tsx (no JS/e2e hooks). KEEP bb-fp-page-track
// (JS-driven translate3d mechanism) + .bb-article-pagination (separate carousel) + the
// swiper-wrapper/slide rules (out of scope). Remove only the migrated chrome rules.
const fs = require("fs");
const path = process.argv[2];
let text = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const ops = [
  // base pagination + bullets (+ comment)
  { label: "S1 base pagination", find: `/* Pagination dots - kifu WP videos-slide (active dot dAi 'o) */
.bb-fp-pagination {
  display: flex;
  justify-content: center;
  margin-top: 60px;
  gap: 5px;
}
.bb-fp-pagination .swiper-pagination-bullet {
  width: 10px;
  height: 10px;
  background: #ffffff;
  opacity: 1;
  transition: all 0.3s ease;
  border-radius: 50%;
  margin: 0 5px;
  display: inline-block;
  cursor: pointer;
}
.bb-fp-pagination .swiper-pagination-bullet-active {
  width: 20px;
  background: var(--bb-action-primary);
  border-radius: 20px;
}
` },
  // base @media pagination margin (+ comment)
  { label: "S2 base mobile pagination", find: `/* Mobile: an nAt prev/next ('A cA Y @media pointer:coarse), bo margin top card */
@media (max-width: 767px) {
  .bb-fp-pagination { margin-top: 20px; }
}
` },
  // home carousel + viewport
  { label: "S3 home carousel+viewport", find: `.bb-home-products-parity .bb-fp-carousel {
  position: relative;
}

.bb-home-products-parity .bb-fp-viewport {
  overflow: hidden;
}

` },
  // home arrow + arrow:hover
  { label: "S4 home arrow", find: `.bb-home-products-parity .bb-fp-arrow {
  color: #000;
}

.bb-home-products-parity .bb-fp-arrow:hover {
  color: #000;
}

` },
  // home pagination + bullets
  { label: "S5 home pagination+bullets", find: `.bb-home-products-parity .bb-fp-pagination {
  position: relative;
  display: flex;
  justify-content: center;
  margin-top: 60px;
}

.bb-home-products-parity .bb-fp-pagination .swiper-pagination-bullet {
  width: 10px;
  height: 10px;
  margin: 0 5px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #cecece;
  opacity: 1;
  transition: all 0.3s ease;
}

.bb-home-products-parity .bb-fp-pagination .swiper-pagination-bullet-active {
  width: 20px;
  border-radius: 100px;
  background: var(--bb-action-primary);
}

` },
  // @media>=1536 pagination margin
  { label: "S6 1536 pagination", find: `@media (min-width: 1536px) {
  .bb-home-products-parity .bb-fp-pagination {
    margin-top: 40px;
  }
}

` },
  // spacing-pass pagination margin
  { label: "S7 spacing pagination", find: `.bb-home-products-parity .bb-fp-pagination {
  margin-top: 60px;
}

` },
  // @media<=767 spacing pagination margin
  { label: "S8 mobile spacing pagination", find: `  .bb-home-products-parity .bb-fp-pagination {
    margin-top: 20px;
  }

` },
  // mobile viewport + scrollbar
  { label: "S9 mobile viewport", find: `  .bb-home-products-parity .bb-fp-viewport {
    overflow-x: auto;
    padding: 0 14px 6px;
    scrollbar-width: none;
  }

  .bb-home-products-parity .bb-fp-viewport::-webkit-scrollbar {
    display: none;
  }

` },
  // mobile arrow,pagination display:none
  { label: "S10 mobile hide arrow+pagination", find: `  .bb-home-products-parity .bb-fp-arrow,
  .bb-home-products-parity .bb-fp-pagination {
    display: none;
  }

` },
  // mobile carousel position + ::after
  { label: "S11 mobile carousel+after", find: `  .bb-home-products-parity .bb-fp-carousel {
    position: relative;
  }

  .bb-home-products-parity .bb-fp-carousel::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 6px;
    width: 48px;
    background: linear-gradient(to right, transparent, var(--bb-bg-page));
    pointer-events: none;
    z-index: 1;
  }

` },
  // mobile viewport padding-inline
  { label: "S12 mobile viewport padding-inline", find: `  .bb-home-products-parity .bb-fp-viewport {
    padding-inline: var(--bb-mobile-page-x);
  }

` },
];

for (const op of ops) {
  const n = text.split(op.find).length - 1;
  if (n !== 1) throw new Error(`${op.label}: expected 1 match, found ${n}`);
  text = text.replace(op.find, "");
}

text = text.replace(/\n{3,}/g, "\n\n");

const fpRefs = (text.match(/bb-fp-[a-z-]+/g) || []);
const counts = {};
for (const r of fpRefs) counts[r] = (counts[r] || 0) + 1;
const opens = (text.match(/{/g) || []).length, closes = (text.match(/}/g) || []).length;
if (opens !== closes) throw new Error(`brace imbalance { ${opens} } ${closes}`);

text = text.replace(/\n/g, "\r\n");
fs.writeFileSync(path, text);
console.log(`OK. braces ${opens}/${closes}. residual bb-fp-*:`, counts, "(want only bb-fp-page-track)");
