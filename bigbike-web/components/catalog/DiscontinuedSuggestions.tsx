"use client";

import { useTranslations } from "next-intl";

import { ProductSwiper } from "@/components/catalog/ProductSwiper";
import type { Product } from "@/lib/contracts/public";

export function DiscontinuedSuggestions({ products }: { products: Product[] }) {
  const t = useTranslations("Product");
  if (products.length === 0) return null;

  return (
    <section id="discontinued-suggestions" aria-labelledby="discontinued-suggestions-title" className="border-t border-border pt-8 md:pt-10">
      <h2 id="discontinued-suggestions-title" className="m-0 font-body text-a3-section font-semibold uppercase leading-title text-foreground">
        {t("discontinuedSuggestionsTitle")}
      </h2>
      <ProductSwiper
        products={products}
        className="mt-2"
        autoHeight
        analyticsList={{ id: "discontinued_suggestions", name: "Gợi ý thay thế hàng ngừng bán" }}
      />
    </section>
  );
}

