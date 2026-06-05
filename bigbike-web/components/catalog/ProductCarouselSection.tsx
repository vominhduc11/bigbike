import { cn } from "@/lib/utils";
import { FeaturedProductsCarousel } from "@/components/home/FeaturedProductsCarousel";
import { sectionEyebrow, sectionHeading } from "@/lib/ui-classes";
import type { Product } from "@/lib/contracts/public";

type ProductCarouselSectionProps = {
  products: Product[];
  /** Small uppercase eyebrow above the title. Omit to hide the eyebrow row. */
  kicker?: string;
  /** Large section title. */
  heading: string;
  /** Unique id wired to the section's aria-labelledby. */
  headingId: string;
  /** Section rail + vertical spacing. Defaults to the PDP content rail. */
  className?: string;
};

const DEFAULT_RAIL =
  "mx-auto max-w-[1140px] px-[15px] mt-20 mb-10 max-md:mt-9 max-md:px-[var(--bb-mobile-page-x)] min-[1536px]:max-w-[1360px] min-[1920px]:max-w-[1600px]";

/**
 * A curated row of products rendered with the homepage featured-products
 * carousel (paged arrows + dots, hover-cart cards) under the canonical section
 * heading. Shared by the PDP "Sản phẩm liên quan", PDP "Sản phẩm đã xem" and the
 * blog featured-products block so every curated product row reads as one design.
 */
export function ProductCarouselSection({
  products,
  kicker,
  heading,
  headingId,
  className = DEFAULT_RAIL,
}: ProductCarouselSectionProps) {
  if (products.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={className}>
      <div className="flex flex-col items-center justify-center mb-[40px] text-center text-foreground max-md:mb-[14px] max-md:px-[var(--bb-mobile-page-x)]">
        {kicker && <p className={cn(sectionEyebrow, "mb-3")}>{kicker}</p>}
        <h2 id={headingId} className={sectionHeading}>
          {heading}
        </h2>
      </div>

      <FeaturedProductsCarousel products={products} />
    </section>
  );
}
