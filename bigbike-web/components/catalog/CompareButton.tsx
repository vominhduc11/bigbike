"use client";

import { useCart } from "@/lib/cart-context";
import { useCompare } from "@/lib/compare-context";
import type { CompareProduct } from "@/lib/compare-storage";
import { cn } from "@/lib/utils";

type CompareButtonProps = {
  product: CompareProduct;
  /** "icon" — small round button for product cards; "full" — labelled button for the PDP. */
  variant?: "icon" | "full";
};

/** Two-arrows "compare/swap" glyph. */
function CompareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 3l4 4-4 4" />
      <path d="M20 7H8" />
      <path d="M8 21l-4-4 4-4" />
      <path d="M4 17h12" />
    </svg>
  );
}

export function CompareButton({ product, variant = "icon" }: CompareButtonProps) {
  const { toggle, isComparing } = useCompare();
  const { showToast } = useCart();
  const active = isComparing(product.id);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const result = toggle(product);
    if (result.ok) return;
    if (result.reason === "full") {
      showToast("KHÔNG THỂ SO SÁNH", "Chỉ so sánh tối đa 3 sản phẩm cùng lúc.");
    } else {
      showToast("KHÔNG THỂ SO SÁNH", "Chỉ so sánh được các sản phẩm cùng loại.");
    }
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={active}
        className={cn(
          "mt-2 flex items-center justify-center gap-2 border-2 px-4 py-3 font-heading text-sm font-semibold uppercase tracking-wide transition-colors",
          active
            ? "border-brand bg-brand-soft text-brand"
            : "border-border text-foreground hover:border-brand hover:text-brand",
        )}
      >
        <CompareIcon size={16} />
        {active ? "Đang so sánh" : "So sánh sản phẩm"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? "Bỏ khỏi so sánh" : "Thêm vào so sánh"}
      className={cn(
        "bb-round absolute top-[52px] right-[10px] z-[3] flex h-[34px] w-[34px] items-center justify-center rounded-full border p-0 transition-colors duration-300",
        active
          ? "border-brand bg-brand-soft text-brand"
          : "border-border bg-white/95 text-muted-foreground hover:border-brand hover:bg-white hover:text-brand",
      )}
    >
      <CompareIcon />
    </button>
  );
}
