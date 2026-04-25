"use client";

import { useEffect, useRef } from "react";
import { pushDataLayer } from "@/lib/analytics";

type PurchaseEventProps = {
  orderId: string;
  orderNumber: string;
  revenue: number;
  currency: string;
  items: Array<{
    item_id: string;
    item_name: string;
    price: number;
    quantity: number;
  }>;
};

export function PurchaseEvent({ orderId, orderNumber, revenue, currency, items }: PurchaseEventProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    const key = `purchase_fired_${orderId}`;
    if (sessionStorage.getItem(key)) return;
    firedRef.current = true;
    sessionStorage.setItem(key, "1");

    pushDataLayer("purchase", {
      transaction_id: orderNumber,
      value: revenue,
      currency,
      items,
    });
  }, [orderId, orderNumber, revenue, currency, items]);

  return null;
}
