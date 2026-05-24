"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
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
  const [mobileIn, setMobileIn] = useState(false);
  const mobileTimer = useRef<number | null>(null);
  const t = useTranslations("Catalog");

  useEffect(() => {
    document.documentElement.classList.toggle("overlay", mobileOpen);
    return () => {
      document.documentElement.classList.remove("overlay");
      if (mobileTimer.current != null) {
        window.clearTimeout(mobileTimer.current);
      }
    };
  }, [mobileOpen]);

  function openMobileFilters() {
    if (mobileTimer.current != null) {
      window.clearTimeout(mobileTimer.current);
    }
    setMobileOpen(true);
    window.requestAnimationFrame(() => setMobileIn(true));
  }

  function closeMobileFilters() {
    setMobileIn(false);
    if (mobileTimer.current != null) {
      window.clearTimeout(mobileTimer.current);
    }
    mobileTimer.current = window.setTimeout(() => setMobileOpen(false), 300);
  }

  return (
    <div id="main-content" className="bb-archive-main">
      <div className="container bb-wp-container">
        <div className="row bb-wp-row bb-archive-row">
          <div className="col-md-3 bb-wp-col-md-3">
            <CatalogFilters
              {...filters}
              mobileOpen={mobileOpen}
              mobileIn={mobileIn}
              onMobileClose={closeMobileFilters}
            />
          </div>

          <div className="col-md-9 bb-wp-col-md-9">
            <div className="product-list pb-40">
              <div className="container bb-archive-inner-container">
                <div className="product-list-filter headroom bb-archive-toolbar">
                  <div className="row align-items-center bb-wp-row">
                    <div className="col-sm-6 bb-wp-col-sm-6 bb-archive-result-col">
                      <div className="result">
                        {totalItems != null ? `${totalItems} Sản phẩm` : null}
                      </div>
                    </div>

                    <div className="col-sm-6 bb-wp-col-sm-6 bb-archive-sort-col">
                      <Suspense fallback={null}>
                        <CatalogSortSelect current={sortCurrent} />
                      </Suspense>
                    </div>

                    <div className="col-sm-6 filter-mobile-wrapper bb-wp-col-sm-6">
                      <button type="button" className="filter-mobile" onClick={openMobileFilters}>
                        <p>
                          {t("filtersHeading").toUpperCase()}
                          <i className="far fa-sliders-v" aria-hidden="true" />
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
