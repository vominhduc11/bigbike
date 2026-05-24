"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Brand, CatalogFacets, Category, HomeSlider, ImageAsset } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { buildQueryString } from "@/lib/utils/query";
import { toCategoryPath } from "@/lib/utils/routes";
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
  showBrandLabels?: boolean;
  mobileOpen?: boolean;
  mobileIn?: boolean;
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
  { key: "0-500k", label: "0 - 500.000 VND", min: 0, max: 500_000 },
  { key: "500k-1tr", label: "500.000 - 1.000.000 VND", min: 500_000, max: 1_000_000 },
  { key: "1-2tr", label: "1.000.000 - 2.000.000 VND", min: 1_000_000, max: 2_000_000 },
  { key: "2-3tr", label: "2.000.000 - 3.000.000 VND", min: 2_000_000, max: 3_000_000 },
  { key: "3-5tr", label: "3.000.000 - 5.000.000 VND", min: 3_000_000, max: 5_000_000 },
  { key: "5-10tr", label: "5.000.000 - 10.000.000 VND", min: 5_000_000, max: 10_000_000 },
  { key: "tren-10tr", label: "Trên 10.000.000 VND", min: 10_000_000, max: undefined },
];

function FilterSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("widget", className)}>
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
  const [revealed, setRevealed] = useState(false);
  const shouldClamp = count > 10;

  return (
    <>
      <ul className={cn(className, shouldClamp && !revealed && "visible")}>{children}</ul>
      {shouldClamp && !revealed && (
        <button type="button" className="show-more" onClick={() => setRevealed(true)}>
          Xem thêm
          <i className="far fa-plus" aria-hidden="true" />
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
  showBrandLabels = false,
  mobileOpen = false,
  mobileIn = false,
  onMobileClose,
}: CatalogFiltersProps) {
  const t = useTranslations("Catalog");
  const visibleCategories = categories.filter((c) => c.isVisible);
  const activeCategory = visibleCategories.find(
    (cat) => toCategoryPath(cat.slug) === resetHref || current.category === cat.slug,
  );
  const activeCategoryParentId = activeCategory?.parentId ?? activeCategory?.id ?? null;
  const rootCategories = visibleCategories.filter((cat) => !cat.parentId);
  const categoryRowCount =
    rootCategories.length +
    (activeCategoryParentId ? visibleCategories.filter((cat) => cat.parentId === activeCategoryParentId).length : 0);

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

  const brandRows: { key: string; label: string; image?: ImageAsset | null; count?: number }[] =
    facets?.brands && facets.brands.length > 0
      ? facets.brands
      : brands.map((b) => ({ key: b.slug, label: b.name, image: b.logo ?? null }));

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
    <aside className={cn("sidebar-wrap-product bb-archive-sidebar", mobileOpen && "active", mobileIn && "in")}>
      <div className="wrapper-product">
        <div className="mobile-sidebar-title">
          <p>BỘ LỌC</p>
          <button type="button" className="close-btn" onClick={onMobileClose} aria-label={t("filterToggleCollapse")}>
            ×
          </button>
        </div>

        <div className="wrapper">
          {rootCategories.length > 0 && (
            <FilterSection title="Danh mục sản phẩm">
              <FilterList className="product-categories" count={categoryRowCount}>
                {rootCategories.map((cat) => {
                  const href = toCategoryPath(cat.slug);
                  const active = href === resetHref || current.category === cat.slug;
                  const children = activeCategoryParentId === cat.id
                    ? visibleCategories.filter((child) => child.parentId === cat.id)
                    : [];
                  return (
                    <li
                      key={cat.id}
                      className={cn(
                        "cat-item",
                        cat.slug,
                        visibleCategories.some((child) => child.parentId === cat.id) && "cat-parent",
                        active && "current-cat active",
                        !active && activeCategoryParentId === cat.id && "current-cat-parent",
                      )}
                    >
                      <Link href={href}>{cat.name}</Link>
                      <Count value={facetCount(facets?.categories, cat.slug)} />
                      {children.length > 0 ? (
                        <ul className="children">
                          {children.map((child) => {
                            const childHref = toCategoryPath(child.slug);
                            const childActive = childHref === resetHref || current.category === child.slug;
                            return (
                              <li
                                key={child.id}
                                className={cn("cat-item", child.slug, childActive && "current-cat active")}
                              >
                                <Link href={childHref}>{child.name}</Link>
                                <Count value={facetCount(facets?.categories, child.slug)} />
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </FilterList>
            </FilterSection>
          )}

          <FilterSection title="Giá">
            <FilterList className="woocommerce-widget-layered-nav-list" count={priceRows.length + 1}>
              <li className={cn(current.minPrice == null && current.maxPrice == null && "chosen active")}>
                <Link href={queryHref({ min_price: undefined, max_price: undefined })}>Tất cả</Link>
              </li>
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
            <FilterSection title="Thương Hiệu" className="widget_filter_by_brand">
              <FilterList className="woocommerce-widget-layered-nav-list" count={brandRows.length}>
                {brandRows.map((brand) => {
                  const active = current.brand === brand.key;
                  const href = active
                    ? queryHref({ "pwb-brand": undefined })
                    : queryHref({ "pwb-brand": brand.key });
                  const imageSrc = brand.image?.url?.trim()
                    ? resolveMediaUrl(brand.image.url.trim())
                    : null;
                  return (
                    <li key={brand.key} className={cn(active && "chosen active")}>
                      <Link href={href}>
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={safeText(brand.image?.alt, brand.label)}
                            width={92}
                            loading="lazy"
                          />
                        ) : null}
                        {showBrandLabels || !imageSrc ? (
                          <span className="bb-brand-filter-label">{brand.label}</span>
                        ) : null}
                      </Link>
                      <Count value={brand.count} />
                    </li>
                  );
                })}
              </FilterList>
            </FilterSection>
          )}

          <FilterSection title="Màu sắc">
            <FilterList className="woocommerce-widget-layered-nav-list" count={colorRows.length}>
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
