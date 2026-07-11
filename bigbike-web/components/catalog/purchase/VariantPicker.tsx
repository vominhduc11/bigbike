"use client";

import type { ImageAsset, ProductVariant } from "@/lib/contracts/public";
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

// Khu chọn biến thể (Màu sắc / Size…) — radio ô màu (ảnh-only) + ô chữ. Toggle off
// khi bấm lại option đang chọn; làm mờ option hết hàng, khóa option không bán.
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
    <div data-variant-picker className="space-y-4">
      {attributeNames.map((attr) => {
        const color = isColorAttribute(attr);
        const opts = distinctOptions(variants, attr);
        const slug = attr.toLowerCase().replace(/\s+/g, "-");
        // CSS hook ổn định: theme dựa `.pa_color` để hiện ô màu dạng ẢNH-ONLY
        // (ẩn chữ tên màu qua `.pa_color … label span{display:none}`). Slug lấy từ
        // tên hiển thị giờ là "màu-sắc"/"color" tùy ngôn ngữ → không còn cố định
        // "pa_color", nên gắn thêm class theo LOẠI thuộc tính (isColorAttribute).
        return (
          <fieldset key={attr}>
            <legend className="font-cta text-caption font-semibold uppercase leading-none text-foreground">{attr}</legend>
              <div className="flex flex-wrap gap-2.5">
                {opts.map((o) => {
                  const checked = selectedOptions[attr] === o.value;
                  const swatch = color ? imgUrl(o.rep.image ?? o.rep.gallery?.[0]?.image) : "";
                  // STOCK_RULE_005: làm mờ option hết hàng (vẫn click được để
                  // xem ảnh màu), chỉ KHÓA option của biến thể không bán
                  // (isAvailable=false). Probe = lựa chọn hiện tại + option này.
                  const probe = { ...selectedOptions, [attr]: o.value };
                  const optInStock = Boolean(
                    findMatchingVariant(variants, probe, {
                      onlyAvailable: true,
                      inStockOnly: true,
                    }),
                  );
                  const optSelectable = Boolean(
                    (findMatchingVariant(variants, probe, { onlyAvailable: true }) ??
                      findMatchingVariant(variants, probe))?.isAvailable,
                  );
                  return (
                    <div
                      className={cn(
                        "relative",
                        !optInStock && !checked && "opacity-45",
                        !optSelectable && !checked && "cursor-not-allowed",
                      )}
                      key={o.value}
                    >
                      <input
                        type="radio"
                        id={`${slug}-${o.value}`}
                        className="peer sr-only"
                        name={`attribute_pa_${slug}`}
                        value={o.value}
                        checked={checked}
                        disabled={!optSelectable && !checked}
                        // Radio đã chọn thì bấm lại KHÔNG bắn onChange,
                        // nên dùng onClick để bỏ chọn (toggle off) — giống
                        // VariantSelector của code cũ. onChange vẫn lo việc
                        // chọn option mới.
                        onClick={() => {
                          if (checked) onPick(attr, o.value);
                        }}
                        onChange={() => onPick(attr, o.value)}
                      />
                      <label
                        htmlFor={`${slug}-${o.value}`}
                        className={cn(
                          "flex min-h-[52px] cursor-pointer items-center justify-center border border-border-control bg-white px-5 font-body text-body font-semibold uppercase text-foreground transition-colors hover:border-brand peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
                          color && "h-[52px] w-[52px] bg-cover bg-center p-0",
                          checked && "border-brand text-brand ring-1 ring-brand",
                        )}
                        style={color && swatch ? { backgroundImage: `url(${swatch})` } : undefined}
                      >
                        {color ? <span className="sr-only">{o.label}</span> : o.label}
                      </label>
                    </div>
                  );
                })}
              </div>
          </fieldset>
        );
      })}
    </div>
  );
}
