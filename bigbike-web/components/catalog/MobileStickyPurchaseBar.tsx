"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type MobileStickyPurchaseBarProps = {
  addToCartLabel: string;
  soldOutLabel: string;
  zaloUrl?: string;
};

export function MobileStickyPurchaseBar({
  addToCartLabel,
  soldOutLabel,
  zaloUrl,
}: MobileStickyPurchaseBarProps) {
  const [visible, setVisible] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [soldOut, setSoldOut] = useState(false);
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

  // Mirror the inline add-to-cart button's enabled/sold-out state so the sticky
  // CTA never reads as an actionable red bar when the product can't be added.
  useEffect(() => {
    const btn = document.querySelector<HTMLButtonElement>(".js-add-to-cart-btn");
    if (!btn) return;

    const sync = () => {
      setDisabled(btn.disabled);
      setSoldOut(btn.dataset.soldout === "true");
    };
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(btn, {
      attributes: true,
      attributeFilter: ["disabled", "data-soldout"],
    });
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

  const label = soldOut ? soldOutLabel : addToCartLabel;

  return (
    <div
      className={cn(
        // bb-pdp-sticky-cta + is-visible kept as markers: the body:has(.bb-pdp-sticky-cta.is-visible)
        // coordination rules (bottom-nav / floating-chat) can't be expressed inline.
        "bb-pdp-sticky-cta",
        visible && "is-visible",
        // bottom/padding-bottom(12px)/z-index(651) are the EFFECTIVE values from the
        // mobile-audit override of .bb-pdp-sticky-cta, not the original base (10px/100).
        "hidden max-md:flex max-md:gap-2.5 max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-[651] max-md:pt-2.5 max-md:px-4 max-md:[padding-bottom:calc(12px_+_env(safe-area-inset-bottom))] max-md:bg-white max-md:border-t max-md:border-border max-md:[box-shadow:0_-4px_16px_rgba(0,0,0,0.08)] max-md:[transition-property:transform] max-md:duration-200 max-md:ease-[ease]",
        visible
          ? "max-md:[transform:translateY(0)] max-md:pointer-events-auto"
          : "max-md:[transform:translateY(calc(100%_+_1px))] max-md:pointer-events-none",
      )}
      aria-hidden={!visible}
    >
      <button
        type="button"
        className={cn(
          // text-white on the base: the old .bb-pdp-sticky-add{color:#fff} applied in
          // BOTH states (is-disabled only changed bg/opacity/cursor).
          "max-md:flex-1 max-md:h-12 max-md:border-none max-md:rounded-none max-md:text-white max-md:font-body max-md:text-sm max-md:font-bold max-md:uppercase max-md:tracking-[0.04em] max-md:cursor-pointer max-md:active:opacity-85",
          disabled
            ? "max-md:bg-[var(--bb-color-gray-450)] max-md:opacity-70 max-md:cursor-not-allowed"
            : "max-md:bg-brand",
        )}
        onClick={handleAddToCart}
        aria-label={label}
        aria-disabled={disabled}
        tabIndex={visible ? 0 : -1}
      >
        {label}
      </button>

      {zaloUrl ? (
        <a
          href={zaloUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="max-md:flex-none max-md:inline-flex max-md:items-center max-md:justify-center max-md:h-12 max-md:px-4 max-md:border-2 max-md:border-black max-md:rounded-none max-md:text-black max-md:font-body max-md:text-ui-13 max-md:font-bold max-md:no-underline max-md:uppercase max-md:whitespace-nowrap"
          aria-label="Tư vấn qua Zalo"
          tabIndex={visible ? 0 : -1}
        >
          Tư vấn
        </a>
      ) : null}
    </div>
  );
}
