// CRLF-aware final orphan strip: 17 dead bb-* classes (0 non-CSS refs, no
// dynamic construction — audited). Standalone rules deleted; mixed groups split.
// bb-news-excerpt / bb-pdp-review-comment survive ONLY in a kept design-rationale
// comment (no rule). Asserts each anchor occurs exactly once + brace balance.
const fs = require("fs");
const path = "app/globals.css";
let css = fs.readFileSync(path, "utf8");
const before = css;
const L = (...l) => l.join("\r\n");

const ops = [
  // A. standalone .bb-product-tag.new (#1) + orphan wishlist comment
  {
    find: L(
      ".bb-product-tag.new {",
      "  background: var(--bb-color-black);",
      "  color: #fff;",
      "}",
      "",
      "/* Wishlist heart on product card - overlay on white */",
      "",
      "",
    ),
    repl: "",
  },
  // B. standalone .bb-product-brand (#1)
  {
    find: L(
      ".bb-product-brand {",
      "  color: var(--bb-color-red-700);",
      "  font-family: var(--bb-font-cta);",
      "  letter-spacing: 0;",
      "  text-transform: uppercase;",
      "}",
      "",
      "",
    ),
    repl: "",
  },
  // C. .bb-product-card-link + :focus-visible (between live card and image)
  {
    find: L(
      ".bb-product-card-link {",
      "  position: absolute;",
      "  inset: 0;",
      "  z-index: 1;",
      "  text-decoration: none;",
      "}",
      "",
      ".bb-product-card-link:focus-visible {",
      "  outline: 2px solid var(--bb-brand-primary);",
      "  outline-offset: -2px;",
      "}",
      "",
      "",
    ),
    repl: "",
  },
  // D. contiguous dead block brand/rating/price/name/.../tag.new (2626-2691)
  {
    find: L(
      ".bb-product-brand {",
      "  font-size: 14px;",
      "  letter-spacing: 0.12em;",
      "}",
      "",
      ".bb-product-rating {",
      "  font-size: 14px;",
      "  color: var(--bb-text-brand);",
      "  letter-spacing: 0.1em;",
      "}",
      "",
      ".bb-product-price {",
      "  display: flex;",
      "  align-items: baseline;",
      "  gap: 8px;",
      "  margin-top: 6px;",
      "}",
      "",
      ".bb-product-name {",
      "  color: var(--bb-text-inverse);",
      "  font-family: var(--bb-font-display);",
      "  font-size: var(--fs-h4);",
      "  font-weight: 600;",
      "  line-height: 20px;",
      "  letter-spacing: 0;",
      "  text-transform: uppercase;",
      "}",
      "",
      "/* WP product title: Barlow Condensed 16px, no uppercase. Override white from group rule above. */",
      ".bb-product-name {",
      "  font-size: var(--fs-h4);",
      "  text-transform: none;",
      "  color: var(--bb-color-black);",
      "}",
      "",
      ".bb-product-price b {",
      "  color: var(--bb-text-brand);",
      "  font-family: var(--bb-font-cta);",
      "  font-size: var(--bb-text-base);",
      "  font-weight: 600;",
      "  line-height: 24px;",
      "}",
      "",
      ".bb-product-price s {",
      "  color: #6f6f6f;",
      "}",
      "",
      "/* Price on white card: brand red (#ff0c09) = 3.92:1 — fails WCAG AA for 14px text.",
      "   red-700 (#cc0906) = 5.77:1, passes. */",
      ".bb-product-price b {",
      "  color: var(--bb-color-red-700);",
      "}",
      "",
      ".bb-product-tag {",
      "  background: var(--bb-action-primary);",
      "  color: #ffffff;",
      "  border-radius: 0;",
      "  font-family: var(--bb-font-cta);",
      "  font-weight: 600;",
      "  letter-spacing: 0;",
      "}",
      "",
      ".bb-product-tag.new {",
      "  background: #000000;",
      "  color: #ffffff;",
      "}",
      "",
      "",
    ),
    repl: "",
  },
  // E. split: drop dead .bb-product-name from the clamp group, keep .bb-category-body h3
  {
    find: L("  .bb-product-name,", "  .bb-category-body h3 {"),
    repl: "  .bb-category-body h3 {",
  },
  // F. split round-shape :is() group — drop 8 dead members, keep live ones
  {
    find:
      ".bb-theme :is(.bb-round, .bb-site-header .bb-cart-badge, .bb-wishlist-btn, .bb-contact-icon, .bb-mini-thumb .qty-badge, .bb-account-avatar, .bb-order-tl-dot, .bb-timeline-dot, .bb-success-icon, .swiper-pagination-bullet, .bb-slider-dot, .bb-video-play-btn-ring, .b24-widget-button-block, .b24-widget-button-inner-block, .b24-widget-button-inner-mask) {",
    repl:
      ".bb-theme :is(.bb-round, .bb-site-header .bb-cart-badge, .bb-account-avatar, .swiper-pagination-bullet, .b24-widget-button-block, .b24-widget-button-inner-block, .b24-widget-button-inner-mask) {",
  },
  // G. remove empty @media holding only the stale .bb-news-heading comment
  {
    find: L(
      "@media (max-width: 767px) {",
      "",
      "  /* .bb-news-heading dùng var(--fs-h2) fluid (sàn 24px ở mobile) — đã gỡ override @767. */",
      "}",
      "",
      "",
    ),
    repl: "",
  },
];

ops.forEach((op, i) => {
  const n = css.split(op.find).length - 1;
  if (n !== 1) throw new Error(`op ${String.fromCharCode(65 + i)}: expected 1 match, found ${n}`);
  css = css.replace(op.find, op.repl);
});

const bal = (s) => (s.match(/{/g) || []).length - (s.match(/}/g) || []).length;
if (bal(before) !== bal(css)) throw new Error(`brace balance changed: ${bal(before)} -> ${bal(css)}`);

// residual: the 15 fully-removed tokens must be absent; the 2 comment-only survive (count 1 each)
const gone = [
  "bb-contact-icon", "bb-mini-thumb", "bb-news-heading", "bb-order-tl-dot",
  "bb-product-brand", "bb-product-card-link", "bb-product-name", "bb-product-price",
  "bb-product-rating", "bb-product-tag", "bb-slider-dot", "bb-success-icon",
  "bb-timeline-dot", "bb-video-play-btn-ring", "bb-wishlist-btn",
];
for (const t of gone) {
  if (css.includes("." + t)) throw new Error(`residual selector for ${t}`);
}
for (const t of ["bb-news-excerpt", "bb-pdp-review-comment"]) {
  const c = css.split("." + t).length - 1;
  if (c !== 1) throw new Error(`${t}: expected 1 (comment only), found ${c}`);
}

fs.writeFileSync(path, css);
console.log(`OK. ${before.length - css.length} bytes removed. brace balance ${bal(css)}.`);
