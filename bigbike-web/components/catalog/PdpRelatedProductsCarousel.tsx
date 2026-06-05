import { ProductCarouselSection } from "@/components/catalog/ProductCarouselSection";
import type { Product } from "@/lib/contracts/public";

type PdpRelatedProductsCarouselProps = {
  products: Product[];
  kicker?: string;
  heading?: string;
};

/**
 * PDP "Sản phẩm liên quan" section — a thin wrapper over ProductCarouselSection
 * (homepage featured-carousel style) carrying the related-products copy.
 */
export function PdpRelatedProductsCarousel({
  products,
  kicker = "Sản phẩm liên quan",
  heading = "Sản phẩm tương tự",
}: PdpRelatedProductsCarouselProps) {
  return (
    <ProductCarouselSection
      products={products}
      kicker={kicker}
      heading={heading}
      headingId="related-products-heading"
    />
  );
}
