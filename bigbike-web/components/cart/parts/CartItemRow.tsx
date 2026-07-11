"use client";

import { useTranslations } from "next-intl";
import type { CartItem } from "@/lib/contracts/commerce";
import { formatVnd } from "@/lib/utils/format";
import { MediaImage } from "@/components/ui/MediaImage";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function CartItemRow({
  item,
  draftQuantity,
  isMutating,
  onStep,
  onDraft,
  onBlur,
  onRemove,
}: {
  item: CartItem;
  draftQuantity: number;
  isMutating: boolean;
  onStep: (id: string, dir: 1 | -1) => void;
  onDraft: (id: string, qty: number) => void;
  onBlur: (id: string, serverQty: number) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations("CartPage");
  return (
    <div className={cn("relative grid grid-cols-[96px_1fr] gap-4 py-6 transition-opacity md:grid-cols-[130px_1fr_auto_auto] md:items-center", isMutating && "opacity-50")} role="listitem">
      <div>
        {item.image?.url ? (
          <MediaImage image={item.image} altFallback={item.productName} width={130} height={130} className="h-24 w-24 object-contain md:h-[130px] md:w-[130px]" />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center bg-secondary font-cta text-a2-page font-semibold md:h-[130px] md:w-[130px]">{item.productName.slice(0, 2)}</span>
        )}
      </div>

      <div className="min-w-0">
        <h3 className="m-0 font-cta text-a3-section font-semibold uppercase">{item.productName}</h3>
        {item.variantName ? <p className="mb-0 mt-2 text-muted-foreground">{item.variantName}</p> : null}
        <p className="mb-0 mt-2 font-semibold text-brand">{item.quantity} x {formatVnd(item.unitPrice)} = {formatVnd(item.lineTotal)}</p>
        {!item.available && <p className="mb-0 mt-2 font-semibold text-destructive">{t("backorderNotice")}</p>}
      </div>

      <div className="col-span-2 md:col-span-1">
        {/* Thứ tự chuẩn UX: [-] [ô số] [+] — giảm bên trái, tăng bên phải.
            KHÔNG dùng `js-quantity-wrap`/`js-plus`/`js-minus`: home.min.js
            (change_cart_quantity) bind trực tiếp vào các class đó và ghi `.val()`
            imperative đè input React-controlled. React đã drive +/- qua onClick nên bỏ
            marker; styling dựa `.quantity-form .minus/.plus` nên giữ nguyên giao diện. */}
        <div className="inline-flex border border-border-control">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11! w-11! rounded-none"
            onClick={() => onStep(item.id, -1)}
            disabled={isMutating || !item.available || draftQuantity <= 1}
            aria-label={t("decreaseQtyAria", { name: item.productName })}
          >
            <Minus className="h-4 w-4" aria-hidden />
          </Button>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            className="h-11! min-h-0 w-14 rounded-none border-y-0 border-x px-1 py-0 text-center [appearance:textfield] focus:shadow-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            value={draftQuantity}
            onChange={(e) => onDraft(item.id, Number(e.target.value))}
            onBlur={() => onBlur(item.id, item.quantity)}
            disabled={isMutating || !item.available}
            aria-label={t("quantityAria", { name: item.productName })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11! w-11! rounded-none"
            onClick={() => onStep(item.id, 1)}
            disabled={isMutating || !item.available}
            aria-label={t("increaseQtyAria", { name: item.productName })}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="absolute right-0 top-4 md:relative md:right-auto md:top-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-none text-destructive hover:text-destructive"
            onClick={() => onRemove(item.id)}
            disabled={isMutating}
            aria-label={t("removeItem")}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
      </div>
    </div>
  );
}
