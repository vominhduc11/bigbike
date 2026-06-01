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
          <div className="row bb-wp-row bb-product-grid">
            {products.map((product) => (
              <div key={product.id} className="col-md-3 col-6 bb-wp-col-md-3 bb-wp-col-6">
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
