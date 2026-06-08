"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type MobileStickyPurchaseBarProps = {
  addToCartLabel: string;
  buyNowLabel: string;
};

export function MobileStickyPurchaseBar({
  addToCartLabel,
  buyNowLabel,
}: MobileStickyPurchaseBarProps) {
  const [visible, setVisible] = useState(false);
  const [addToCartDisabled, setAddToCartDisabled] = useState(false);
  const [buyNowDisabled, setBuyNowDisabled] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(".bb-wp-buttons-row");
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
    const btn = document.querySelector<HTMLButtonElement>(".js-add-to-cart-btn");
    if (!btn) return;

    const sync = () => setAddToCartDisabled(btn.disabled);
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(btn, { attributes: true, attributeFilter: ["disabled"] });
    return () => observer.disconnect();
  }, []);

  // Mirror inline buy-now disabled state.
  useEffect(() => {
    const btn = document.querySelector<HTMLButtonElement>(".js-buy-now-btn");
    if (!btn) return;

    const sync = () => setBuyNowDisabled(btn.disabled);
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(btn, { attributes: true, attributeFilter: ["disabled"] });
    return () => observer.disconnect();
  }, []);

  function handleAddToCart() {
    const btn = document.querySelector<HTMLButtonElement>(".js-add-to-cart-btn");

    if (btn && !btn.disabled) {
      btn.click();
      return;
    }

    // Button disabled = variant not yet selected; scroll to variant section
    const variantEl = document.querySelector<HTMLElement>(".bb-wp-pdp .size");
    if (variantEl) {
      const y = variantEl.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      return;
    }

    // Fallback: scroll to top of info column
    const infoEl = document.querySelector<HTMLElement>(".bb-wp-pdp-info-col");
    if (infoEl) {
      const y = infoEl.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  }

  function handleBuyNow() {
    const btn = document.querySelector<HTMLButtonElement>(".js-buy-now-btn");

    if (btn && !btn.disabled) {
      btn.click();
      return;
    }

    // Variant not selected — scroll up so user can pick one
    const variantEl = document.querySelector<HTMLElement>(".bb-wp-pdp .size");
    if (variantEl) {
      const y = variantEl.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      return;
    }

    const infoEl = document.querySelector<HTMLElement>(".bb-wp-pdp-info-col");
    if (infoEl) {
      const y = infoEl.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  }

  const BASE_BTN =
    "flex-1 h-12 border-none rounded-none font-body text-sm font-bold uppercase tracking-normal cursor-pointer active:opacity-85";

  return (
    <div
      className={cn(
        // bb-pdp-sticky-cta + is-visible kept as markers: the body:has(.bb-pdp-sticky-cta.is-visible)
        // coordination rules (bottom-nav / floating-chat) can't be expressed inline.
        "bb-pdp-sticky-cta",
        visible && "is-visible",
        "hidden max-md:flex max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-[651] max-md:pt-2.5 max-md:px-4 max-md:[padding-bottom:calc(12px_+_env(safe-area-inset-bottom))] max-md:gap-2.5 max-md:bg-white max-md:border-t max-md:border-border max-md:[box-shadow:0_-4px_16px_rgba(0,0,0,0.08)] max-md:[transition-property:transform] max-md:duration-200 max-md:ease-[ease]",
        visible
          ? "max-md:[transform:translateY(0)] max-md:pointer-events-auto"
          : "max-md:[transform:translateY(calc(100%_+_1px))] max-md:pointer-events-none",
      )}
      aria-hidden={!visible}
    >
      <button
        type="button"
        className={cn(
          BASE_BTN,
          "border border-brand text-brand bg-white",
          addToCartDisabled && "opacity-50 cursor-not-allowed",
        )}
        onClick={handleAddToCart}
        aria-label={addToCartLabel}
        aria-disabled={addToCartDisabled}
        tabIndex={visible ? 0 : -1}
      >
        {addToCartLabel}
      </button>

      <button
        type="button"
        className={cn(
          BASE_BTN,
          "text-white",
          buyNowDisabled
            ? "bg-[var(--bb-color-gray-450)] opacity-70 cursor-not-allowed"
            : "bg-brand",
        )}
        onClick={handleBuyNow}
        aria-label={buyNowLabel}
        aria-disabled={buyNowDisabled}
        tabIndex={visible ? 0 : -1}
      >
        {buyNowLabel}
      </button>
    </div>
  );
}
