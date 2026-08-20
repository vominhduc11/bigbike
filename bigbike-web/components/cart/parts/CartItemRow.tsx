"use client";

import { useTranslations } from "next-intl";
import type { CartItem } from "@/lib/contracts/commerce";
import { formatVnd } from "@/lib/utils/format";
import { MediaImage } from "@/components/ui/MediaImage";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
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
    <div className={cn("relative grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-3 py-5 transition-opacity md:grid-cols-[130px_minmax(0,1fr)_auto_auto] md:items-center", isMutating && "opacity-50")} role="listitem">
      <div>
        {item.image?.url ? (
          <MediaImage image={item.image} altFallback={item.productName} width={130} height={130} className="h-20 w-20 object-contain md:h-32.5 md:w-32.5" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center bg-secondary font-body text-a2-page font-semibold md:h-32.5 md:w-32.5">{item.productName.slice(0, 2)}</span>
        )}
      </div>

      <div className="min-w-0 pr-12 md:pr-0">
        <h3 className="m-0 font-body text-a3-section font-semibold leading-title">{item.productName}</h3>
        {item.variantName ? <p className="mb-0 mt-1 font-cta text-b5-label font-semibold uppercase text-muted-foreground">{item.variantName}</p> : null}
        <p className="mb-0 mt-2 flex flex-wrap items-baseline gap-x-1 font-semibold leading-snug text-brand">
          <span className="whitespace-nowrap">{item.quantity} × {formatVnd(item.unitPrice)}</span>
          <span aria-hidden>=</span>
          <strong className="whitespace-nowrap">{formatVnd(item.lineTotal)}</strong>
        </p>
        {!item.available && <p className="mb-0 mt-2 font-semibold text-destructive">{t("backorderNotice")}</p>}
      </div>

      <div className="col-start-2 md:col-start-auto">
        {/* Thứ tự chuẩn UX: [-] [ô số] [+] — giảm bên trái, tăng bên phải.
            KHÔNG dùng `js-quantity-wrap`/`js-plus`/`js-minus`: home.min.js
            (change_cart_quantity) bind trực tiếp vào các class đó và ghi `.val()`
            imperative đè input React-controlled. React đã drive +/- qua onClick nên bỏ
            marker; styling dựa `.quantity-form .minus/.plus` nên giữ nguyên giao diện. */}
        <QuantityStepper
          variant="cart"
          value={draftQuantity}
          onDecrease={() => onStep(item.id, -1)}
          onIncrease={() => onStep(item.id, 1)}
          onValueChange={(next) => onDraft(item.id, next)}
          onBlur={() => onBlur(item.id, item.quantity)}
          disabled={isMutating || !item.available}
          decreaseDisabled={draftQuantity <= 1}
          decreaseLabel={t("decreaseQtyAria", { name: item.productName })}
          increaseLabel={t("increaseQtyAria", { name: item.productName })}
          inputLabel={t("quantityAria", { name: item.productName })}
        />
      </div>

      <div className="absolute right-0 top-5 md:relative md:right-auto md:top-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-none text-destructive hover:text-destructive"
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
