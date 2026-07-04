import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { contrastAgainst, WCAG_AA_NORMAL_TEXT, WCAG_AA_UI_COMPONENT } from "@/lib/theme/contrast";

/**
 * Reads the REAL styles/brand-tokens.css (not hardcoded numbers) so this test
 * fails the moment someone edits a token in a way that breaks WCAG AA contrast
 * — per STYLEGUIDE.md Dark mode §Cam kết tương phản.
 */
const CSS_PATH = path.resolve(process.cwd(), "styles/brand-tokens.css");
const css = fs.readFileSync(CSS_PATH, "utf8");

function extractBlock(selectorLineStart: RegExp): string {
  const match = selectorLineStart.exec(css);
  if (!match) throw new Error(`Block not found in brand-tokens.css: ${selectorLineStart}`);
  const openBraceIndex = css.indexOf("{", match.index);
  let depth = 1;
  let i = openBraceIndex + 1;
  while (depth > 0 && i < css.length) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
    i++;
  }
  return css.slice(openBraceIndex + 1, i - 1);
}

function parseDeclarations(block: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const statement of block.split(";")) {
    const m = /--([\w-]+)\s*:\s*([\s\S]+)/.exec(statement.trim());
    if (m) map.set(m[1], m[2].trim());
  }
  return map;
}

// Top-level `:root {` only (no leading indent) — excludes the nested, indented
// `:root` inside the `@media (max-width: 767px)` header-height override.
const lightMap = parseDeclarations(extractBlock(/^:root\s*\{/m));
// Our new dark-mode override block.
const darkMap = parseDeclarations(extractBlock(/^:root\[data-theme="dark"\]\s*\{/m));

function resolve(name: string, useDark: boolean, seen = new Set<string>()): string {
  const raw = (useDark ? darkMap.get(name) : undefined) ?? lightMap.get(name);
  if (raw === undefined) throw new Error(`Token not found in brand-tokens.css: --${name}`);
  const varMatch = /^var\(\s*--([\w-]+)\s*\)$/.exec(raw);
  if (varMatch) {
    if (seen.has(varMatch[1])) throw new Error(`Circular var() reference starting at --${name}`);
    seen.add(varMatch[1]);
    return resolve(varMatch[1], useDark, seen);
  }
  return raw;
}

type Pair = { fg: string; bg: string; min: number; label: string; underlying?: string };

const TEXT_PAIRS: Pair[] = [
  { fg: "bb-text-primary", bg: "bb-bg-page", min: WCAG_AA_NORMAL_TEXT, label: "text-primary / bg-page" },
  { fg: "bb-text-primary", bg: "bb-bg-surface", min: WCAG_AA_NORMAL_TEXT, label: "text-primary / bg-surface" },
  { fg: "bb-text-primary", bg: "bb-bg-surface-raised", min: WCAG_AA_NORMAL_TEXT, label: "text-primary / bg-surface-raised" },
  { fg: "bb-text-secondary", bg: "bb-bg-page", min: WCAG_AA_NORMAL_TEXT, label: "text-secondary / bg-page" },
  { fg: "bb-text-secondary", bg: "bb-bg-surface", min: WCAG_AA_NORMAL_TEXT, label: "text-secondary / bg-surface" },
  { fg: "bb-text-muted", bg: "bb-bg-page", min: WCAG_AA_NORMAL_TEXT, label: "text-muted / bg-page" },
  { fg: "bb-text-brand", bg: "bb-bg-page", min: WCAG_AA_NORMAL_TEXT, label: "text-brand / bg-page" },
  { fg: "bb-text-brand", bg: "bb-bg-surface", min: WCAG_AA_NORMAL_TEXT, label: "text-brand / bg-surface" },
  { fg: "bb-color-success", bg: "bb-bg-page", min: WCAG_AA_NORMAL_TEXT, label: "color-success / bg-page (ĐCòn hàng)" },
  { fg: "bb-discount", bg: "bb-bg-page", min: WCAG_AA_NORMAL_TEXT, label: "discount / bg-page (giỏ hàng)" },
  { fg: "bb-discount", bg: "bb-bg-surface", min: WCAG_AA_NORMAL_TEXT, label: "discount / bg-surface (giỏ hàng)" },
];

// --bb-border-control is the token STYLEGUIDE.md's own accessibility mapping
// designates for "form controls and selected/important borders" — border-
// strong/-subtle/-default are decorative dividers with no such AA commitment
// in either theme (pre-existing in light; not something dark mode should
// invent a new requirement for).
const UI_BORDER_PAIRS: Pair[] = [
  { fg: "bb-border-control", bg: "bb-bg-surface", min: WCAG_AA_UI_COMPONENT, label: "border-control / bg-surface" },
  { fg: "bb-border-control", bg: "bb-bg-page", min: WCAG_AA_UI_COMPONENT, label: "border-control / bg-page" },
];

// State-color chips are translucent (rgba backgrounds) — must composite over
// the actual page background of that theme, not an assumed white. Only the
// text-on-its-own-chip-background pair is asserted: the background wash and
// accent border are decorative reinforcement (the text already carries the
// meaning), and light mode's existing washes are intentionally subtle — not
// something dark mode should retroactively hold to a new visibility floor.
const STATE_TRIPLETS: Array<{ text: string; bg: string; label: string }> = [
  { text: "bb-state-success-text", bg: "bb-state-success-bg", label: "success" },
  { text: "bb-state-warning-text", bg: "bb-state-warning-bg", label: "warning" },
  { text: "bb-state-danger", bg: "bb-state-danger-bg", label: "danger" },
  { text: "bb-state-info", bg: "bb-state-info-bg", label: "info" },
];

describe.each([
  { name: "light", useDark: false },
  { name: "dark", useDark: true },
])("Dark mode contrast — $name theme", ({ useDark }) => {
  const pageBg = resolve("bb-bg-page", useDark);

  it.each(TEXT_PAIRS)("$label >= 4.5:1", ({ fg, bg, min }) => {
    const ratio = contrastAgainst(resolve(fg, useDark), resolve(bg, useDark));
    expect(ratio).toBeGreaterThanOrEqual(min);
  });

  it.each(UI_BORDER_PAIRS)("$label >= 3:1 (non-text UI component)", ({ fg, bg, min }) => {
    const ratio = contrastAgainst(resolve(fg, useDark), resolve(bg, useDark));
    expect(ratio).toBeGreaterThanOrEqual(min);
  });

  it.each(STATE_TRIPLETS)("state $label — text readable on its own chip background", ({ text, bg }) => {
    const textRatio = contrastAgainst(resolve(text, useDark), resolve(bg, useDark), pageBg);
    expect(textRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });
});
