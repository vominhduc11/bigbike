"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { zaloHref } from "@/lib/utils/format";
import { ZaloIcon } from "@/components/ui/ZaloIcon";
import { Button } from "@/components/ui/button";

type MobileStickyPurchaseBarProps = {
  addToCartLabel: string;
  zaloLabel: string;
  zaloUrl?: string;
  /** Hết hàng: ẩn nút "Thêm vào giỏ", chỉ giữ nút "Tư vấn Zalo" (chiếm full ngang). */
  outOfStock?: boolean;
  /** Khung xem trước admin: cả 2 nút chỉ để nhìn — làm mờ + khóa bấm. */
  previewMode?: boolean;
};

export function MobileStickyPurchaseBar({
  addToCartLabel,
  zaloLabel,
  zaloUrl,
  outOfStock = false,
  previewMode = false,
}: MobileStickyPurchaseBarProps) {
  const [visible, setVisible] = useState(false);
  const [addToCartDisabled, setAddToCartDisabled] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const target = document.querySelector<HTMLElement>("[data-purchase-actions]");
    if (!target) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry ? !entry.isIntersecting : false);
      },
      { threshold: 0 },
    );
    observerRef.current.observe(target);

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Mirror inline add-to-cart disabled state (e.g. variant not yet picked).
  useEffect(() => {
    const btn = document.querySelector<HTMLButtonElement>("[data-purchase-add]");
    if (!btn) return;

    const sync = () => setAddToCartDisabled(btn.disabled);
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(btn, { attributes: true, attributeFilter: ["disabled"] });
    return () => observer.disconnect();
  }, []);

  // Xem trước: nút chỉ để nhìn, mọi nút đều mờ + khóa bấm (không thêm giỏ, không cuộn).
  const addDisabled = addToCartDisabled || previewMode;

  function handleAddToCart() {
    if (previewMode) return;
    const btn = document.querySelector<HTMLButtonElement>("[data-purchase-add]");

    if (btn && !btn.disabled) {
      btn.click();
      return;
    }

    // Button disabled = variant not yet selected; scroll to variant section
    const variantEl = document.querySelector<HTMLElement>("[data-variant-picker]");
    if (variantEl) {
      const y = variantEl.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      return;
    }

    // Fallback: scroll to top of info column
    const infoEl = document.querySelector<HTMLElement>("[data-purchase-info]");
    if (infoEl) {
      const y = infoEl.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  }

  // h-14 (56px) + pt-3 (12px) + border 1px + padding-bottom max(8px, safe-area) khớp
  // ĐÚNG chiều cao bottom nav (.bb-bottom-nav = 69px + max(8px, safe)) để khi bar thế
  // chỗ nav lúc nav trượt ra thì không bị giật chiều cao.
  // Tỉ lệ 60/40: nút giỏ hàng flex-[3], nút Zalo flex-[2] (3:2 = 60:40). Khi hết hàng
  // ẩn nút giỏ, nút Zalo còn lại tự chiếm full ngang (flex-grow lấp hết chỗ trống).
  const BASE_BTN =
    "h-14 flex items-center justify-center rounded-none font-cta text-b4-action font-bold uppercase tracking-normal cursor-pointer active:opacity-85";

  return (
    <div
      className={cn(
        // bb-pdp-sticky-cta + is-visible kept as markers: the body:has(.bb-pdp-sticky-cta.is-visible)
        // coordination rules (bottom-nav / floating-chat) can't be expressed inline.
        "bb-pdp-sticky-cta",
        visible && "is-visible",
        // Display toggle uses the proven `flex md:hidden` pattern (same as
        // MobileBottomNav): in Tailwind v4 a base `hidden` + `max-md:flex` can
        // leave `hidden` winning the cascade, so the bar stayed display:none
        // while still matching body:has(.is-visible) (which hides the bottom nav
        // even for a display:none element) — that produced "nav disappears but
        // bar never shows". `flex` is the mobile state; `md:hidden` hides ≥768.
        "flex md:hidden fixed bottom-0 left-0 right-0 z-[651] pt-3 px-4 [padding-bottom:max(8px,env(safe-area-inset-bottom))] gap-2.5 bg-white border-t border-border [box-shadow:0_-4px_16px_rgba(0,0,0,0.08)] [transition-property:transform] duration-200 ease-[ease]",
        visible
          ? "[transform:translateY(0)] pointer-events-auto"
          : "[transform:translateY(calc(100%_+_1px))] pointer-events-none",
      )}
      aria-hidden={!visible}
    >
      {/* Hết hàng thì bỏ nút thêm giỏ; nút Tư vấn Zalo (flex-1) tự chiếm full ngang. */}
      {!outOfStock ? (
        <Button
          type="button"
          variant="primary"
          className={cn(
            BASE_BTN,
            "flex-[3] rounded-none border-none bg-brand text-white",
            addDisabled && "opacity-50 cursor-not-allowed",
          )}
          onClick={handleAddToCart}
          aria-label={addToCartLabel}
          aria-disabled={addDisabled}
          tabIndex={visible && !previewMode ? 0 : -1}
        >
          {addToCartLabel}
        </Button>
      ) : null}

      {previewMode ? (
        // Xem trước: nút Zalo mở link ngoài → thay bằng span mờ, khóa bấm.
        <span
          aria-label={zaloLabel}
          aria-disabled="true"
          className={cn(
            BASE_BTN,
            "flex-[2] rounded-none border border-zalo bg-white text-zalo opacity-50 cursor-not-allowed",
          )}
        >
          <ZaloIcon className="size-5 shrink-0" />
          {zaloLabel}
        </span>
      ) : (
        <Button
          asChild
          variant="outline"
          className={cn(
            BASE_BTN,
            // Kiểu Zalo phụ: nền trắng, viền + chữ + LOGO xanh Zalo (logo lấy currentColor).
            "flex-[2] rounded-none border border-zalo bg-white text-zalo hover:bg-zalo-soft hover:text-zalo",
          )}
        >
          <a
            href={zaloUrl ? zaloHref(zaloUrl) : "#"}
            target={zaloUrl ? "_blank" : undefined}
            rel={zaloUrl ? "noopener noreferrer" : undefined}
            aria-label={zaloLabel}
            tabIndex={visible ? 0 : -1}
          >
            <ZaloIcon className="size-5 shrink-0" />
            {zaloLabel}
          </a>
        </Button>
      )}
    </div>
  );
}
