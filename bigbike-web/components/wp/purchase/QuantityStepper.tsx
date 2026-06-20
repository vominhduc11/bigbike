"use client";

import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";

// Chọn số lượng — wrapper .options.size để nhãn .group-label ăn đúng
// rule `.product-information .size .group .group-label` của theme WP →
// chữ "Số lượng" hiển thị y hệt nhãn SIZE/COLOR và có padding-right tách
// khỏi stepper. Stepper cao 52px khớp ô biến thể.
export function QuantityStepper({
  quantity,
  setQuantity,
}: {
  quantity: number;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
}) {
  const tb = useTranslations("PdpBuyBox");
  return (
    <div className="options size">
      <div className="group flex items-center">
        <div className="group-label">
          <label htmlFor="bb-qty">{tb("quantity")}</label>
        </div>
        <div className="inline-flex items-stretch border border-border-control">
          <button
            type="button"
            aria-label={tb("decreaseQty")}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="flex h-[52px] w-11 items-center justify-center text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            id="bb-qty"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            aria-label={tb("quantity")}
            className="h-[52px] w-16 border-x border-border-control bg-white text-center font-body text-2xl font-semibold text-foreground [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            aria-label={tb("increaseQty")}
            onClick={() => setQuantity((q) => q + 1)}
            className="flex h-[52px] w-11 items-center justify-center text-foreground transition-colors hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
