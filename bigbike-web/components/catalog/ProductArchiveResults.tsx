import type { ReactNode } from "react";
import type { Product } from "@/lib/contracts/public";
import { ProductCard } from "@/components/catalog/ProductCard";
import { PaginationNav } from "@/components/ui/PaginationNav";

type ProductArchiveResultsProps = {
  products: Product[];
  /** Whether the list request errored (the message itself lives in `errorContent`). */
  hasError: boolean;
  pagination: { page: number; totalPages: number } | null;
  /** Fully-built pagination base href (caller composes prefix + query string). */
  baseHref: string;
  /** Rendered when there are no products and no error. */
  emptyContent: ReactNode;
  /** Rendered when there are no products and the request errored. */
  errorContent: ReactNode;
  /** Optional block rendered before the results (e.g. a category description). */
  leadingContent?: ReactNode;
};

/**
 * Shared results tail for the product archive pages (`/san-pham`,
 * `/danh-muc-san-pham/[slug]`, `/brands/[slug]`): the product grid + archive
 * pagination, with the empty / error / leading slots supplied by the caller
 * (they diverge per page — i18n vs literal empty text, woocommerce `<p>` vs
 * `<ErrorState>` error, category description). Renders inside ProductArchiveLayout.
 */
export function ProductArchiveResults({
  products,
  hasError,
  pagination,
  baseHref,
  emptyContent,
  errorContent,
  leadingContent,
}: ProductArchiveResultsProps) {
  return (
    <>
      {leadingContent}
      {hasError && products.length === 0 ? (
        errorContent
      ) : products.length === 0 ? (
        emptyContent
      ) : (
        <>
          <div className="grid grid-cols-2 flex-wrap gap-[30px] mx-0 max-md:items-stretch md:flex md:gap-0 md:-mx-[15px]">
            {products.map((product) => (
              <div
                key={product.id}
                className="min-w-0 w-auto max-w-none flex-initial col-auto px-0 md:w-full md:px-[15px] md:flex-[0_0_25%] md:max-w-[25%] 4xl:flex-[0_0_20%] 4xl:max-w-[20%]"
              >
                <ProductCard product={product} variant="archive" />
              </div>
            ))}
          </div>
          {pagination ? (
            <PaginationNav
              page={pagination.page}
              totalPages={pagination.totalPages}
              baseHref={baseHref}
              variant="archive"
            />
          ) : null}
        </>
      )}
    </>
  );
}
