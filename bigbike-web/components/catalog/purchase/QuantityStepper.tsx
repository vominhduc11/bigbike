"use client";

import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div>
      <div className="flex items-center gap-4">
        <label htmlFor="bb-qty" className="min-w-24 font-cta text-a4-content font-semibold uppercase text-foreground">
          {tb("quantity")}
        </label>
        <div className="flex flex-1 items-stretch border border-border-control">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={tb("decreaseQty")}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="h-13! w-11! rounded-none border-0 hover:bg-muted"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Input
            id="bb-qty"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            aria-label={tb("quantity")}
            className="h-13! min-h-0 w-full min-w-0 flex-1 rounded-none border-y-0 border-x border-border-control px-1 py-0 text-center text-a2-page font-semibold [appearance:textfield] focus:shadow-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={tb("increaseQty")}
            onClick={() => setQuantity((q) => q + 1)}
            className="h-13! w-11! rounded-none border-0 hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
