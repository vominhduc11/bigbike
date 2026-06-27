"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { useTranslations } from "next-intl";
import type { ImageAsset } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { buildQueryString } from "@/lib/utils/query";
import { toCategoryPath } from "@/lib/utils/routes";
import { submenuIcon } from "@/lib/ui-classes";
import { Widget } from "./category-sidebar/Widget";
import { ToggleList } from "./category-sidebar/ToggleList";
import { COLOR_FALLBACK_KEYS, PRICE_FALLBACK } from "./category-sidebar/constants";
import type { WpCategorySidebarProps } from "./category-sidebar/types";

export type { WpCategoryFilterState, WpCategorySidebarProps } from "./category-sidebar/types";

/**
 * Sidebar bộ lọc danh mục — port DOM 1:1 từ woocommerce/archive-product.php
 * (.sidebar-wrap-product > .wrapper-product > .wrapper > .widget). Mỗi widget
 * theo đúng class WooCommerce để CSS theme tô đúng. Dữ liệu thật của bigbike-web
 * (categories / facets giá-màu-thương hiệu); logic href port từ CatalogFilters.
 *
 * Mobile: drawer trượt phải, mở bằng nút BỘ LỌC (WpMobileFilterTrigger phát
 * sự kiện "wp:catfilter-open"), đóng bằng close-btn / overlay.
 */
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

  // Khóa cuộn nền khi drawer mở — thay cho `$("html").toggleClass("overlay")` của WP
  // (CSS theme: `html.overlay{overflow:hidden}`). React tự quản nên hoạt động cả khi
  // điều hướng SPA (lúc script WP không chạy lại).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("overlay", active);
    return () => root.classList.remove("overlay");
  }, [active]);

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
      filter_gender: current.gender,
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

  // WP hiển thị toàn bộ thương hiệu; danh sách dài (>10) được ToggleList (React)
  // tự clamp + nút "Xem thêm". Không cắt cứng ở FE để khớp bigbike.vn gốc.
  const brandRows: { key: string; label: string; image?: ImageAsset | null; count?: number }[] =
    facets?.brands && facets.brands.length > 0
      ? facets.brands
      : brands.map((b) => ({ key: b.slug, label: b.name, image: b.logo ?? null }));

  const colorRows: { key: string; label: string; count?: number }[] =
    facets?.colors && facets.colors.length > 0
      ? facets.colors
      : COLOR_FALLBACK_KEYS.map((key) => ({ key, label: t(`colorFallback.${key}`) }));

  const priceRows =
    facets?.priceBands && facets.priceBands.length > 0
      ? facets.priceBands.map((b) => ({
          key: b.key,
          label: b.label,
          min: b.minPrice ?? undefined,
          max: b.maxPrice ?? undefined,
          count: b.count as number | undefined,
        }))
      : PRICE_FALLBACK.map((b) => ({
          ...b,
          label: t(`priceFallback.${b.key}`),
          count: undefined as number | undefined,
        }));

  const noPrice = current.minPrice == null && current.maxPrice == null;

  return (
    <div className={`sidebar-wrap-product${active ? " active" : ""}${inView ? " in" : ""}`}>
      <div className="wrapper-product">
        <div className="mobile-sidebar-title">
          <p>{t("filterMobileHeading")}</p>
          <i
            className="fal fa-times close-btn"
            role="button"
            tabIndex={0}
            aria-label={t("closeFilter")}
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
                    // `current-cat active`: bản WP thêm `.active` qua toggleCategories
                    // (chỉ chạy lúc full-load). React tự thêm để style `.current-cat.active`
                    // nhất quán cả khi điều hướng SPA (lúc script WP không chạy lại).
                    isActive ? "current-cat active" : "",
                    children.length > 0 ? "cat-parent" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <li key={cat.id} className={liClass}>
                      {/* Icon line đơn sắc từ DB (cat.menuIconUrl, V213) — render qua mask-image,
                          theo currentColor nên tự đổi xám→đỏ như link. `before:!hidden` tắt icon
                          WP cũ gắn theo slug (.{slug}>a::before) để không bị icon đôi; `pl-[30px]`
                          chừa chỗ icon (20px) + ~10px khoảng cách, không phụ thuộc rule slug của theme. */}
                      <LocalizedLink
                        kind="category"
                        viSlug={cat.slug}
                        enSlug={cat.slugEn}
                        className={cat.menuIconUrl ? "relative block pl-[30px] before:!hidden" : undefined}
                      >
                        {cat.menuIconUrl ? (
                          <span
                            aria-hidden
                            className={`${submenuIcon} absolute left-0 top-[3px]`}
                            style={{
                              maskImage: `url(${cat.menuIconUrl})`,
                              WebkitMaskImage: `url(${cat.menuIconUrl})`,
                            }}
                          />
                        ) : null}
                        {cat.name}
                      </LocalizedLink>
                      {children.length > 0 ? (
                        <ul className="children">
                          {children.map((child) => {
                            const childHref = toCategoryPath(child.slug);
                            const childActive =
                              childHref === resetHref || current.category === child.slug;
                            return (
                              <li
                                key={child.id}
                                className={`cat-item cat-item-${child.id} ${child.slug}${childActive ? " current-cat active" : ""}`}
                              >
                                <LocalizedLink
                                  kind="category"
                                  viSlug={child.slug}
                                  enSlug={child.slugEn}
                                  // pl-[30px]! (important): theme WP có rule `.product-categories .children li a{padding-left:0}`
                                  // (specificity cao hơn) ép padding-left của link con về 0 → chữ trượt sát mép, đè lên
                                  // icon đặt absolute left-0. Thêm important để chừa lại 30px (icon 20px + ~10px), hết chồng chữ.
                                  className={child.menuIconUrl ? "relative block pl-[30px]! before:!hidden" : undefined}
                                >
                                  {child.menuIconUrl ? (
                                    <span
                                      aria-hidden
                                      className={`${submenuIcon} absolute left-0 top-[3px]`}
                                      style={{
                                        maskImage: `url(${child.menuIconUrl})`,
                                        WebkitMaskImage: `url(${child.menuIconUrl})`,
                                      }}
                                    />
                                  ) : null}
                                  {child.name}
                                </LocalizedLink>
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
                  </li>
                );
              })}
            </ul>
          </Widget>

          {facets?.genders && facets.genders.length > 0 && (
            <Widget
              title={t("filterGender")}
              extraClass="woocommerce widget_layered_nav woocommerce-widget-layered-nav"
            >
              <ul className="woocommerce-widget-layered-nav-list">
                {facets.genders.map((g) => {
                  const isActive = current.gender === g.key;
                  const href = isActive
                    ? queryHref({ filter_gender: undefined })
                    : queryHref({ filter_gender: g.key });
                  return (
                    <li
                      key={g.key}
                      className={`woocommerce-widget-layered-nav-list__item wc-layered-nav-term${isActive ? " chosen" : ""}`}
                    >
                      <Link rel="nofollow" href={href}>{g.label}</Link>
                      {g.count != null ? <span className="count">({g.count})</span> : null}
                    </li>
                  );
                })}
              </ul>
            </Widget>
          )}

          <Widget
            title={t("filterColor")}
            extraClass="woocommerce widget_layered_nav woocommerce-widget-layered-nav"
          >
            <ToggleList className="woocommerce-widget-layered-nav-list" collapseAt={7}>
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
            </ToggleList>
          </Widget>

          {brandRows.length > 0 && (
            <Widget
              title={t("filterBrand")}
              extraClass="woocommerce widget_layered_nav woocommerce-widget-layered-nav"
            >
              <ToggleList className="woocommerce-widget-layered-nav-list">
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
                      className={`woocommerce-widget-layered-nav-list__item wc-layered-nav-term mb-[5px]${isActive ? " chosen" : ""}`}
                    >
                      <Link rel="nofollow" href={href}>
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={safeText(brand.image?.alt, brand.label)}
                            width={92}
                            loading="lazy"
                            className="inline-block align-middle"
                          />
                        ) : null}{" "}
                        <span className="font-barlow">{brand.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ToggleList>
            </Widget>
          )}
        </div>
      </div>
      <div className="overlay" onClick={close} />
    </div>
  );
}
