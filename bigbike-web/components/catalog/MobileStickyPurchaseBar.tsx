"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type MobileStickyPurchaseBarProps = {
  addToCartLabel: string;
  zaloUrl?: string;
};

export function MobileStickyPurchaseBar({
  addToCartLabel,
  zaloUrl,
}: MobileStickyPurchaseBarProps) {
  const [visible, setVisible] = useState(false);
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

  return (
    <div
      className={cn("bb-pdp-sticky-cta", visible && "is-visible")}
      aria-hidden={!visible}
    >
      <button
        type="button"
        className="bb-pdp-sticky-add"
        onClick={handleAddToCart}
        aria-label={addToCartLabel}
        tabIndex={visible ? 0 : -1}
      >
        {addToCartLabel}
      </button>

      {zaloUrl ? (
        <a
          href={zaloUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bb-pdp-sticky-consult"
          aria-label="Tư vấn qua Zalo"
          tabIndex={visible ? 0 : -1}
        >
          Tư vấn
        </a>
      ) : null}
    </div>
  );
}
