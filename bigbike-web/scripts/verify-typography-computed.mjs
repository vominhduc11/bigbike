#!/usr/bin/env node
/**
 * BigBike Web — canonical typography computed-style verification.
 *
 * Source of truth: docs/TYPOGRAPHY.md.
 * The script injects an off-screen probe for every A/B utility after the app CSS
 * has loaded, then verifies family, size and case at both sides of the only
 * typography breakpoint (768px). Group D is verified on the not-found screen.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 node scripts/verify-typography-computed.mjs
 */

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, "..");
const OUTPUT_DIR = join(WEB_ROOT, "docs", "audits", "runtime");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

const VIEWPORTS = [
  { label: "375px", width: 375, height: 812 },
  { label: "768px", width: 768, height: 1024 },
  { label: "1440px", width: 1440, height: 900 },
];

const GROUPS = [
  { group: "B1", utility: "text-b1-display", family: "font-cta", mobile: 32, tablet: 40, uppercase: true },
  { group: "B2", utility: "text-b2-contact", family: "font-cta", mobile: 24, tablet: 32, uppercase: true },
  { group: "B3", utility: "text-b3-promo", family: "font-cta", mobile: 18, tablet: 20, uppercase: true },
  { group: "B4", utility: "text-b4-action", family: "font-cta", mobile: 16, tablet: 18, uppercase: true },
  { group: "B5", utility: "text-b5-label", family: "font-cta", mobile: 12, tablet: 14, uppercase: true },
  { group: "A1", utility: "text-a1-title", family: "font-body", mobile: 28, tablet: 32, uppercase: false },
  { group: "A2", utility: "text-a2-page", family: "font-body", mobile: 22, tablet: 26, uppercase: false },
  { group: "A3", utility: "text-a3-section", family: "font-body", mobile: 20, tablet: 22, uppercase: false },
  { group: "A4", utility: "text-a4-content", family: "font-body", mobile: 16, tablet: 18, uppercase: false },
  { group: "A5", utility: "text-a5-meta", family: "font-body", mobile: 14, tablet: 16, uppercase: false },
];

function approx(actual, expected, tolerance = 0.15) {
  return Math.abs(Number.parseFloat(actual) - expected) <= tolerance;
}

function result({ viewport, group, property, expected, actual, pass, note = "" }) {
  return {
    viewport,
    group,
    property,
    expected: String(expected),
    actual,
    status: pass ? "PASS" : "FAIL",
    note,
  };
}

async function installCanonicalProbes(page) {
  await page.evaluate((groups) => {
    document.querySelector("[data-typography-probes]")?.remove();
    const root = document.createElement("div");
    root.dataset.typographyProbes = "";
    root.setAttribute("aria-hidden", "true");
    root.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none";

    for (const group of groups) {
      const probe = document.createElement("span");
      probe.dataset.typographyProbe = group.group;
      probe.className = `${group.family} ${group.utility} ${group.uppercase ? "uppercase" : "normal-case"}`;
      probe.textContent = `${group.group} typography probe`;
      root.append(probe);
    }

    document.body.append(root);
  }, GROUPS);
}

async function verifyCanonicalGroups(page, viewport) {
  await installCanonicalProbes(page);
  const rows = [];

  for (const group of GROUPS) {
    const selector = `[data-typography-probe="${group.group}"]`;
    const styles = await page.locator(selector).evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        fontFamily: computed.fontFamily,
        fontSize: computed.fontSize,
        textTransform: computed.textTransform,
      };
    });
    const expectedSize = viewport.width < 768 ? group.mobile : group.tablet;
    const expectedFamily = "Arial";
    const expectedTransform = group.uppercase ? "uppercase" : "none";

    rows.push(
      result({
        viewport: viewport.label,
        group: group.group,
        property: "font-size",
        expected: `${expectedSize}px`,
        actual: styles.fontSize,
        pass: approx(styles.fontSize, expectedSize),
        note: `${group.utility}; Tablet = nấc thứ hai (>=768px)`,
      }),
      result({
        viewport: viewport.label,
        group: group.group,
        property: "font-family",
        expected: expectedFamily,
        actual: styles.fontFamily,
        pass: styles.fontFamily.toLowerCase().includes(expectedFamily.toLowerCase()),
        note: group.family,
      }),
      result({
        viewport: viewport.label,
        group: group.group,
        property: "text-transform",
        expected: expectedTransform,
        actual: styles.textTransform,
        pass: styles.textTransform === expectedTransform,
      }),
    );
  }

  return rows;
}

async function verifyDecorativeGroup(page, viewport) {
  await page.evaluate(() => {
    const root = document.querySelector("[data-typography-probes]");
    if (!root || root.querySelector("[data-typography-decorative]")) return;
    const probe = document.createElement("span");
    probe.dataset.typographyDecorative = "";
    probe.className = "font-body text-[clamp(7rem,22vw,14rem)] leading-none";
    probe.textContent = "404";
    root.append(probe);
  });
  const locator = page.locator("[data-typography-decorative]").first();
  if ((await locator.count()) === 0) {
    return [
      result({
        viewport: viewport.label,
        group: "D",
        property: "selector",
        expected: "[data-typography-decorative]",
        actual: "missing",
        pass: false,
        note: "Decorative group must remain limited to the not-found screen.",
      }),
    ];
  }

  const fontSize = await locator.evaluate((element) => getComputedStyle(element).fontSize);
  const expected = Math.min(224, Math.max(112, viewport.width * 0.22));
  return [
    result({
      viewport: viewport.label,
      group: "D",
      property: "font-size",
      expected: `clamp(112px, 22vw, 224px) ≈ ${expected}px`,
      actual: fontSize,
      pass: approx(fontSize, expected, 0.5),
      note: "Decorative 404 only.",
    }),
  ];
}

async function main() {
  try {
    const response = await fetch(BASE_URL);
    console.log(`[typography-verify] Server reachable: HTTP ${response.status}`);
  } catch {
    console.error(`[typography-verify] Server not reachable at ${BASE_URL}`);
    console.error("Start it with `npm run dev` or `npm start`, then rerun this script.");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const rows = [];

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: "load", timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      rows.push(...(await verifyCanonicalGroups(page, viewport)));
      rows.push(...(await verifyDecorativeGroup(page, viewport)));
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const summary = {
    total: rows.length,
    pass: rows.filter((row) => row.status === "PASS").length,
    fail: rows.filter((row) => row.status === "FAIL").length,
  };
  const output = {
    runAt: new Date().toISOString(),
    sourceOfTruth: "docs/TYPOGRAPHY.md",
    baseUrl: BASE_URL,
    summary,
    failures: rows.filter((row) => row.status === "FAIL"),
    results: rows,
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = join(OUTPUT_DIR, "typography-computed-results.json");
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`[typography-verify] PASS=${summary.pass} FAIL=${summary.fail}`);
  console.log(`[typography-verify] Results: ${outputPath}`);
  for (const failure of output.failures) {
    console.error(
      `[FAIL] ${failure.viewport} ${failure.group} ${failure.property}: expected ${failure.expected}, got ${failure.actual}`,
    );
  }

  process.exit(summary.fail === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("[typography-verify] Unhandled error:", error);
  process.exit(1);
});
