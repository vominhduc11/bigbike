"use client";

import type { CSSProperties } from "react";
import { safeText } from "@/lib/utils/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  findMatchingVariant,
  isColorAttribute,
  normalizeValue,
} from "@/lib/utils/variant-match";
import type { ProductVariant } from "@/lib/contracts/public";

type VariantSelectorProps = {
  variants: ProductVariant[];
  /**
   * Map of attribute name → picked value. The customer may have picked a
   * subset of attributes (progressive selection). Empty / missing values
   * mean "not yet picked" for that attribute.
   */
  selectedOptions: Record<string, string>;
  /** Set the picked value for one attribute. Pass empty string to clear. */
  onSelectOption: (attributeName: string, value: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
};

// Canonical clothing-size order. Lookup is case-insensitive and normalised
// (no diacritics) so values from various data sources still resolve. Items
// not in this list fall through to numeric / alpha comparison.
const SIZE_ORDER: Record<string, number> = {
  xxxs: 0, xxs: 1, xs: 2, s: 3, m: 4, l: 5, xl: 6, xxl: 7, xxxl: 8, "4xl": 9, "5xl": 10,
};

const SIZE_ATTR_KEYS = new Set(["size", "kich-thuoc", "kich-co", "kích thước", "kích cỡ", "co"]);

function isSizeAttribute(name: string): boolean {
  const normalised = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  return SIZE_ATTR_KEYS.has(normalised);
}

function compareSizeValues(a: string, b: string): number {
  const ak = a.toLowerCase().trim();
  const bk = b.toLowerCase().trim();
  const aRank = SIZE_ORDER[ak];
  const bRank = SIZE_ORDER[bk];
  if (aRank !== undefined && bRank !== undefined) return aRank - bRank;
  if (aRank !== undefined) return -1;
  if (bRank !== undefined) return 1;
  // Numeric fallback (e.g. EU sizes "38", "40", "42")
  const aNum = Number.parseFloat(ak);
  const bNum = Number.parseFloat(bk);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
  return ak.localeCompare(bk, "vi");
}

type SwatchInfo = {
  value: string;
  colorHex: string | null;
  swatchImageUrl: string | null;
};

function buildOptionGroups(variants: ProductVariant[]) {
  // Track distinct values per attribute. For each value we keep the first
  // non-null swatch info encountered (multiple variants share the same
  // term, so any of them yield the same colorHex / swatchImageUrl).
  const groups = new Map<string, Map<string, SwatchInfo>>();
  for (const v of variants) {
    for (const opt of v.options ?? []) {
      const name = safeText(opt.name, "Thuộc tính").trim();
      const value = safeText(opt.value, "").trim();
      if (!name || !value) continue;
      if (!groups.has(name)) groups.set(name, new Map());
      const valueMap = groups.get(name)!;
      const existing = valueMap.get(value);
      // Prefer the entry that has any swatch metadata over a bare one.
      const candidate: SwatchInfo = {
        value,
        colorHex: opt.colorHex ?? null,
        swatchImageUrl: opt.swatchImageUrl ?? null,
      };
      if (!existing) {
        valueMap.set(value, candidate);
      } else if (
        (!existing.colorHex && !existing.swatchImageUrl) &&
        (candidate.colorHex || candidate.swatchImageUrl)
      ) {
        valueMap.set(value, candidate);
      }
    }
  }
  return Array.from(groups.entries()).map(([name, valueMap]) => {
    const arr = Array.from(valueMap.values());
    if (isSizeAttribute(name)) arr.sort((a, b) => compareSizeValues(a.value, b.value));
    return { name, values: arr };
  });
}

function describeVariant(v: ProductVariant): string {
  const opts = (v.options ?? [])
    .map((o) => `${safeText(o.name, "Thuộc tính")}: ${safeText(o.value, "Không rõ")}`)
    .join(" · ");
  return [safeText(v.name, "Biến thể"), opts].filter(Boolean).join(" · ");
}

export function VariantSelector({
  variants,
  selectedOptions,
  onSelectOption,
  disabled,
  isLoading,
}: VariantSelectorProps) {
  if (isLoading && !variants.length) return null;
  if (!variants.length) return null;

  const groups = buildOptionGroups(variants);

  // Chip-group layout (when options are defined)
  if (groups.length > 0) {
    return (
      <>
        {groups.map((group) => {
          const currentValue = selectedOptions[group.name] ?? "";
          const isColorGroup = isColorAttribute(group.name);
          return (
            <div key={group.name} className="wp-pdp-opt-group">
              <h6>{group.name}</h6>
              <div className="wp-pdp-chips">
                {group.values.map((info) => {
                  const { value, colorHex, swatchImageUrl } = info;
                  // For OOS detection: see whether picking this chip on top
                  // of the *other* selected attributes would land on an
                  // available variant. Don't include the current group's
                  // existing value — replacing it is the action being
                  // tested.
                  const probeSelection = { ...selectedOptions, [group.name]: value };
                  const candidate =
                    findMatchingVariant(variants, probeSelection, { onlyAvailable: true }) ??
                    findMatchingVariant(variants, probeSelection);
                  const isActive =
                    normalizeValue(currentValue) === normalizeValue(value);
                  const isAvailable = Boolean(candidate?.isAvailable);
                  // Three render modes for color groups:
                  //   1. Image swatch  → large image tile with label below
                  //      (matches WP's `pa_color` chip style)
                  //   2. Hex swatch    → coloured circle + label below
                  //   3. No swatch     → fall back to text pill (default)
                  // Non-color groups always use the text pill, regardless
                  // of whether their values happen to carry colorHex.
                  const swatchMode: "image" | "hex" | "none" =
                    isColorGroup && swatchImageUrl
                      ? "image"
                      : isColorGroup && colorHex
                        ? "hex"
                        : "none";
                  const swatchStyle: CSSProperties | undefined =
                    swatchMode === "image"
                      ? { backgroundImage: `url(${swatchImageUrl!})` }
                      : swatchMode === "hex"
                        ? { background: colorHex! }
                        : undefined;

                  if (swatchMode !== "none") {
                    return (
                      <button
                        key={`${group.name}-${value}`}
                        type="button"
                        className={[
                          "wp-pdp-swatch",
                          swatchMode === "image" ? "wp-pdp-swatch-image" : "wp-pdp-swatch-hex",
                          isActive ? "active" : "",
                          !isAvailable && !isActive ? "oos" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => {
                          if (!isAvailable && !isActive) return;
                          onSelectOption(group.name, value);
                        }}
                        disabled={disabled || (!isAvailable && !isActive)}
                        title={value}
                        aria-label={value}
                      >
                        <span
                          className="wp-pdp-swatch-thumb"
                          aria-hidden="true"
                          style={swatchStyle}
                        />
                        <span className="wp-pdp-swatch-label">{value}</span>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={`${group.name}-${value}`}
                      type="button"
                      className={[
                        "wp-pdp-chip",
                        isActive ? "active" : "",
                        !isAvailable && !isActive ? "oos" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => {
                        if (!isAvailable && !isActive) return;
                        onSelectOption(group.name, value);
                      }}
                      disabled={disabled || (!isAvailable && !isActive)}
                      title={value}
                      aria-label={value}
                    >
                      <span className="wp-pdp-chip-label">{value}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </>
    );
  }

  // Fallback: plain select for variants without structured options.
  // Encodes the variant's attribute set as the option value so the
  // controlled-by-attributes pattern still works.
  const currentVariantId = (() => {
    const match = findMatchingVariant(variants, selectedOptions, { requireAll: true });
    return match?.id ?? "";
  })();

  return (
    <div className="wp-pdp-opt-group">
      <h6>Biến thể</h6>
      <Select
        value={currentVariantId}
        onValueChange={(id) => {
          const v = variants.find((va) => va.id === id);
          if (!v) return;
          for (const opt of v.options ?? []) {
            onSelectOption(opt.name, opt.value);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="— Chọn biến thể —" />
        </SelectTrigger>
        <SelectContent>
          {variants.map((v) => (
            <SelectItem key={v.id} value={v.id} disabled={!v.isAvailable}>
              {describeVariant(v)}{v.isAvailable ? "" : " — hết hàng"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
