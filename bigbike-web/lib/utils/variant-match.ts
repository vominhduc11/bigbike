import type { ProductVariant } from "@/lib/contracts/public";

/**
 * Diacritic-insensitive, case-insensitive normalisation. Used so a stored
 * label like "Đỏ bóng" still matches a clicked chip rendering "do bong" or
 * "DO BONG" — variation labels coming from WP imports often differ in
 * accents/casing from the slug-derived option values.
 */
export function normalizeValue(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const COLOR_ATTRIBUTE_KEYS = new Set([
  "color",
  "colour",
  "mau",
  "mau sac",
  "mausac",
  "maucolor",
  "pa color",
  "pa mau",
  "pa mau sac",
]);

const SIZE_ATTRIBUTE_KEYS = new Set(["size", "kich co"]);

/** Color-attribute heuristic. Diacritic-insensitive and slug/code tolerant. */
export function isColorAttribute(name: string): boolean {
  return COLOR_ATTRIBUTE_KEYS.has(normalizeValue(name));
}

/** Share recognized color/size identities across dictionary and legacy bilingual labels. */
export function normalizeAttributeName(name: string): string {
  if (isColorAttribute(name)) return "color";
  const normalized = normalizeValue(name);
  return SIZE_ATTRIBUTE_KEYS.has(normalized) ? "size" : normalized;
}

/** Look up a variant's value for an attribute name. Match is normalised. */
export function getOptionValue(variant: ProductVariant, attributeName: string): string | undefined {
  const norm = normalizeAttributeName(attributeName);
  return (variant.options ?? []).find((o) => normalizeAttributeName(o.name) === norm)?.value;
}

/** One display name per normalized attribute, preserving the first label and order. */
export function collectAttributeNames(variants: ProductVariant[]): Set<string> {
  const names = new Map<string, string>();
  for (const v of variants) {
    for (const o of v.options ?? []) {
      const n = (o.name ?? "").trim();
      const key = normalizeAttributeName(n);
      if (n && !names.has(key)) names.set(key, n);
    }
  }
  return new Set(names.values());
}

function getColorSelection(selection: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(selection).filter(([name, value]) => Boolean(value) && isColorAttribute(name)),
  );
}

/**
 * Find the variant where every attribute in `selection` matches. The
 * variant may have additional attributes that aren't in `selection` —
 * useful for partial matches when the customer has only picked some
 * attributes. Set `requireAll=true` to also require the variant has no
 * un-picked attributes (full match).
 */
export function findMatchingVariant(
  variants: ProductVariant[],
  selection: Record<string, string>,
  options?: { onlyAvailable?: boolean; requireAll?: boolean; inStockOnly?: boolean },
): ProductVariant | null {
  const onlyAvailable = options?.onlyAvailable ?? false;
  const requireAll = options?.requireAll ?? false;
  const inStockOnly = options?.inStockOnly ?? false;
  const selectionEntries = Object.entries(selection).filter(([, v]) => v);
  if (selectionEntries.length === 0) return null;

  return (
    variants.find((v) => {
      if (onlyAvailable && !v.isAvailable) return false;
      if (inStockOnly && v.stockState === "OUT_OF_STOCK") return false;
      // Every picked attribute must match this variant's value.
      const matchesAllPicks = selectionEntries.every(([key, val]) => {
        const variantValue = getOptionValue(v, key);
        return variantValue ? normalizeValue(variantValue) === normalizeValue(val) : false;
      });
      if (!matchesAllPicks) return false;
      if (!requireAll) return true;
      // requireAll: variant cannot define attributes the customer hasn't picked.
      return (v.options ?? []).every((o) => {
        const picked = selectionEntries.find(
          ([name]) => normalizeAttributeName(name) === normalizeAttributeName(o.name),
        )?.[1];
        return picked ? normalizeValue(picked) === normalizeValue(o.value) : false;
      });
    }) ?? null
  );
}

/**
 * Best-available variant for gallery/image PREVIEW. Tries:
 * 1. Available variant matching every picked attribute (strict & in-stock).
 * 2. Any variant matching every picked attribute (out-of-stock allowed).
 * 3. If both fail and only one attribute is picked, falls back to that.
 *    (Always covered by step 2 already.)
 *
 * Returns null when nothing has been picked.
 */
/**
 * Gallery preview is color-scoped: selecting Size or another non-color
 * attribute must not swap the PDP gallery. Returns the representative variant
 * for the picked color only, preferring available variants.
 */
export function findColorPreviewVariant(
  variants: ProductVariant[],
  selection: Record<string, string>,
): ProductVariant | null {
  const colorSelection = getColorSelection(selection);
  return (
    findMatchingVariant(variants, colorSelection, { onlyAvailable: true }) ??
    findMatchingVariant(variants, colorSelection)
  );
}

/**
 * Finds a preview variant using the full selection (all attributes, not just color).
 * Prefers available variants but falls back to out-of-stock when needed.
 * Returns null when nothing has been picked.
 */
export function findPreviewVariant(
  variants: ProductVariant[],
  selection: Record<string, string>,
): ProductVariant | null {
  return (
    findMatchingVariant(variants, selection, { onlyAvailable: true }) ??
    findMatchingVariant(variants, selection)
  );
}
