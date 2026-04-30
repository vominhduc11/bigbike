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
  "pa color",
  "pa mau",
  "pa mau sac",
]);

/** Color-attribute heuristic. Diacritic-insensitive and slug/code tolerant. */
export function isColorAttribute(name: string): boolean {
  return COLOR_ATTRIBUTE_KEYS.has(normalizeValue(name));
}

/** Look up a variant's value for an attribute name. Match is normalised. */
export function getOptionValue(
  variant: ProductVariant,
  attributeName: string,
): string | undefined {
  const norm = normalizeValue(attributeName);
  return (variant.options ?? []).find(
    (o) => normalizeValue(o.name) === norm,
  )?.value;
}

/** Set of all attribute names that appear in any variant's options. */
export function collectAttributeNames(variants: ProductVariant[]): Set<string> {
  const names = new Set<string>();
  for (const v of variants) {
    for (const o of v.options ?? []) {
      const n = (o.name ?? "").trim();
      if (n) names.add(n);
    }
  }
  return names;
}

function getColorSelection(
  selection: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(selection).filter(
      ([name, value]) => Boolean(value) && isColorAttribute(name),
    ),
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
  options?: { onlyAvailable?: boolean; requireAll?: boolean },
): ProductVariant | null {
  const onlyAvailable = options?.onlyAvailable ?? false;
  const requireAll = options?.requireAll ?? false;
  const selectionEntries = Object.entries(selection).filter(([, v]) => v);
  if (selectionEntries.length === 0) return null;

  return (
    variants.find((v) => {
      if (onlyAvailable && !v.isAvailable) return false;
      // Every picked attribute must match this variant's value.
      const matchesAllPicks = selectionEntries.every(([key, val]) => {
        const variantValue = getOptionValue(v, key);
        return variantValue
          ? normalizeValue(variantValue) === normalizeValue(val)
          : false;
      });
      if (!matchesAllPicks) return false;
      if (!requireAll) return true;
      // requireAll: variant cannot define attributes the customer hasn't picked.
      return (v.options ?? []).every((o) => {
        const picked = selection[o.name] ?? "";
        return picked
          ? normalizeValue(picked) === normalizeValue(o.value)
          : false;
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
export function findPreviewVariant(
  variants: ProductVariant[],
  selection: Record<string, string>,
): ProductVariant | null {
  return (
    findMatchingVariant(variants, selection, { onlyAvailable: true }) ??
    findMatchingVariant(variants, selection)
  );
}

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
