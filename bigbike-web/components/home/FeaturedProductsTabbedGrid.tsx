"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/contracts/public";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Props = { products: Product[] };

const SALE_TAB = "__sale__";

/** Sản phẩm có giảm giá thật: giá sale thấp hơn giá gốc, hoặc có giá so sánh cao hơn giá hiện tại. */
function isOnSale(p: Product): boolean {
  const retail = p.price?.retailPrice ?? 0;
  const sale = p.price?.salePrice && p.price.salePrice > 0 ? p.price.salePrice : null;
  const compare =
    p.price?.compareAtPrice && p.price.compareAtPrice > 0 ? p.price.compareAtPrice : null;
  const current = sale ?? retail;
  return Boolean((sale && sale < retail) || (compare && compare > current));
}

/**
 * Khối "Sản phẩm nổi bật" trang chủ — tab lọc + lưới sản phẩm (bám bản thiết kế).
 * Tab "Khuyến mãi" hiện khi có hàng giảm giá; mỗi danh mục xuất hiện trong danh sách
 * sản phẩm là một tab. Lọc phía trình duyệt nên không gọi thêm API.
 */
export function FeaturedProductsTabbedGrid({ products }: Props) {
  const tabs = useMemo(() => {
    const list: { key: string; label: string }[] = [];
    if (products.some(isOnSale)) {
      list.push({ key: SALE_TAB, label: "Khuyến mãi" });
    }
    const seen = new Set<string>();
    for (const p of products) {
      if (p.category && !seen.has(p.category.id)) {
        seen.add(p.category.id);
        list.push({ key: p.category.id, label: p.category.name });
      }
    }
    return list;
  }, [products]);

  const [active, setActive] = useState(() => tabs[0]?.key ?? "");

  if (products.length === 0 || tabs.length === 0) return null;

  const productsForTab = (key: string): Product[] =>
    key === SALE_TAB
      ? products.filter(isOnSale)
      : products.filter((p) => p.category?.id === key);

  return (
    <Tabs value={active} onValueChange={setActive}>
      {tabs.length > 1 && (
        <TabsList className="mb-8 flex flex-wrap justify-center gap-1 border-b-0 bg-transparent">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              // whitespace-normal + max-width: long category names (e.g. 50+ ký tự)
              // must wrap instead of forcing a tab wider than a 320px phone.
              className="max-w-full whitespace-normal border-b-0 px-5 py-2.5 text-center leading-tight tracking-[0.06em] transition-colors hover:text-foreground data-[state=active]:bg-brand data-[state=active]:text-white"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      )}
      {tabs.map((t) => (
        <TabsContent key={t.key} value={t.key} className="mt-0">
          <div className="grid grid-cols-4 gap-5 max-[900px]:grid-cols-3 max-[600px]:grid-cols-2">
            {productsForTab(t.key).map((p) => (
              <ProductCard key={p.id} product={p} variant="featured" />
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
