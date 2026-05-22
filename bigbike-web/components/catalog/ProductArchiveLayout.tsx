"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { CatalogFilters, type CatalogFiltersProps } from "@/components/catalog/CatalogFilters";
import { CatalogSortSelect } from "@/components/catalog/CatalogSortSelect";

type ProductArchiveLayoutProps = {
  filters: Omit<CatalogFiltersProps, "mobileOpen" | "onMobileClose">;
  totalItems?: number | null;
  sortCurrent: string;
  children: ReactNode;
};

export function ProductArchiveLayout({
  filters,
  totalItems,
  sortCurrent,
  children,
}: ProductArchiveLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useTranslations("Catalog");

  useEffect(() => {
    document.documentElement.classList.toggle("overlay", mobileOpen);
    return () => document.documentElement.classList.remove("overlay");
  }, [mobileOpen]);

  return (
    <div id="main-content" className="bb-archive-main">
      <div className="container bb-wp-container">
        <div className="row bb-wp-row bb-archive-row">
          <div className="col-md-3 bb-wp-col-md-3">
            <CatalogFilters
              {...filters}
              mobileOpen={mobileOpen}
              onMobileClose={() => setMobileOpen(false)}
            />
          </div>

          <div className="col-md-9 bb-wp-col-md-9">
            <div className="product-list pb-40">
              <div className="container bb-archive-inner-container">
                <div className="product-list-filter headroom bb-archive-toolbar">
                  <div className="row align-items-center bb-wp-row">
                    <div className="col-sm-6 bb-wp-col-sm-6 bb-archive-result-col">
                      <div className="result">
                        {totalItems != null ? (
                          <p>
                            {t.rich("totalProductsCount", {
                              count: totalItems,
                              strong: (chunks) => <strong>{chunks}</strong>,
                            })}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="col-sm-6 bb-wp-col-sm-6 bb-archive-sort-col">
                      <Suspense fallback={<span className="bb-skel bb-archive-sort-skel" aria-hidden="true" />}>
                        <CatalogSortSelect current={sortCurrent} />
                      </Suspense>
                    </div>

                    <div className="col-sm-6 filter-mobile-wrapper bb-wp-col-sm-6">
                      <button type="button" className="filter-mobile" onClick={() => setMobileOpen(true)}>
                        <p>
                          {t("filtersHeading").toUpperCase()}
                          <SlidersHorizontal size={16} strokeWidth={1.8} aria-hidden="true" />
                        </p>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="product">{children}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
