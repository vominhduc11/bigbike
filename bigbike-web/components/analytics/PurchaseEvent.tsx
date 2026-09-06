"use client";

import { useEffect, useRef } from "react";
import { trackPurchase } from "@/lib/analytics";
import type { OrderDetail } from "@/lib/contracts/commerce";

type PurchaseEventProps = {
  order: OrderDetail;
};

/**
 * Fires GA4 `purchase` exactly once per order.
 *
 * Two guards, both needed: the ref stops the effect from re-firing while this tab is open (the
 * confirmation page polls, so `order` gets a new identity every 15s), and the sessionStorage key
 * survives a reload of the same tab — the confirmation URL is bookmarkable and customers do
 * refresh it. Double-firing here would double the shop's reported revenue.
 */
export function PurchaseEvent({ order }: PurchaseEventProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    const key = `purchase_fired_${order.id}`;
    // Private-browsing and blocked-storage modes throw on access. Losing the cross-reload guard
    // is acceptable; taking the confirmation page down with it is not.
    let alreadyFired = false;
    try {
      alreadyFired = window.sessionStorage.getItem(key) != null;
    } catch {
      alreadyFired = false;
    }
    if (alreadyFired) return;
    firedRef.current = true;
    try {
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Ignore — the in-memory ref still prevents a repeat within this page view.
    }

    trackPurchase(order);
  }, [order]);

  return null;
}
