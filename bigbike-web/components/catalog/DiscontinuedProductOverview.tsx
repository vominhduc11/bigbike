"use client";

import { ProductGallery } from "@/components/catalog/ProductGallery";
import { DiscontinuedStatusPanel } from "@/components/catalog/DiscontinuedStatusPanel";
import { DiscontinuedTrustStrip } from "@/components/catalog/DiscontinuedTrustStrip";
import type { GalleryMedia, Product } from "@/lib/contracts/public";

export function DiscontinuedProductOverview({
  product,
  gallery,
  zaloUrl,
  hasSuggestions,
}: {
  product: Product;
  gallery: GalleryMedia[];
  zaloUrl?: string;
  hasSuggestions: boolean;
}) {
  const name = product.name;
  const category = product.category ?? product.categories?.[0];
  const hasImage = Boolean(
    product.image?.url?.trim() ||
      gallery.some((media) => media.mediaType !== "video" && media.image?.url?.trim()),
  );

  return (
    <>
      <div
        data-discontinued-overview
        className={hasImage ? "grid items-start gap-8 min-[1024px]:grid-cols-12" : undefined}
      >
        {hasImage ? (
          <div className="order-2 min-w-0 min-[1024px]:order-1 min-[1024px]:col-span-7">
            <ProductGallery mainImage={product.image} gallery={gallery} altFallback={name} />
          </div>
        ) : null}
        <div className={hasImage ? "order-1 min-w-0 min-[1024px]:order-2 min-[1024px]:col-span-5" : undefined}>
          <DiscontinuedStatusPanel
            name={name}
            categorySlug={category?.slug}
            categorySlugEn={category?.slugEn}
            categoryName={category?.name}
            brand={product.brand}
            hasSuggestions={hasSuggestions}
            zaloUrl={zaloUrl}
          />
        </div>
      </div>
      <DiscontinuedTrustStrip html={product.trustBadges} />
    </>
  );
}
