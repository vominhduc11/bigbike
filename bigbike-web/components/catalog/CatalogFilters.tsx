"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Brand, CatalogFacets, Category, HomeSlider } from "@/lib/contracts/public";
import { buildQueryString } from "@/lib/utils/query";
import { toCategoryPath, toProductListPath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils";

type FilterState = {
  q?: string;
  category?: string;
  brand?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
};

export type CatalogFiltersProps = {
  brands: Brand[];
  categories?: Category[];
  facets?: CatalogFacets | null;
  current: FilterState;
  resetHref: string;
  hiddenParams?: Record<string, string | undefined>;
  banner?: HomeSlider | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

const COLOR_FALLBACK: { key: string; label: string }[] = [
  { key: "bac", label: "Bạc" },
  { key: "cam", label: "Cam" },
  { key: "hong", label: "Hồng" },
  { key: "trang", label: "Trắng" },
  { key: "xam", label: "Xám" },
  { key: "xanh-da-troi", label: "Xanh da trời" },
  { key: "xanh-la-cay", label: "Xanh lá cây" },
  { key: "vang", label: "Vàng" },
  { key: "den", label: "Đen" },
  { key: "do", label: "Đỏ" },
];

const PRICE_FALLBACK: { key: string; label: string; min?: number; max?: number }[] = [
  { key: "0-1tr", label: "0đ - 1.000.000đ", min: 0, max: 1_000_000 },
  { key: "1-2tr", label: "1.000.000đ - 2.000.000đ", min: 1_000_000, max: 2_000_000 },
  { key: "2-3tr", label: "2.000.000đ - 3.000.000đ", min: 2_000_000, max: 3_000_000 },
  { key: "3-4tr", label: "3.000.000đ - 4.000.000đ", min: 3_000_000, max: 4_000_000 },
  { key: "4-5tr", label: "4.000.000đ - 5.000.000đ", min: 4_000_000, max: 5_000_000 },
  { key: "5-6tr", label: "5.000.000đ - 6.000.000đ", min: 5_000_000, max: 6_000_000 },
  { key: "6-7tr", label: "6.000.000đ - 7.000.000đ", min: 6_000_000, max: 7_000_000 },
  { key: "7-8tr", label: "7.000.000đ - 8.000.000đ", min: 7_000_000, max: 8_000_000 },
  { key: "tren-9tr", label: "Trên 9.000.000đ", min: 9_000_000, max: undefined },
];

const CATEGORY_ICON_SLUGS = new Set([
  "balo-deo-lung-tui-deo-tui-treo-xe",
  "gang-tay",
  "giap-bao-ho-tay-chan-dai-lung-phu-kien-giap",
  "giay-bao-ho",
  "non-bao-hiem-moto",
  "phu-kien-di-mua",
  "phu-kien-khac",
  "pinlock-kinh-chong-suong-mu",
  "quan-ao-bao-ho-moto",
  "san-pham-khuyen-mai",
  "san-pham-ve-sinh-do-bao-ho-cham-soc-xe",
  "tai-nghe-bluetooth-mu-bao-hiem",
  "phu-kien-do-lot",
]);

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="widget">
      <div className="widget--title">
        <h3>{title}</h3>
      </div>
      <div className="widget--body">{children}</div>
    </div>
  );
}

function Count({ value }: { value?: number }) {
  if (value == null) return null;
  return (
    <span className="count">
      <span>{value}</span>
    </span>
  );
}

function FilterList({
  children,
  count,
  className,
}: {
  children: ReactNode;
  count: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shouldClamp = count > 10;

  return (
    <>
      <ul className={cn(className, shouldClamp && !expanded && "visible")}>{children}</ul>
      {shouldClamp && (
        <button type="button" className="show-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Thu gọn" : "Xem thêm"}
          <span aria-hidden="true">{expanded ? " -" : " +"}</span>
        </button>
      )}
    </>
  );
}

export function CatalogFilters({
  brands,
  categories = [],
  facets = null,
  current,
  resetHref,
  hiddenParams = {},
  mobileOpen = false,
  onMobileClose,
}: CatalogFiltersProps) {
  const t = useTranslations("Catalog");
  const visibleCategories = categories.filter((c) => c.isVisible);

  function queryHref(override: Record<string, string | number | undefined>): string {
    const params: Record<string, string | number | undefined> = {
      ...hiddenParams,
      category: current.category,
      "pwb-brand": current.brand,
      filter_color: current.color,
      min_price: current.minPrice,
      max_price: current.maxPrice,
      q: current.q,
      sort: current.sort,
      ...override,
    };
    return `${resetHref}${buildQueryString(params)}`;
  }

  const facetCount = (buckets: { key: string; count: number }[] | undefined, key: string) =>
    buckets?.find((b) => b.key === key)?.count;

  const allProductsHref = toProductListPath();
  const brandRows: { key: string; label: string; count?: number }[] =
    facets?.brands && facets.brands.length > 0
      ? facets.brands
      : brands.map((b) => ({ key: b.slug, label: b.name }));

  const colorRows: { key: string; label: string; count?: number }[] =
    facets?.colors && facets.colors.length > 0 ? facets.colors : COLOR_FALLBACK;

  const priceRows =
    facets?.priceBands && facets.priceBands.length > 0
      ? facets.priceBands.map((b) => ({
          key: b.key,
          label: b.label,
          min: b.minPrice ?? undefined,
          max: b.maxPrice ?? undefined,
          count: b.count as number | undefined,
        }))
      : PRICE_FALLBACK.map((b) => ({ ...b, count: undefined as number | undefined }));

  return (
    <aside className={cn("sidebar-wrap-product bb-archive-sidebar", mobileOpen && "active in")}>
      <div className="wrapper-product">
        <div className="mobile-sidebar-title">
          <p>{t("filtersHeading").toUpperCase()}</p>
          <button type="button" className="close-btn" onClick={onMobileClose} aria-label={t("filterToggleCollapse")}>
            ×
          </button>
        </div>

        <div className="wrapper">
          {visibleCategories.length > 0 && (
            <FilterSection title={t("filterCategory")}>
              <ul className="product-categories">
                <li className={cn(resetHref === allProductsHref && !current.category && "current-cat active")}>
                  <Link href={allProductsHref}>{t("allProducts")}</Link>
                </li>
                {visibleCategories.map((cat) => {
                  const href = toCategoryPath(cat.slug);
                  const active = href === resetHref || current.category === cat.slug;
                  return (
                    <li
                      key={cat.id}
                      className={cn(
                        cat.slug,
                        CATEGORY_ICON_SLUGS.has(cat.slug) && "bb-category-icon",
                        active && "current-cat active",
                      )}
                    >
                      <Link href={href}>{cat.name}</Link>
                      <Count value={facetCount(facets?.categories, cat.slug)} />
                    </li>
                  );
                })}
              </ul>
            </FilterSection>
          )}

          <FilterSection title={t("filterPrice")}>
            <FilterList className="woocommerce-widget-layered-nav-list" count={priceRows.length}>
              {priceRows.map((band) => {
                const active =
                  (current.minPrice ?? undefined) === band.min &&
                  (current.maxPrice ?? undefined) === band.max;
                const href = active
                  ? queryHref({ min_price: undefined, max_price: undefined })
                  : queryHref({ min_price: band.min, max_price: band.max });
                return (
                  <li key={band.key} className={cn(active && "chosen active")}>
                    <Link href={href}>{band.label}</Link>
                    <Count value={band.count} />
                  </li>
                );
              })}
            </FilterList>
          </FilterSection>

          {brandRows.length > 0 && (
            <FilterSection title={t("filterBrand")}>
              <FilterList className="woocommerce-widget-layered-nav-list" count={brandRows.length + 1}>
                <li className={cn(!current.brand && "chosen active")}>
                  <Link href={queryHref({ "pwb-brand": undefined })}>{t("allBrands")}</Link>
                </li>
                {brandRows.map((brand) => {
                  const active = current.brand === brand.key;
                  const href = active
                    ? queryHref({ "pwb-brand": undefined })
                    : queryHref({ "pwb-brand": brand.key });
                  return (
                    <li key={brand.key} className={cn(active && "chosen active")}>
                      <Link href={href}>{brand.label}</Link>
                      <Count value={brand.count} />
                    </li>
                  );
                })}
              </FilterList>
            </FilterSection>
          )}

          <FilterSection title={t("filterColor")}>
            <FilterList className="woocommerce-widget-layered-nav-list" count={colorRows.length + 1}>
              <li className={cn(!current.color && "chosen active")}>
                <Link href={queryHref({ filter_color: undefined })}>{t("allColors")}</Link>
              </li>
              {colorRows.map((color) => {
                const active = current.color === color.key;
                const href = active
                  ? queryHref({ filter_color: undefined })
                  : queryHref({ filter_color: color.key });
                return (
                  <li key={color.key} className={cn(active && "chosen active")}>
                    <Link href={href}>{color.label}</Link>
                    <Count value={color.count} />
                  </li>
                );
              })}
            </FilterList>
          </FilterSection>
        </div>
      </div>
      <button type="button" className="overlay" onClick={onMobileClose} aria-label={t("filterToggleCollapse")} />
    </aside>
  );
}
