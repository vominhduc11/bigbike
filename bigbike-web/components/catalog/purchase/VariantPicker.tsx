"use client";

import type { ImageAsset, ProductVariant } from "@/lib/contracts/public";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { findMatchingVariant, getOptionValue, isColorAttribute } from "@/lib/utils/variant-match";
import { cn } from "@/lib/utils";

function imgUrl(a: ImageAsset | null | undefined): string {
  return toLegacyWpMediaUrl(resolveMediaUrl(a?.url?.trim())) || "";
}

/** Giá trị options duy nhất cho 1 attribute, kèm variant đại diện (để lấy ảnh swatch). */
function distinctOptions(variants: ProductVariant[], attrName: string) {
  const seen = new Map<string, { value: string; label: string; rep: ProductVariant }>();
  for (const v of variants) {
    const val = getOptionValue(v, attrName);
    if (!val) continue;
    if (!seen.has(val)) seen.set(val, { value: val, label: val, rep: v });
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
}: {
  variants: ProductVariant[];
  attributeNames: string[];
  selectedOptions: Record<string, string>;
  onPick: (attr: string, value: string) => void;
}) {
  return (
    <div data-variant-picker className="space-y-6">
      {attributeNames.map((attr) => {
        const color = isColorAttribute(attr);
        const opts = distinctOptions(variants, attr);
        return (
          <div key={attr}>
            <p className="mb-3 font-cta text-a4-content font-semibold uppercase leading-none text-foreground">{attr}</p>
            <RadioGroup
              aria-label={attr}
              className="flex flex-wrap gap-2.5"
              value={selectedOptions[attr] ?? ""}
              // onValueChange chỉ bắn khi chọn option MỚI; bấm lại option đang chọn
              // không đổi value nên toggle-off xử lý ở onClick của từng item.
              onValueChange={(v) => {
                if (v) onPick(attr, v);
              }}
            >
              {opts.map((o) => {
                const checked = selectedOptions[attr] === o.value;
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
                    onClick={() => {
                      if (checked) onPick(attr, o.value);
                    }}
                    className={cn(
                      "flex min-h-13 items-center justify-center px-5 font-body text-a4-content font-semibold uppercase text-foreground",
                      // Ô chữ (Size…) giãn đều lấp hết bề ngang cột để khớp với
                      // hàng nút mua bên dưới; ô màu là ẢNH vuông cố định — giữ nguyên.
                      !color && "min-w-16 flex-1 basis-0",
                      color && "size-13 bg-cover bg-center p-0",
                      !optInStock && !checked && "opacity-45",
                    )}
                    style={color && swatch ? { backgroundImage: `url(${swatch})` } : undefined}
                  >
                    {color ? <span className="sr-only">{o.label}</span> : o.label}
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
