"use client";

import { useEffect, useRef } from "react";
import { pushDataLayer, type GtmProductItem } from "@/lib/analytics";
import type { Product } from "@/lib/contracts/public";

type AnalyticsViewProps = {
  product: Product;
};

function toGtmItem(product: Product): GtmProductItem {
  return {
    item_id: product.id,
    item_name: product.name,
    item_brand: product.brand?.name,
    item_category: product.category?.name,
    price: product.price?.salePrice ?? product.price?.retailPrice ?? undefined,
    currency: product.price?.currency ?? "VND",
    quantity: 1,
  };
}

export function AnalyticsView({ product }: AnalyticsViewProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    const item = toGtmItem(product);
    pushDataLayer("view_item", {
      currency: item.currency,
      value: item.price,
      items: [item],
    });
  }, [product]);

  return null;
}
