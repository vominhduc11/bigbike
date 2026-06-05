"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { type RecentProduct, getRecentProducts, saveRecentProduct } from "@/lib/recently-viewed";
import type { Product } from "@/lib/contracts/public";
import { ProductCarouselSection } from "@/components/catalog/ProductCarouselSection";

type Props = {
  currentProductId: string;
  currentProduct: RecentProduct;
};

/**
 * Map the lightweight localStorage record onto the Product shape the carousel
 * cards read (name / slug / image / price / rating). Fields the home featured
 * card never renders (category, stock, status, timestamps) get inert defaults.
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

  return (
    <ProductCarouselSection
      products={items.map(toCardProduct)}
      heading={tRecent("heading")}
      headingId="recently-viewed-heading"
      className="mx-auto max-w-[1140px] px-[15px] mt-12 mb-10 pt-9 border-t border-[color:var(--bb-border-default)] max-md:px-[var(--bb-mobile-page-x)] min-[1536px]:max-w-[1360px] min-[1920px]:max-w-[1600px]"
    />
  );
}
