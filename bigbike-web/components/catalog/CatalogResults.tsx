"use client";

import { Fragment, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import { CatalogSort } from "@/components/catalog/CatalogSort";
import { MobileFilterTrigger } from "@/components/catalog/MobileFilterTrigger";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductCardSkel } from "@/components/ui/skeleton/primitives";
import Link from "@/i18n/StorefrontLink";
import type { Product } from "@/lib/contracts/public";
import type { CatalogOrderbyValue } from "@/lib/utils/catalog-sort";
import { cn } from "@/lib/utils";

type CatalogPaginationData = {
  page: number;
  totalPages: number;
  totalItems?: number | null;
};

export type CatalogResultsProps = {
  orderbyCurrent: CatalogOrderbyValue;
  pagination?: CatalogPaginationData | null;
  products: Product[];
  notice?: string | null;
  emptyActionHref?: string | null;
  emptyActionLabel?: string | null;
  beforeGrid?: ReactNode;
  activeFilters?: ReactNode;
  activeFilterCount?: number;
  paginationBaseHref: string;
  isLoading?: boolean;
  isRefetching?: boolean;
};

export function CatalogResults({
  orderbyCurrent,
  pagination,
  products,
  notice = null,
  emptyActionHref = null,
  emptyActionLabel = null,
  beforeGrid,
  activeFilters,
  activeFilterCount = 0,
  paginationBaseHref,
  isLoading = false,
  isRefetching = false,
}: CatalogResultsProps) {
  const t = useTranslations("Catalog");
  return (
    <div className="min-w-0">
      <div className="pb-10">
        <div className="sticky top-[var(--bb-header-height)] z-20 bg-background py-4 md:static md:top-auto">
          <div className="-mx-4 grid grid-cols-2 items-center sm:-mx-6 md:mx-0 md:flex md:justify-between md:gap-6">
            <div className="order-3 col-span-2 mt-4 px-4 font-semibold sm:px-6 md:order-1 md:mt-0 md:px-0">
              {pagination?.totalItems != null ? t("productCountLabel", { count: pagination.totalItems }) : null}
            </div>
            <div className="order-2 md:order-2">
              <CatalogSort current={orderbyCurrent} />
            </div>
            <MobileFilterTrigger activeCount={activeFilterCount} />
          </div>
        </div>

        {activeFilterCount > 0 ? (
          <div className="mb-4" aria-label={t("activeFilters")}>{activeFilters}</div>
        ) : null}

        <div>
          {beforeGrid != null ? <Fragment key="before-grid">{beforeGrid}</Fragment> : null}
          {isLoading ? (
            <div className="grid grid-cols-2 gap-x-5 md:grid-cols-4 md:gap-x-8">
              {Array.from({ length: 8 }).map((_, index) => <ProductCardSkel key={index} />)}
            </div>
          ) : notice != null ? (
            <div className="my-8 border border-border bg-secondary p-5" role="status">
              <p className="m-0 font-semibold">{activeFilterCount > 0 ? t("noMatchingProducts") : notice}</p>
              {activeFilterCount > 0 ? <div className="mt-4">{activeFilters}</div> : null}
              {emptyActionHref && emptyActionLabel ? (
                <Link
                  href={emptyActionHref}
                  className="mt-4 inline-flex min-h-11 items-center border border-brand bg-brand px-5 py-3 font-semibold text-primary-foreground no-underline!"
                >
                  {emptyActionLabel}
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="relative">
              <div
                data-catalog-product-grid
                className={cn("grid grid-cols-2 gap-x-5 transition-opacity duration-200 md:grid-cols-4 md:gap-x-8", isRefetching && "opacity-50")}
                aria-busy={isRefetching || undefined}
              >
                {products.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
              {isRefetching ? (
                <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-16" role="status">
                  <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden />
                  <span className="sr-only">{t("updating")}</span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {pagination ? <CatalogPagination page={pagination.page} totalPages={pagination.totalPages} baseHref={paginationBaseHref} /> : null}
    </div>
  );
}
