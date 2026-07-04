/**
 * WCAG 2.x contrast-ratio math (relative luminance + alpha compositing).
 * Pure color functions — no DOM, no CSS parsing (see __tests__/theme/contrast.test.ts
 * for the brand-tokens.css-aware layer that uses these against the real token file).
 */

export type Rgba = { r: number; g: number; b: number; a: number };

const NAMED_COLORS: Record<string, Rgba> = {
  white: { r: 255, g: 255, b: 255, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

/** Parse #hex (3/4/6/8), rgb()/rgba(), or a small named-color set. Returns null if unrecognized. */
export function parseColor(value: string): Rgba | null {
  const v = value.trim().toLowerCase();

  if (v in NAMED_COLORS) return NAMED_COLORS[v];

  if (v.startsWith("#")) {
    const hex = v.slice(1);
    if (![3, 4, 6, 8].includes(hex.length) || /[^0-9a-f]/.test(hex)) return null;
    const expand = (h: string) => (hex.length <= 4 ? h + h : h);
    if (hex.length <= 4) {
      const r = parseInt(expand(hex[0]), 16);
      const g = parseInt(expand(hex[1]), 16);
      const b = parseInt(expand(hex[2]), 16);
      const a = hex.length === 4 ? parseInt(expand(hex[3]), 16) / 255 : 1;
      return { r, g, b, a };
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  const fn = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (fn) {
    return {
      r: Number(fn[1]),
      g: Number(fn[2]),
      b: Number(fn[3]),
      a: fn[4] !== undefined ? Number(fn[4]) : 1,
    };
  }

  return null;
}

function srgbToLinear(channel255: number): number {
  const c = channel255 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0..1) of an OPAQUE color. */
export function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** Alpha-composite `fg` (possibly translucent) over an opaque `bg`. */
export function compositeOver(fg: Rgba, bg: { r: number; g: number; b: number }): Rgba {
  if (fg.a >= 1) return { ...fg, a: 1 };
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

/** WCAG contrast ratio (1..21) between two OPAQUE colors. */
export function contrastRatio(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }): number {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Contrast ratio between a foreground color (opaque or translucent) and a
 * background (opaque or translucent), compositing both over `underlyingBg`
 * first — required for state-color rgba() chips, which sit on the page
 * background, NOT necessarily white (e.g. a 14%-alpha chip reads very
 * differently on a near-black dark-mode page than on white).
 */
export function contrastAgainst(foreground: string, background: string, underlyingBg = "#ffffff"): number {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  const under = parseColor(underlyingBg);
  if (!fg || !bg || !under) {
    throw new Error(`contrastAgainst: unparseable color — fg="${foreground}" bg="${background}" underlyingBg="${underlyingBg}"`);
  }
  const bgOpaque = compositeOver(bg, under);
  const fgComposited = compositeOver(fg, bgOpaque);
  return contrastRatio(fgComposited, bgOpaque);
}

export const WCAG_AA_NORMAL_TEXT = 4.5;
export const WCAG_AA_LARGE_TEXT = 3;
export const WCAG_AA_UI_COMPONENT = 3;
