"use client";

import { useLocale } from "next-intl";
import { ProductSwiper } from "@/components/catalog/ProductSwiper";
import type { Product } from "@/lib/contracts/public";

/**
 * Carousel "Sản phẩm nổi bật" trang chủ — server render `vi` (initialProducts) cho SEO/ISR;
 * khi đổi sang EN thì refetch khối FEATURED_GRID theo lang ở client. `key={locale}` ép
 * ProductSwiper remount để Swiper init lại sạch với tập sản phẩm mới.
 */
export function HomeFeaturedProducts({ initialProducts }: { initialProducts: Product[] }) {
  const locale = useLocale();
  const products = initialProducts;
  if (products.length === 0) return null;

  return (
    <ProductSwiper
      key={locale}
      products={products}
      autoplay
      analyticsList={{ id: "home_featured", name: "Sản phẩm nổi bật" }}
    />
  );
}
