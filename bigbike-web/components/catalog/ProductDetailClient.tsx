"use client";

import { useState } from "react";
import type { ImageAsset, Product } from "@/lib/contracts/public";
import { ProductGallery } from "./ProductGallery";
import { ProductPurchasePanel } from "./ProductPurchasePanel";

type ProductDetailClientProps = {
  product: Product;
  gallery: ImageAsset[];
  altFallback: string;
  infoSlot: React.ReactNode;
};

export function ProductDetailClient({ product, gallery, altFallback, infoSlot }: ProductDetailClientProps) {
  const [variantImage, setVariantImage] = useState<ImageAsset | null>(null);

  return (
    <>
      <ProductGallery
        mainImage={product.image}
        gallery={gallery}
        altFallback={altFallback}
        variantImage={variantImage}
      />
      <div className="wp-pdp-info">
        {infoSlot}
        <ProductPurchasePanel product={product} onVariantImageChange={setVariantImage} />
      </div>
    </>
  );
}
