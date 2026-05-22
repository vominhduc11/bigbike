"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { safeText } from "@/lib/utils/format";
import {
  findMatchingVariant,
  isColorAttribute,
  normalizeValue,
} from "@/lib/utils/variant-match";
import type { ProductVariant } from "@/lib/contracts/public";
import { cn } from "@/lib/utils";

type VariantSelectorProps = {
  variants: ProductVariant[];
  selectedOptions: Record<string, string>;
  onSelectOption: (attributeName: string, value: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
};

const SIZE_ORDER: Record<string, number> = {
  xxxs: 0,
  xxs: 1,
  xs: 2,
  s: 3,
  m: 4,
  l: 5,
  xl: 6,
  xxl: 7,
  xxxl: 8,
  "4xl": 9,
  "5xl": 10,
};

const SIZE_ATTR_KEYS = new Set([
  "size",
  "kich-thuoc",
  "kich-co",
  "kich thuoc",
  "kich co",
  "co",
]);

function isSizeAttribute(name: string): boolean {
  const normalised = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

function buildOptionGroups(variants: ProductVariant[], attributeFallback: string) {
  const groups = new Map<string, Map<string, SwatchInfo>>();
  for (const variant of variants) {
    for (const opt of variant.options ?? []) {
      const name = safeText(opt.name, attributeFallback).trim();
      const value = safeText(opt.value, "").trim();
      if (!name || !value) continue;
      if (!groups.has(name)) groups.set(name, new Map());
      const valueMap = groups.get(name)!;
      const existing = valueMap.get(value);
      const candidate: SwatchInfo = {
        value,
        colorHex: opt.colorHex ?? null,
        swatchImageUrl: opt.swatchImageUrl ?? null,
      };
      if (!existing) {
        valueMap.set(value, candidate);
      } else if (
        !existing.colorHex &&
        !existing.swatchImageUrl &&
        (candidate.colorHex || candidate.swatchImageUrl)
      ) {
        valueMap.set(value, candidate);
      }
    }
  }

  return Array.from(groups.entries()).map(([name, valueMap]) => {
    const values = Array.from(valueMap.values());
    if (isSizeAttribute(name)) values.sort((a, b) => compareSizeValues(a.value, b.value));
    return { name, values };
  });
}

export function VariantSelector({
  variants,
  selectedOptions,
  onSelectOption,
  disabled,
  isLoading,
}: VariantSelectorProps) {
  const t = useTranslations("Product.variants");
  if (isLoading && !variants.length) return null;
  if (!variants.length) return null;

  const groups = buildOptionGroups(variants, t("attributeFallback"));
  if (groups.length === 0) return null;

  return (
    <>
      {groups.map((group) => {
        const currentValue = selectedOptions[group.name] ?? "";
        const isColorGroup = isColorAttribute(group.name);

        return (
          <div key={group.name} className="options">
            <div className="group">
              <div className="group-label">
                <label>{group.name}</label>
              </div>
              <div className="variation-radios">
                {group.values.map((info) => {
                  const { value, colorHex, swatchImageUrl } = info;
                  const probeSelection = { ...selectedOptions, [group.name]: value };
                  const candidate =
                    findMatchingVariant(variants, probeSelection, { onlyAvailable: true }) ??
                    findMatchingVariant(variants, probeSelection);
                  const active = normalizeValue(currentValue) === normalizeValue(value);
                  const available = Boolean(candidate?.isAvailable);
                  const swatchStyle: CSSProperties | undefined =
                    isColorGroup && swatchImageUrl
                      ? { backgroundImage: `url(${swatchImageUrl})` }
                      : isColorGroup && colorHex
                        ? { backgroundColor: colorHex }
                        : undefined;

                  return (
                    <button
                      key={`${group.name}-${value}`}
                      type="button"
                      className={cn(
                        "form-group",
                        isColorGroup && "form-group--color",
                        active && "is-active",
                        !available && !active && "is-disabled",
                      )}
                      onClick={() => {
                        if (!available && !active) return;
                        onSelectOption(group.name, value);
                      }}
                      disabled={disabled || (!available && !active)}
                      title={value}
                      aria-label={value}
                      aria-pressed={active}
                    >
                      <span className="bb-wp-variant-label" style={swatchStyle}>
                        {isColorGroup && swatchStyle ? "" : value}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
