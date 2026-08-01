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
            <p className="mb-3 font-cta text-b4-action font-semibold uppercase leading-none text-foreground">{attr}</p>
            <RadioGroup
              aria-label={attr}
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
                      "flex shrink-0 items-center justify-center font-cta text-b4-action font-semibold uppercase text-foreground [scroll-snap-align:start]",
                      // Ô luôn VUÔNG (size-13) dù chữ hay ảnh — không còn giãn lấp hàng
                      // để khớp chiều rộng đồng nhất trên hàng cuộn ngang.
                      !color && "size-13 px-1",
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
