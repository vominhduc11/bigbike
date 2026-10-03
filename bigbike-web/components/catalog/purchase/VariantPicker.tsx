"use client";

import { useTranslations } from "next-intl";
import type { ImageAsset, ProductVariant } from "@/lib/contracts/public";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import {
  findMatchingVariant,
  isColorAttribute,
  normalizeAttributeName,
  normalizeValue,
} from "@/lib/utils/variant-match";
import { cn } from "@/lib/utils";

function imgUrl(a: ImageAsset | null | undefined): string {
  return toLegacyWpMediaUrl(resolveMediaUrl(a?.url?.trim())) || "";
}

/** Giá trị options duy nhất cho 1 attribute, kèm variant đại diện (để lấy ảnh swatch). */
function distinctOptions(variants: ProductVariant[], attrName: string) {
  const seen = new Map<
    string,
    {
      value: string;
      label: string;
      accessibilityLabel?: string | null;
      rep: ProductVariant;
    }
  >();
  const normalizedAttribute = normalizeAttributeName(attrName);
  for (const v of variants) {
    const option = (v.options ?? []).find(
      (item) => normalizeAttributeName(item.name) === normalizedAttribute,
    );
    const val = option?.value;
    if (!val) continue;
    const existing = seen.get(val);
    if (!existing) {
      seen.set(val, {
        value: val,
        label: val,
        accessibilityLabel: option?.accessibilityLabel,
        rep: v,
      });
    } else if (!existing.accessibilityLabel && option?.accessibilityLabel) {
      existing.accessibilityLabel = option.accessibilityLabel;
    }
  }
  return Array.from(seen.values());
}

// Khu chọn biến thể (Màu sắc / Size…) — Radix RadioGroup (shadcn) với ô màu (ảnh-only)
// + ô chữ. Toggle off khi bấm lại option đang chọn; làm mờ option hết hàng.
export function VariantPicker({
  variants,
  attributeNames,
  selectedOptions,
  onPick,
  disableUnavailableOptions = false,
}: {
  variants: ProductVariant[];
  attributeNames: string[];
  selectedOptions: Record<string, string>;
  onPick: (attr: string, value: string) => void;
  disableUnavailableOptions?: boolean;
}) {
  const t = useTranslations("Catalog");
  return (
    <div data-variant-picker className="space-y-6">
      {attributeNames.map((attr) => {
        const color = isColorAttribute(attr);
        const attributeKey = normalizeAttributeName(attr);
        const gender = attributeKey === "gender" || attributeKey === "gioi tinh";
        const label =
          attributeKey === "size"
            ? t("filterSize")
            : gender
              ? t("filterGender")
              : color
                ? t("filterColor")
                : attr;
        const opts = distinctOptions(variants, attr);
        return (
          <div key={attr}>
            <p className="mb-3 font-cta text-b4-action font-semibold uppercase leading-none text-foreground">
              {label}
            </p>
            <RadioGroup
              aria-label={label}
              // Luôn MỘT HÀNG, không xuống dòng: nhiều ô hơn bề ngang thì CUỘN NGANG
              // (carousel) thay vì wrap — cùng convention với MobilePdpAnchorNav.
              className="flex flex-nowrap gap-2.5 overflow-x-auto overscroll-x-contain pb-1 [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              value={selectedOptions[attr] ?? ""}
              // onValueChange chỉ bắn khi chọn option MỚI; bấm lại option đang chọn
              // không đổi value nên toggle-off xử lý ở onClick của từng item.
              onValueChange={(v) => {
                if (v) onPick(attr, v);
              }}
            >
              {opts.map((o) => {
                const checked = selectedOptions[attr] === o.value;
                // Chỉ dịch chữ hiển thị; giữ nguyên giá trị để chọn đúng biến thể.
                const genderValue = gender ? normalizeValue(o.value) : "";
                const optionLabel =
                  genderValue === "nam" || genderValue === "male"
                    ? t("genderMale")
                    : genderValue === "nu" || genderValue === "female"
                      ? t("genderFemale")
                      : o.label;
                // The API supplies this only for English color swatches. The raw
                // option value remains the selection key, filter value and visible swatch.
                const screenReaderLabel = color ? o.accessibilityLabel || optionLabel : optionLabel;
                const swatch = color ? imgUrl(o.rep.image ?? o.rep.gallery?.[0]?.image) : "";
                // AUD-029: MỌI option đều CHỌN ĐƯỢC để khách xem ảnh màu/biến thể —
                // kể cả option hết hàng / không bán. Chỉ làm MỜ để báo hết hàng; việc
                // chặn MUA nằm ở nút mua (canBuy xét selectedVariant.isAvailable),
                // không khóa ở đây. Probe = lựa chọn hiện tại + option này.
                const probe = { ...selectedOptions, [attr]: o.value };
                const optInStock = Boolean(
                  findMatchingVariant(variants, probe, {
                    onlyAvailable: true,
                    inStockOnly: true,
                  }),
                );
                return (
                  <RadioGroupItem
                    key={o.value}
                    value={o.value}
                    disabled={disableUnavailableOptions && !optInStock}
                    onClick={() => {
                      if (checked) onPick(attr, o.value);
                    }}
                    className={cn(
                      "flex shrink-0 items-center justify-center font-cta text-b4-action font-semibold uppercase text-foreground [scroll-snap-align:start]",
                      // Ô chữ cao 52px, tối thiểu vuông như ô cỡ S/M/L; chữ dài (vd "M8-3 thuận")
                      // thì ô nở ngang vừa chữ, không xuống dòng để chữ không tràn sang ô bên.
                      // Ô giới tính chừa lề rộng hơn cho đủ chữ ở cả hai ngôn ngữ. Ô màu luôn vuông.
                      !color && "h-13 min-w-13 whitespace-nowrap",
                      !color && !gender && "px-2",
                      gender && "px-3",
                      color && "size-13 bg-cover bg-center p-0",
                      !optInStock && !checked && "opacity-45",
                      disableUnavailableOptions && !optInStock && "cursor-not-allowed",
                    )}
                    style={color && swatch ? { backgroundImage: `url(${swatch})` } : undefined}
                  >
                    <span className={color ? "sr-only" : undefined}>{screenReaderLabel}</span>
                  </RadioGroupItem>
                );
              })}
            </RadioGroup>
          </div>
        );
      })}
    </div>
  );
}
