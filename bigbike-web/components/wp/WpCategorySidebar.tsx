"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Brand, CatalogFacets, Category, ImageAsset } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { buildQueryString } from "@/lib/utils/query";
import { toCategoryPath } from "@/lib/utils/routes";

/**
 * Sidebar bộ lọc danh mục — port DOM 1:1 từ woocommerce/archive-product.php
 * (.sidebar-wrap-product > .wrapper-product > .wrapper > .widget). Mỗi widget
 * theo đúng class WooCommerce để CSS theme tô đúng. Dữ liệu thật của bigbike-web
 * (categories / facets giá-màu-thương hiệu); logic href port từ CatalogFilters.
 *
 * Mobile: drawer trượt phải, mở bằng nút BỘ LỌC (WpMobileFilterTrigger phát
 * sự kiện "wp:catfilter-open"), đóng bằng close-btn / overlay.
 */

export type WpCategoryFilterState = {
  q?: string;
  category?: string;
  brand?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
};

export type WpCategorySidebarProps = {
  brands: Brand[];
  categories: Category[];
  facets?: CatalogFacets | null;
  current: WpCategoryFilterState;
  resetHref: string;
  hiddenParams?: Record<string, string | undefined>;
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

function Widget({
  title,
  extraClass,
  children,
}: {
  title: string;
  extraClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`sidebar widget toggle ${extraClass}`}>
      <div className="widget--title toggle-title">
        <h3>{title}</h3>
      </div>
      <div className="widget--body toggle-body">{children}</div>
    </div>
  );
}

export function WpCategorySidebar({
  brands,
  categories,
  facets = null,
  current,
  resetHref,
  hiddenParams = {},
}: WpCategorySidebarProps) {
  const t = useTranslations("Catalog");
  const [active, setActive] = useState(false); // hiện drawer (display)
  const [inView, setInView] = useState(false); // trượt vào (transform/opacity)
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    function open() {
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
      setActive(true);
      window.requestAnimationFrame(() => setInView(true));
    }
    window.addEventListener("wp:catfilter-open", open);
    return () => {
      window.removeEventListener("wp:catfilter-open", open);
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  function close() {
    setInView(false);
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setActive(false), 300);
  }

  function queryHref(override: Record<string, string | number | undefined>): string {
    const params: Record<string, string | number | undefined> = {
      ...hiddenParams,
      "pwb-brand": current.brand,
      filter_color: current.color,
      min_price: current.minPrice,
      max_price: current.maxPrice,
      q: current.q,
      ...override,
    };
    return `${resetHref}${buildQueryString(params)}`;
  }

  const visibleCategories = categories.filter((c) => c.isVisible);
  const activeCategory = visibleCategories.find(
    (cat) => toCategoryPath(cat.slug) === resetHref || current.category === cat.slug,
  );
  const activeCategoryParentId = activeCategory?.parentId ?? activeCategory?.id ?? null;
  const rootCategories = visibleCategories.filter((cat) => !cat.parentId);

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

  const noPrice = current.minPrice == null && current.maxPrice == null;

  return (
    <div className={`sidebar-wrap-product${active ? " active" : ""}${inView ? " in" : ""}`}>
      <div className="wrapper-product">
        <div className="mobile-sidebar-title">
          <p>BỘ LỌC</p>
          <i
            className="fal fa-times close-btn"
            role="button"
            tabIndex={0}
            aria-label="Đóng bộ lọc"
            onClick={close}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && close()}
          />
        </div>
        <div className="wrapper">
          {rootCategories.length > 0 && (
            <Widget title={t("filterCategory")} extraClass="woocommerce widget_product_categories">
              <ul className="product-categories">
                {rootCategories.map((cat) => {
                  const href = toCategoryPath(cat.slug);
                  const isActive = href === resetHref || current.category === cat.slug;
                  const children =
                    activeCategoryParentId === cat.id
                      ? visibleCategories.filter((child) => child.parentId === cat.id)
                      : [];
                  const liClass = [
                    "cat-item",
                    `cat-item-${cat.id}`,
                    cat.slug,
                    isActive ? "current-cat" : "",
                    children.length > 0 ? "cat-parent" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <li key={cat.id} className={liClass}>
                      <Link href={href}>{cat.name}</Link>
                      {children.length > 0 ? (
                        <ul className="children">
                          {children.map((child) => {
                            const childHref = toCategoryPath(child.slug);
                            const childActive =
                              childHref === resetHref || current.category === child.slug;
                            return (
                              <li
                                key={child.id}
                                className={`cat-item cat-item-${child.id} ${child.slug}${childActive ? " current-cat" : ""}`}
                              >
                                <Link href={childHref}>{child.name}</Link>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Widget>
          )}

          <Widget title={t("filterPrice")} extraClass="devvn_woocommerce_price_filter woocommerce widget_layered_nav">
            <ul className="woocommerce-widget-layered-nav-list">
              <li className={`wc-layered-nav-term${noPrice ? " chosen" : ""}`}>
                <Link href={queryHref({ min_price: undefined, max_price: undefined })}>{t("allColors")}</Link>
              </li>
              {priceRows.map((band) => {
                const isActive =
                  (current.minPrice ?? undefined) === band.min &&
                  (current.maxPrice ?? undefined) === band.max;
                const href = isActive
                  ? queryHref({ min_price: undefined, max_price: undefined })
                  : queryHref({ min_price: band.min, max_price: band.max });
                return (
                  <li key={band.key} className={`wc-layered-nav-term${isActive ? " chosen" : ""}`}>
                    <Link href={href}>{band.label}</Link>
                    {band.count != null ? <span className="count">({band.count})</span> : null}
                  </li>
                );
              })}
            </ul>
          </Widget>

          {brandRows.length > 0 && (
            <Widget
              title="Thương Hiệu"
              extraClass="woocommerce widget_layered_nav woocommerce-widget-layered-nav"
            >
              <ul className="woocommerce-widget-layered-nav-list">
                {brandRows.map((brand) => {
                  const isActive = current.brand === brand.key;
                  const href = isActive
                    ? queryHref({ "pwb-brand": undefined })
                    : queryHref({ "pwb-brand": brand.key });
                  const imageSrc = brand.image?.url?.trim()
                    ? resolveMediaUrl(brand.image.url.trim())
                    : null;
                  return (
                    <li
                      key={brand.key}
                      className={`woocommerce-widget-layered-nav-list__item wc-layered-nav-term${isActive ? " chosen" : ""}`}
                    >
                      <Link rel="nofollow" href={href}>
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={safeText(brand.image?.alt, brand.label)}
                            width={92}
                            loading="lazy"
                          />
                        ) : (
                          brand.label
                        )}
                      </Link>
                      {brand.count != null ? <span className="count">({brand.count})</span> : null}
                    </li>
                  );
                })}
              </ul>
            </Widget>
          )}

          <Widget
            title="Màu sắc"
            extraClass="woocommerce widget_layered_nav woocommerce-widget-layered-nav"
          >
            <ul className="woocommerce-widget-layered-nav-list">
              {colorRows.map((color) => {
                const isActive = current.color === color.key;
                const href = isActive
                  ? queryHref({ filter_color: undefined })
                  : queryHref({ filter_color: color.key });
                return (
                  <li
                    key={color.key}
                    className={`woocommerce-widget-layered-nav-list__item wc-layered-nav-term${isActive ? " chosen" : ""}`}
                  >
                    <Link rel="nofollow" href={href}>
                      {color.label}
                    </Link>
                    {color.count != null ? <span className="count">({color.count})</span> : null}
                  </li>
                );
              })}
            </ul>
          </Widget>
        </div>
      </div>
      <div className="overlay" onClick={close} />
    </div>
  );
}
