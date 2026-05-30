#!/usr/bin/env node
/**
 * BigBike Web — Typography Runtime Computed-Style Verification
 *
 * Visits each route × viewport, queries required selectors, dumps
 * window.getComputedStyle() for all required CSS properties, and
 * compares against the typography baseline.
 *
 * BASELINE (updated): migrated to the MD typography system —
 * docs/TYPOGRAPHY.md (superfamily Barlow). Display/heading expect
 * "Barlow Condensed" (Oswald removed); body is fluid 16→18px.
 * Selector-level px sizes (.bb-section-title, .bb-product-name, …)
 * are still on their WP-parity values pending incremental migration.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 node scripts/verify-typography-computed.mjs
 *
 * Requires:
 *   npm install --save-dev @playwright/test
 *   npx playwright install chromium
 */

import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "../..");
const OUTPUT_DIR = join(REPO_ROOT, "docs/audits/runtime");

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// ─── Viewports ───────────────────────────────────────────────────────────────

const VIEWPORTS = [
  { label: "375px", width: 375, height: 812, isMobile: true },
  { label: "768px", width: 768, height: 1024, isMobile: false },
  { label: "1440px", width: 1440, height: 900, isMobile: false },
];

// ─── Routes ──────────────────────────────────────────────────────────────────
// Backend may not be running — pages that require API data will render
// with empty/skeleton content; selectors in those pages may be MISSING.

const ROUTES = [
  { path: "/", label: "homepage" },
  { path: "/san-pham", label: "product-listing" },
  { path: "/danh-muc-san-pham", label: "category-listing" },
  { path: "/product/ls2-koku-kidney-belt", label: "product-detail" },
  { path: "/tim-kiem", label: "search" },
  { path: "/tin-tuc", label: "news-list" },
  { path: "/tin-tuc/tai-nghe-bluetooth-5-3-la-gi", label: "news-detail" },
  { path: "/lien-he", label: "contact" },
  { path: "/dang-nhap", label: "login" },
  { path: "/gioi-thieu", label: "about-static" },
  // Phase 2 additions: routes that render .bb-btn-primary without backend data
  { path: "/bao-hanh", label: "warranty" },
  { path: "/gio-hang", label: "cart" },
];

// ─── CSS Properties to dump ──────────────────────────────────────────────────

const DUMP_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "color",
  "letterSpacing",
  "textTransform",
  "textDecorationLine",
  "textDecorationColor",
  "textDecorationThickness",
  "textAlign",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "textOverflow",
];

// kebab-case versions for output JSON keys
const PROP_KEBAB = {
  fontFamily: "font-family",
  fontSize: "font-size",
  fontWeight: "font-weight",
  fontStyle: "font-style",
  lineHeight: "line-height",
  color: "color",
  letterSpacing: "letter-spacing",
  textTransform: "text-transform",
  textDecorationLine: "text-decoration-line",
  textDecorationColor: "text-decoration-color",
  textDecorationThickness: "text-decoration-thickness",
  textAlign: "text-align",
  whiteSpace: "white-space",
  wordBreak: "word-break",
  overflowWrap: "overflow-wrap",
  textOverflow: "text-overflow",
};

// ─── Expected values (WP-parity baseline) ────────────────────────────────────
// matchType:
//   "exact"    → actual === expected
//   "contains" → actual.toLowerCase().includes(expected.toLowerCase())
//   "approx"   → |parseFloat(actual) - parseFloat(expected)| <= tolerance (px)
//
// viewport: undefined = all viewports; or "375px"|"768px"|"1440px" for overrides

const EXPECTED_CHECKS = [
  // ── body ──────────────────────────────────────────────────────────────────
  {
    selector: "body",
    label: "body",
    checks: [
      {
        prop: "font-size",
        expected: "17",
        matchType: "approx",
        tolerance: 1.6,
        note: "MD fluid --fs-body: 16px @375 → 18px @1440 (rem-based)",
      },
      {
        prop: "color",
        expected: "rgb(0, 0, 0)",
        matchType: "exact",
        note: "WP main.css body{color:#000}",
      },
      {
        prop: "line-height",
        expected: "25.5",
        matchType: "approx",
        tolerance: 2,
        note: "line-height 1.5 × fluid body (16→18px) → 24→27px",
      },
      {
        prop: "font-family",
        expected: "Barlow",
        matchType: "contains",
        note: "WP main.css body{font-family:Barlow}",
      },
      {
        prop: "font-weight",
        expected: "400",
        matchType: "exact",
        note: "WP default body weight",
      },
    ],
  },

  // ── a (generic link) ──────────────────────────────────────────────────────
  {
    selector: "a",
    label: "generic-link",
    checks: [
      {
        prop: "font-family",
        expected: "Barlow",
        matchType: "contains",
        note: "Inherits from body",
      },
    ],
  },

  // ── header nav item ───────────────────────────────────────────────────────
  // Use :not(.active) to skip the active nav item which correctly shows
  // brand-primary color (#ff0c09) instead of white — that is intended behavior.
  {
    selector: ".bb-navigation-item:not(.active) > a",
    label: "nav-item-link",
    checks: [
      {
        prop: "font-family",
        expected: "Barlow Condensed",
        matchType: "contains",
        note: "WP main.css header .navigation{font-family:Barlow Condensed}",
      },
      {
        prop: "font-size",
        expected: "18.288",
        matchType: "approx",
        tolerance: 1,
        note: "WP 1.143rem × 16px = 18.288px",
      },
      {
        prop: "font-weight",
        expected: "600",
        matchType: "exact",
        note: "WP main.css nav--item>a{font-weight:600}",
      },
      {
        prop: "text-transform",
        expected: "uppercase",
        matchType: "exact",
        note: "WP main.css nav--item>a{text-transform:uppercase}",
      },
      {
        prop: "color",
        expected: "rgb(255, 255, 255)",
        matchType: "exact",
        note: "WP nav links are white on dark header (non-active items)",
      },
    ],
  },

  // ── sub-menu item link ────────────────────────────────────────────────────
  // Element is in DOM but visibility:hidden when not hovered.
  // getComputedStyle() still returns correct font/text props.
  {
    selector: ".bb-sub-menu-item > a",
    label: "sub-menu-link",
    checks: [
      {
        prop: "font-family",
        expected: "Barlow Condensed",
        matchType: "contains",
        note: "WP custom.css sub-menu li a{font-family:Oswald}",
      },
      {
        prop: "font-size",
        expected: "14px",
        matchType: "exact",
        note: "WP custom.css sub-menu li a{font-size:14px}",
      },
      {
        prop: "font-weight",
        expected: "600",
        matchType: "exact",
        note: "WP custom.css sub-menu li a{font-weight:600}",
      },
      {
        prop: "color",
        expected: "rgb(111, 111, 111)",
        matchType: "exact",
        note: "WP custom.css sub-menu li a{color:#6f6f6f}",
      },
    ],
  },

  // ── product card title ────────────────────────────────────────────────────
  {
    selector: ".bb-product-name",
    label: "product-card-name",
    checks: [
      {
        prop: "font-family",
        expected: "Barlow Condensed",
        matchType: "contains",
        note: "WP custom.css .product--item-title{font-family:Oswald}",
      },
      {
        prop: "font-size",
        expected: "16px",
        matchType: "exact",
        note: "WP custom.css .product--item-title a{font-size:16px}",
      },
      {
        prop: "font-weight",
        expected: "600",
        matchType: "exact",
        note: "WP custom.css",
      },
      {
        prop: "text-transform",
        expected: "none",
        matchType: "exact",
        note: "WP product titles have no text-transform",
      },
    ],
  },

  // ── product price ─────────────────────────────────────────────────────────
  {
    selector: ".bb-product-price b",
    label: "product-price-current",
    checks: [
      {
        prop: "font-family",
        expected: "Barlow Condensed",
        matchType: "contains",
        note: "WP custom.css .product--item-price{font-family:Oswald}",
      },
      {
        prop: "font-size",
        expected: "14px",
        matchType: "exact",
        note: "WP custom.css .product--item-price{font-size:14px}",
      },
      {
        prop: "font-weight",
        expected: "600",
        matchType: "exact",
        note: "WP custom.css",
      },
      {
        prop: "color",
        expected: "rgb(255, 12, 9)",
        matchType: "exact",
        note: "WP product price color #ff0c09",
      },
    ],
  },

  // ── section title ─────────────────────────────────────────────────────────
  {
    selector: ".bb-section-title",
    label: "section-title",
    checks: [
      {
        prop: "font-family",
        expected: "Barlow Condensed",
        matchType: "contains",
        note: "WP custom.css .block-title h3{font-family:Oswald}",
      },
      {
        prop: "font-size",
        expected: "35px",
        matchType: "exact",
        viewport: ["768px", "1440px"],
        note: "WP desktop: 35px",
      },
      {
        prop: "font-size",
        expected: "24px",
        matchType: "exact",
        viewport: ["375px"],
        note: "WP mobile max-767px: 24px",
      },
      {
        prop: "font-weight",
        expected: "600",
        matchType: "exact",
        note: "WP .block-title h3{font-weight:600}",
      },
      {
        prop: "text-transform",
        expected: "uppercase",
        matchType: "exact",
        note: "WP uppercase on section titles",
      },
    ],
  },

  // ── breadcrumb container ──────────────────────────────────────────────────
  {
    selector: ".bb-breadcrumb",
    label: "breadcrumb",
    checks: [
      {
        prop: "font-size",
        expected: "16px",
        matchType: "exact",
        note: "WP breadcrumb inherits body 16px; no explicit size",
      },
      {
        prop: "text-transform",
        expected: "none",
        matchType: "exact",
        note: "WP no text-transform on breadcrumb",
      },
      {
        prop: "letter-spacing",
        expected: "normal",
        matchType: "exact",
        note: "WP no letter-spacing on breadcrumb; CSS letter-spacing:0 → Chromium computes 'normal' (0 ≡ normal in Chrome)",
      },
      {
        prop: "color",
        expected: "rgb(113, 113, 113)",
        matchType: "exact",
        note: "WP custom.css breadcrumb span{color:#717171}",
      },
    ],
  },

  // ── breadcrumb link ───────────────────────────────────────────────────────
  {
    selector: ".bb-breadcrumb a",
    label: "breadcrumb-link",
    checks: [
      {
        prop: "color",
        expected: "rgb(113, 113, 113)",
        matchType: "exact",
        note: "WP custom.css breadcrumb a{color:#717171}",
      },
      {
        prop: "font-weight",
        expected: "600",
        matchType: "exact",
        note: "WP custom.css breadcrumb a{font-weight:600}",
      },
    ],
  },

  // ── footer column heading h3 ──────────────────────────────────────────────
  {
    selector: ".bb-footer .bb-footer-col h3",
    label: "footer-col-heading",
    checks: [
      {
        prop: "font-family",
        expected: "Barlow Condensed",
        matchType: "contains",
        note: "Footer section headings use --bb-font-display (Oswald)",
      },
      {
        prop: "font-size",
        expected: "16px",
        matchType: "exact",
        note: "Footer heading 16px",
      },
      {
        prop: "font-weight",
        expected: "600",
        matchType: "exact",
        note: "Footer heading 600",
      },
    ],
  },

  // ── footer brand heading h2 ───────────────────────────────────────────────
  {
    selector: ".bb-footer .bb-footer-brand h2",
    label: "footer-brand-heading",
    checks: [
      {
        prop: "font-family",
        expected: "Barlow Condensed",
        matchType: "contains",
        note: "Footer brand heading uses --bb-font-display (Oswald)",
      },
      {
        prop: "font-weight",
        expected: "600",
        matchType: "exact",
        note: "Footer brand heading 600",
      },
    ],
  },

  // ── footer link ───────────────────────────────────────────────────────────
  {
    selector: ".bb-footer a",
    label: "footer-link",
    checks: [
      {
        prop: "font-size",
        expected: "14px",
        matchType: "exact",
        note: "Footer links 14px",
      },
      {
        prop: "color",
        expected: "rgb(206, 206, 206)",
        matchType: "exact",
        note: "Footer links #cecece",
      },
    ],
  },

  // ── primary button ────────────────────────────────────────────────────────
  {
    selector: ".bb-button",
    label: "button-primary",
    checks: [
      {
        prop: "font-family",
        expected: "Barlow Condensed",
        matchType: "contains",
        note: "WP .btn{font-family:Barlow Condensed}",
      },
      {
        prop: "font-size",
        expected: "16px",
        matchType: "exact",
        note: "Button 16px",
      },
      {
        prop: "font-weight",
        expected: "600",
        matchType: "exact",
        note: "Button weight 600",
      },
      {
        prop: "text-transform",
        expected: "uppercase",
        matchType: "exact",
        note: "Button uppercase",
      },
    ],
  },

  // ── bb-btn-primary (if different element) ─────────────────────────────────
  {
    selector: ".bb-btn-primary",
    label: "bb-btn-primary",
    checks: [
      {
        prop: "font-family",
        expected: "Barlow Condensed",
        matchType: "contains",
        note: "WP .btn{font-family:Barlow Condensed}",
      },
      {
        prop: "text-transform",
        expected: "uppercase",
        matchType: "exact",
        note: "Button uppercase",
      },
    ],
  },

  // ── form input ────────────────────────────────────────────────────────────
  // Login uses input[type='text'] + class bb-input (no email-type inputs exist).
  // .bb-input is the correct selector for styled form inputs.
  {
    selector: ".bb-input",
    label: "form-input",
    checks: [
      {
        prop: "font-size",
        expected: "16px",
        matchType: "exact",
        note: "Form input font-size 16px (WP parity); bb-input is the styled input class",
      },
    ],
  },

  // ── page h1 ───────────────────────────────────────────────────────────────
  {
    selector: ".bb-page-head h1",
    label: "page-h1",
    checks: [
      {
        prop: "font-family",
        expected: "Barlow Condensed",
        matchType: "contains",
        note: "Page title uses --bb-font-heading (Oswald after remap)",
      },
      {
        prop: "font-weight",
        expected: "600",
        matchType: "exact",
        note: "Page h1 weight 600",
      },
    ],
  },

  // ── h2 (product detail related-products title) ────────────────────────────
  // .bb-page h2 was too broad — it matches empty-state h2s that inherit body
  // font (Barlow). Use the specific .bb-pdp-related-title class instead.
  {
    selector: ".bb-pdp-related-title",
    label: "pdp-related-title",
    checks: [
      {
        prop: "font-family",
        expected: "Barlow Condensed",
        matchType: "contains",
        note: "Related products title uses --bb-font-display (Oswald)",
      },
    ],
  },
];

// ─── Comparison helpers ───────────────────────────────────────────────────────

/**
 * @param {string} actual
 * @param {string} expected
 * @param {"exact"|"contains"|"approx"} matchType
 * @param {number} [tolerance]
 */
function compare(actual, expected, matchType, tolerance = 0.5) {
  if (!actual || actual === "") return { pass: false, reason: "empty actual" };

  switch (matchType) {
    case "exact":
      return {
        pass: actual.trim() === expected.trim(),
        reason:
          actual.trim() === expected.trim()
            ? "exact match"
            : `got "${actual.trim()}"`,
      };
    case "contains": {
      const pass = actual.toLowerCase().includes(expected.toLowerCase());
      return {
        pass,
        reason: pass ? "contains match" : `"${expected}" not found in "${actual}"`,
      };
    }
    case "approx": {
      const aVal = parseFloat(actual);
      const eVal = parseFloat(expected);
      if (isNaN(aVal) || isNaN(eVal)) {
        return { pass: false, reason: `non-numeric: actual="${actual}"` };
      }
      const diff = Math.abs(aVal - eVal);
      return {
        pass: diff <= tolerance,
        reason:
          diff <= tolerance
            ? `≈${aVal}px (±${diff.toFixed(3)}px)`
            : `got ${aVal}px, expected ≈${eVal}px (diff=${diff.toFixed(3)}px)`,
      };
    }
    default:
      return { pass: false, reason: `unknown matchType: ${matchType}` };
  }
}

// ─── Main verification logic ──────────────────────────────────────────────────

async function verifyPage(page, route, viewport) {
  const results = [];

  for (const spec of EXPECTED_CHECKS) {
    const selector = spec.selector;

    // Check element exists in DOM
    let elementExists = false;
    try {
      const el = page.locator(selector).first();
      const count = await el.count();
      elementExists = count > 0;
    } catch {
      elementExists = false;
    }

    if (!elementExists) {
      // Record a single MISSING_SELECTOR row covering all checks
      results.push({
        route: route.path,
        routeLabel: route.label,
        viewport: viewport.label,
        selector,
        selectorLabel: spec.label,
        property: "*",
        expected: "*",
        actual: null,
        status: "MISSING_SELECTOR",
        reason: "selector not found in DOM",
        note: "",
      });
      continue;
    }

    // Dump all DUMP_PROPS for raw output
    const rawStyles = await page.evaluate(
      ({ sel, props }) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        /** @type {Record<string,string>} */
        const out = {};
        for (const p of props) {
          out[p] = cs[p] ?? "";
        }
        return out;
      },
      { sel: selector, props: DUMP_PROPS }
    );

    if (!rawStyles) {
      results.push({
        route: route.path,
        routeLabel: route.label,
        viewport: viewport.label,
        selector,
        selectorLabel: spec.label,
        property: "*",
        expected: "*",
        actual: null,
        status: "MISSING_SELECTOR",
        reason: "querySelector returned null (race/timing)",
        note: "",
      });
      continue;
    }

    // Run each check
    for (const chk of spec.checks) {
      // Skip viewport-specific checks that don't apply here
      if (chk.viewport && !chk.viewport.includes(viewport.label)) {
        continue;
      }

      const propCamel = Object.entries(PROP_KEBAB).find(
        ([, v]) => v === chk.prop
      )?.[0];
      const actual = propCamel ? rawStyles[propCamel] ?? "" : "";
      const { pass, reason } = compare(
        actual,
        chk.expected,
        chk.matchType ?? "exact",
        chk.tolerance
      );

      results.push({
        route: route.path,
        routeLabel: route.label,
        viewport: viewport.label,
        selector,
        selectorLabel: spec.label,
        property: chk.prop,
        expected: chk.expected,
        actual,
        status: pass ? "PASS" : "FAIL",
        reason,
        note: chk.note ?? "",
      });
    }

    // Also dump ALL properties as raw reference (no check)
    results.push({
      route: route.path,
      routeLabel: route.label,
      viewport: viewport.label,
      selector,
      selectorLabel: spec.label,
      property: "_raw_dump",
      expected: null,
      actual: JSON.stringify(
        Object.fromEntries(
          DUMP_PROPS.map((p) => [PROP_KEBAB[p], rawStyles[p]])
        )
      ),
      status: "DUMP",
      reason: "",
      note: "raw getComputedStyle dump",
    });
  }

  return results;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n[typography-verify] BASE_URL = ${BASE_URL}`);
  console.log(`[typography-verify] Viewports: ${VIEWPORTS.map((v) => v.label).join(", ")}`);
  console.log(`[typography-verify] Routes: ${ROUTES.map((r) => r.label).join(", ")}\n`);

  // Check server is reachable
  try {
    const res = await fetch(`${BASE_URL}/`);
    console.log(`[typography-verify] Server reachable → HTTP ${res.status}`);
  } catch {
    console.error(`[typography-verify] ERROR: Server not reachable at ${BASE_URL}`);
    console.error(`  Start it with: npm start  (production)  or  npm run dev  (development)`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const allResults = [];

  try {
    for (const viewport of VIEWPORTS) {
      console.log(`\n── Viewport ${viewport.label} ─────────────────────────`);
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        // Use a real user agent to avoid bot-detection blocking CSS
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });
      const page = await context.newPage();

      for (const route of ROUTES) {
        process.stdout.write(`  ${route.label.padEnd(20)} → `);
        try {
          await page.goto(`${BASE_URL}${route.path}`, {
            // Use "load" instead of "networkidle":
            // networkidle never completes when backend API is not running
            // (pending XHR requests keep the network active indefinitely).
            waitUntil: "load",
            timeout: 20000,
          });
          // Wait for CSS custom properties + fonts to settle
          await page.waitForTimeout(1200);

          const results = await verifyPage(page, route, viewport);
          allResults.push(...results);

          const checks = results.filter(
            (r) => r.status === "PASS" || r.status === "FAIL"
          );
          const passes = checks.filter((r) => r.status === "PASS").length;
          const fails = checks.filter((r) => r.status === "FAIL").length;
          const missing = results.filter(
            (r) => r.status === "MISSING_SELECTOR"
          ).length;
          console.log(
            `PASS=${passes} FAIL=${fails} MISS=${missing}`
          );
        } catch (err) {
          console.log(`ERROR: ${err.message}`);
          allResults.push({
            route: route.path,
            routeLabel: route.label,
            viewport: viewport.label,
            selector: "*",
            selectorLabel: "*",
            property: "*",
            expected: "*",
            actual: null,
            status: "ERROR",
            reason: String(err.message),
            note: "page navigation failed",
          });
        }
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  // ── Write JSON output ──────────────────────────────────────────────────────
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  const checks = allResults.filter(
    (r) => r.status === "PASS" || r.status === "FAIL"
  );
  const summary = {
    total: checks.length,
    pass: checks.filter((r) => r.status === "PASS").length,
    fail: checks.filter((r) => r.status === "FAIL").length,
    missing_selector: allResults.filter((r) => r.status === "MISSING_SELECTOR")
      .length,
    error: allResults.filter((r) => r.status === "ERROR").length,
  };

  const output = {
    runAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary,
    // Separate arrays for easy reading
    fails: allResults.filter((r) => r.status === "FAIL"),
    missing: allResults.filter((r) => r.status === "MISSING_SELECTOR"),
    passes: allResults.filter((r) => r.status === "PASS"),
    rawDumps: allResults.filter((r) => r.status === "DUMP"),
  };

  const jsonPath = join(OUTPUT_DIR, "typography-computed-results.json");
  writeFileSync(jsonPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n[typography-verify] JSON written → ${jsonPath}`);

  // ── Console summary ────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════");
  console.log(`  TOTAL CHECKS : ${summary.total}`);
  console.log(`  PASS         : ${summary.pass}`);
  console.log(`  FAIL         : ${summary.fail}`);
  console.log(`  MISSING_SEL  : ${summary.missing_selector}`);
  console.log(`  ERROR        : ${summary.error}`);
  console.log("══════════════════════════════════════════════");

  if (summary.fail > 0) {
    console.log("\n  FAILURES:");
    for (const f of output.fails) {
      console.log(
        `    [${f.viewport}] ${f.routeLabel} → ${f.selector} → ${f.property}: expected "${f.expected}", got "${f.actual}" (${f.reason})`
      );
    }
  }

  if (summary.missing_selector > 0) {
    const uniq = [
      ...new Set(
        output.missing.map((m) => `${m.routeLabel}@${m.viewport}: ${m.selector}`)
      ),
    ];
    console.log(`\n  MISSING SELECTORS (${uniq.length} unique):`);
    for (const u of uniq) console.log(`    • ${u}`);
  }

  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[typography-verify] Unhandled error:", err);
  process.exit(1);
});
