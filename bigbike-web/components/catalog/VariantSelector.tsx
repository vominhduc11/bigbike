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

type VariantSelectorProps = Readonly<{
  variants: ProductVariant[];
  selectedOptions: Readonly<Record<string, string>>;
  onSelectOption: (attributeName: string, value: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}>;

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

function toWpAttributeSlug(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "option";
}

type SwatchInfo = {
  value: string;
  colorHex: string | null;
  swatchImageUrl: string | null;
  variantImageUrl: string | null;
};

function hasSwatch(info: SwatchInfo): boolean {
  return Boolean(info.colorHex || info.swatchImageUrl || info.variantImageUrl);
}

function buildOptionGroups(variants: ProductVariant[], attributeFallback: string) {
  const groups = new Map<string, Map<string, SwatchInfo>>();
  for (const variant of variants) {
    const variantImg = variant.gallery?.[0]?.url ?? variant.image?.url ?? null;
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
        variantImageUrl: isColorAttribute(name) ? variantImg : null,
      };
      if (!existing || (!hasSwatch(existing) && hasSwatch(candidate))) {
        valueMap.set(value, candidate);
      }
    }
  }

  return Array.from(groups.entries()).map(toOptionGroup);
}

function toOptionGroup([name, valueMap]: [string, Map<string, SwatchInfo>]) {
  const values = Array.from(valueMap.values());
  if (isSizeAttribute(name)) values.sort((a, b) => compareSizeValues(a.value, b.value));
  return { name, values };
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
          <div
            key={group.name}
            className={cn(
              "options",
              `pa_${toWpAttributeSlug(group.name)}`,
              isColorGroup && "color",
              "size",
            )}
          >
            <div className="group">
              <div className="group-label">
                <label>{group.name}</label>
              </div>
              <div className="variation-radios">
                {group.values.map((info) => {
                  const { value, colorHex, swatchImageUrl, variantImageUrl } = info;
                  const probeSelection = { ...selectedOptions, [group.name]: value };
                  const candidate =
                    findMatchingVariant(variants, probeSelection, { onlyAvailable: true }) ??
                    findMatchingVariant(variants, probeSelection);
                  const active = normalizeValue(currentValue) === normalizeValue(value);
                  const available = Boolean(candidate?.isAvailable);
                  const effectiveImageUrl = swatchImageUrl || variantImageUrl;
                  let swatchStyle: CSSProperties | undefined;
                  if (isColorGroup && effectiveImageUrl) {
                    swatchStyle = { backgroundImage: `url(${effectiveImageUrl})` };
                  } else if (isColorGroup && colorHex) {
                    swatchStyle = { backgroundColor: colorHex };
                  }

                  const inputId = `${toWpAttributeSlug(group.name)}-${toWpAttributeSlug(value)}`;

                  return (
                    <div
                      key={`${group.name}-${value}`}
                      className={cn(
                        "form-group",
                        isColorGroup && "form-group--color",
                        active && "is-active",
                        !available && !active && "is-disabled",
                      )}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name={`attribute_pa_${toWpAttributeSlug(group.name)}`}
                        value={value}
                        className={cn("form-control", isColorGroup && "js-change-color")}
                        checked={active}
                        disabled={disabled || (!available && !active)}
                        onChange={() => {
                          if (!available && !active) return;
                          onSelectOption(group.name, value);
                        }}
                      />
                      <label
                        className="bb-wp-variant-label"
                        style={swatchStyle}
                        htmlFor={inputId}
                        title={value}
                      >
                        {isColorGroup && swatchStyle ? "" : value}
                      </label>
                    </div>
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
