// Strip the archive-only filter-sidebar CSS (CatalogFilters migrated to inline Tailwind).
// 5 spans. MUST preserve the interleaved `html.overlay` + `body:has(.bb-search-results-page)`
// rules and the grid/toolbar rules that share the @media blocks. CRLF-aware + brace-checked.
const fs = require("fs");
const PATH = "c:/Users/ADMIN/OneDrive/Documents/bigbike/bigbike-web/app/globals.css";
let css = fs.readFileSync(PATH, "utf8");
const before = css.length;
const nl = (s) => s.replace(/\n/g, "\r\n");

function removeSpan(label, start, end) {
  start = nl(start);
  end = nl(end);
  const i = css.indexOf(start);
  if (i === -1) throw new Error(`[${label}] start not found`);
  if (css.indexOf(start, i + 1) !== -1) throw new Error(`[${label}] start NOT unique`);
  const j = css.indexOf(end, i);
  if (j === -1) throw new Error(`[${label}] end not found after start`);
  const cut = css.slice(i, j + end.length);
  const o = (cut.match(/{/g) || []).length, c = (cut.match(/}/g) || []).length;
  if (o !== c) throw new Error(`[${label}] span unbalanced ${o}/${c}`);
  let k = i;
  if (css.slice(0, k).endsWith("\r\n\r\n")) k -= 2;
  css = css.slice(0, k) + css.slice(j + end.length);
  console.log(`[${label}] removed ${cut.length} chars (${o} rules)`);
}

// A: drawer container + panel + overlay + mobile-title (desktop block). Stop before html.overlay.
removeSpan(
  "A-drawer-base",
  ".bb-product-archive .sidebar-wrap-product {\n  display: block;\n}",
  ".bb-product-archive .mobile-sidebar-title .close-btn {\n  position: absolute;\n  top: 8px;\n  right: 0;\n  border: 0;\n  background: transparent;\n  color: #000000;\n  font-size: 24px;\n  line-height: 1;\n  cursor: pointer;\n}",
);

// B: widget + category list (stop at the children connector, BEFORE the body:has search rule).
removeSpan(
  "B-widget-categories",
  ".bb-product-archive .widget {\n  margin-bottom: 30px;",
  ".bb-product-archive .widget--body .product-categories li.current-cat-parent .children::after,\n.bb-product-archive .widget--body .product-categories li.current-cat.active .children::after {\n  content: \"\";\n  position: absolute;\n  top: 15px;\n  left: 9px;\n  width: 1px;\n  height: calc(100% - 30px);\n  border: dashed 1px #6f6f6f;\n}",
);

// C: layered-nav list + count badge + visible-clamp + show-more (AFTER the body:has search rule).
removeSpan(
  "C-layered-showmore",
  ".bb-product-archive .woocommerce-widget-layered-nav-list li {\n  position: relative;\n  padding: 15px 0;\n}",
  ".bb-product-archive .widget--body .show-more i {\n  margin-left: 6px;\n}",
);

// D: responsive (<=767) drawer block (keep the surrounding grid/toolbar rules in that @media).
removeSpan(
  "D-drawer-mobile",
  "  .bb-product-archive .sidebar-wrap-product {\n    display: none;\n    position: fixed;",
  "  .bb-product-archive .mobile-sidebar-title {\n    display: block;\n  }",
);

// E: second responsive block re-overrides (drawer width/overlay/title/widget). Keep bb-wp-pdp after.
removeSpan(
  "E-drawer-mobile2",
  "  .bb-product-archive .sidebar-wrap-product .wrapper-product {\n    width: min(86vw, 340px);",
  "  .bb-product-archive .widget {\n    margin-bottom: 20px;\n    padding-bottom: 16px;\n  }",
);

// ---- preserve checks ----
if (!css.includes(nl("html.overlay {\n  overflow: hidden;\n}"))) throw new Error("LOST html.overlay rule!");
if (!css.includes("body:has(.bb-search-results-page)")) throw new Error("LOST body:has(search) rule!");
// ---- leftover checks (archive-only sidebar selectors must be gone; blog .widget stays) ----
for (const sel of [
  ".bb-product-archive .sidebar-wrap-product",
  ".bb-product-archive .mobile-sidebar-title",
  ".bb-product-archive .widget",
  ".bb-product-archive .woocommerce-widget-layered-nav-list",
  "product-categories",
  "bb-brand-filter-label",
  "widget_filter_by_brand",
  ".show-more",
]) {
  if (css.includes(sel)) throw new Error(`leftover sidebar selector: ${sel}`);
}
const o = (css.match(/{/g) || []).length, c = (css.match(/}/g) || []).length;
if (o !== c) throw new Error(`file unbalanced ${o}/${c}`);
fs.writeFileSync(PATH, css, "utf8");
console.log(`DONE ${before} -> ${css.length} (-${before - css.length}). braces ${o}/${c}.`);
