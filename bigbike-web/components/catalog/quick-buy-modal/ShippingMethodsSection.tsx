"use client";

import { useTranslations } from "next-intl";
import type { ShippingMethodOption } from "@/lib/contracts/commerce";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/utils/format";

type ShippingEstimate = { isFree: boolean; cost: number } | null;

type ShippingMethodsSectionProps = {
  availableMethodsForRegion: ShippingMethodOption[];
  shippingEstimate: ShippingEstimate;
  selectedShippingId: string;
  isSubmitting: boolean;
  unitPrice?: number | null;
  quantity: number;
  onSelect: (methodId: string) => void;
};

/** Khối "Phương thức vận chuyển" của hộp thoại Mua nhanh (chỉ hiển thị khi đã chọn tỉnh). */
export function ShippingMethodsSection({
  availableMethodsForRegion,
  shippingEstimate,
  selectedShippingId,
  isSubmitting,
  unitPrice,
  quantity,
  onSelect,
}: ShippingMethodsSectionProps) {
  const tQb = useTranslations("Checkout.quickbuy");

  return (
    <section>
      <p className="text-overline font-semibold uppercase tracking-display text-muted-foreground mb-3">
        {tQb("shippingSection")}
      </p>
      {availableMethodsForRegion.length === 0 ? (
        <p className="text-caption text-muted-foreground">{tQb("summaryShippingUnknown")}</p>
      ) : availableMethodsForRegion.length === 1 ? (
        <div className="flex items-center justify-between px-3 py-2.5 border border-border text-caption">
          <span className="font-medium">{availableMethodsForRegion[0].title}</span>
          <span className={cn("font-medium tabular-nums", shippingEstimate?.isFree && "text-state-success-text")}>
            {shippingEstimate
              ? shippingEstimate.isFree
                ? tQb("summaryShippingFree")
                : formatVnd(shippingEstimate.cost)
              : "—"}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {availableMethodsForRegion.map((method) => {
            const subtotal = (unitPrice ?? 0) * quantity;
            const isFree = method.freeShippingThreshold != null && subtotal >= method.freeShippingThreshold;
            const cost = isFree ? 0 : method.cost;
            return (
              <label
                key={method.id}
                className={cn(
                  "flex items-center justify-between gap-3 p-3 border cursor-pointer transition-colors",
                  selectedShippingId === method.id
                    ? "border-foreground bg-muted/40"
                    : "border-border hover:border-foreground/40",
                  isSubmitting && "opacity-60 cursor-not-allowed",
                )}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="shippingMethodId"
                    value={method.id}
                    checked={selectedShippingId === method.id}
                    onChange={() => onSelect(method.id)}
                    disabled={isSubmitting}
                    className="accent-foreground"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption font-medium">{method.title}</span>
                    {method.freeShippingThreshold != null && !isFree && (
                      <span className="text-overline text-muted-foreground">
                        {tQb("shippingFreeFrom", { amount: formatVnd(method.freeShippingThreshold) })}
                      </span>
                    )}
                  </div>
                </div>
                <span className={cn("text-caption font-semibold tabular-nums shrink-0", isFree && "text-state-success-text")}>
                  {isFree ? tQb("summaryShippingFree") : formatVnd(cost)}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}
