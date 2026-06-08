"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { CatalogFilters, type CatalogFiltersProps } from "@/components/catalog/CatalogFilters";
import { CatalogSortSelect } from "@/components/catalog/CatalogSortSelect";
import { Container } from "@/components/layout/Container";

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
    <div id="main-content" className="pb-0 max-md:pb-6">
      <Container>
        <div className="flex flex-wrap -mx-[15px]">
          <div className="min-w-0 w-full max-w-full px-[15px] md:flex-[0_0_25%] md:max-w-[25%]">
            <CatalogFilters
              {...filters}
              mobileOpen={mobileOpen}
              mobileIn={mobileIn}
              onMobileClose={closeMobileFilters}
            />
          </div>

          <div className="min-w-0 w-full max-w-full px-[15px] md:flex-[0_0_75%] md:max-w-[75%]">
            <div className="pb-10">
              <div className="w-full mx-auto px-[var(--bb-mobile-page-x)] md:px-[15px]">
                <div className="sticky top-20 z-[2] bg-white max-md:top-[var(--bb-header-height)] max-md:z-30 max-md:[margin-inline:calc(var(--bb-mobile-page-x)*-1)] max-md:border-b max-md:border-border max-md:bg-[color-mix(in_srgb,var(--bb-bg-page)_96%,transparent)] max-md:px-[var(--bb-mobile-page-x)] max-md:py-2.5 max-md:backdrop-blur-[10px]">
                  <div className="flex flex-wrap items-center -mx-[15px]">
                    <div className="min-w-0 w-full px-[15px] flex-[0_0_100%] max-w-full md:flex-[0_0_50%] md:max-w-[50%]">
                      <div className="min-h-[52px] mb-[30px] text-ui-24 font-semibold leading-[52px] max-md:min-h-0 max-md:m-0 max-md:mb-2.5 max-md:leading-[1.35]">
                        {totalItems != null ? `${totalItems} Sản phẩm` : null}
                      </div>
                    </div>

                    <div className="text-right min-w-0 w-full px-[15px] flex-[0_0_100%] max-w-full order-3 md:flex-[0_0_50%] md:max-w-[50%] md:order-none">
                      <Suspense fallback={null}>
                        <CatalogSortSelect current={sortCurrent} />
                      </Suspense>
                    </div>

                    <div className="hidden mb-[30px] min-w-0 w-full px-[15px] md:flex-[0_0_50%] md:max-w-[50%] max-md:block max-md:flex-[0_0_100%] max-md:max-w-full max-md:order-2">
                      <button
                        type="button"
                        className="w-full cursor-pointer border-none bg-transparent text-left text-black"
                        onClick={openMobileFilters}
                      >
                        <p className="relative m-0 h-[52px] border-[color:var(--bb-border-default)] border-t border-r border-b [border-left:none] py-0 pr-10 pl-5 text-sm font-semibold leading-[50px] max-md:h-11 max-md:min-h-11 max-md:[border-left:1px_solid_var(--bb-border-default)] max-md:font-[family-name:var(--bb-font-cta)] max-md:leading-[42px]">
                          BỘ LỌC
                          <i
                            className="far fa-sliders-v absolute top-1/2 right-[25px] [transform:translateY(-50%)]"
                            aria-hidden="true"
                          />
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
      </Container>
    </div>
  );
}
