"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { type RecentProduct, getRecentProducts, saveRecentProduct } from "@/lib/recently-viewed";
import type { Product } from "@/lib/contracts/public";
import { ProductSwiper } from "@/components/catalog/ProductSwiper";

type Props = {
  currentProductId: string;
  currentProduct: RecentProduct;
};

/**
 * Map the lightweight localStorage record onto the Product shape the card reads
 * (name / slug / image / price / rating). Fields the WP card never renders
 * (stock, status, timestamps) get inert defaults.
 */
function toCardProduct(p: RecentProduct): Product {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: { id: "", slug: "", name: p.categoryName ?? "" },
    image: p.imageUrl ? { url: p.imageUrl, alt: p.name } : undefined,
    price: { retailPrice: p.price ?? 0, currency: "VND" },
    stockState: "IN_STOCK",
    publishStatus: "PUBLISHED",
    homepageBlock: "NONE",
    rating: p.rating ?? null,
    ratingCount: p.ratingCount ?? null,
    createdAt: "",
    updatedAt: "",
  };
}

export function RecentlyViewedSection({ currentProductId, currentProduct }: Props) {
  const tRecent = useTranslations("Product.recentlyViewed");
  const [items, setItems] = useState<RecentProduct[]>([]);

  useEffect(() => {
    saveRecentProduct(currentProduct);
    const filtered = getRecentProducts().filter((p) => p.id !== currentProductId).slice(0, 6);
    const id = setTimeout(() => setItems(filtered), 0);
    return () => clearTimeout(id);
  }, [currentProductId, currentProduct]);

  // Need at least 2 other products to make a row worth showing.
  if (items.length < 2) return null;

  // Dùng chung ProductSwiper (chuẩn carousel sản phẩm trang chủ).
  return (
    <div className="product-list pt-40 pb-40">
      <div className="container">
        <div className="block-title text-center mb-40">
          <p className="sub-title">{tRecent("kicker")}</p>
          <h3 id="recently-viewed-heading">{tRecent("heading")}</h3>
        </div>
        <ProductSwiper products={items.map(toCardProduct)} />
      </div>
    </div>
  );
}
