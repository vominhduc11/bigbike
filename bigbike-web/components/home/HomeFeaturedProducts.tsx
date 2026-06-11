"use client";

import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { fetchPublicProductList } from "@/lib/api/client-api";
import { ProductSwiper } from "@/components/catalog/ProductSwiper";
import type { Product } from "@/lib/contracts/public";

/**
 * Carousel "Sản phẩm nổi bật" trang chủ — server render `vi` (initialProducts) cho SEO/ISR;
 * khi đổi sang EN thì refetch khối FEATURED_GRID theo lang ở client. `key={locale}` ép
 * ProductSwiper remount để Swiper init lại sạch với tập sản phẩm mới.
 */
export function HomeFeaturedProducts({ initialProducts }: { initialProducts: Product[] }) {
  const locale = useLocale();
  const isAlt = locale !== DEFAULT_LOCALE;

  const { data } = useQuery({
    queryKey: ["home-featured", locale],
    queryFn: () =>
      fetchPublicProductList({
        page: 1,
        size: 12,
        sort: "homepageOrder:asc",
        homepageBlock: "FEATURED_GRID",
        lang: locale,
      }).then((r) => r.data),
    enabled: isAlt,
    staleTime: 5 * 60 * 1000,
  });

  const products = isAlt && data && data.length > 0 ? data : initialProducts;
  if (products.length === 0) return null;

  return <ProductSwiper key={locale} products={products} />;
}
