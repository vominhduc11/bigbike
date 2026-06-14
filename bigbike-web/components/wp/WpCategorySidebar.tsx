"use client";

/* eslint-disable @next/next/no-img-element */

import { Children, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import type { Brand, CatalogFacets, Category, ImageAsset } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { buildQueryString } from "@/lib/utils/query";
import { toCategoryPath } from "@/lib/utils/routes";
import { useDetachWpHandlers } from "@/lib/hooks/useDetachWpHandlers";

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
  gender?: string;
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

// Nhãn fallback (khi backend chưa trả facet màu/giá) — text lấy qua i18n
// `Catalog.colorFallback.*` / `Catalog.priceFallback.*` để đổi ngôn ngữ ở client.
const COLOR_FALLBACK_KEYS = [
  "bac", "cam", "hong", "trang", "xam", "xanh-da-troi", "xanh-la-cay", "vang", "den", "do",
] as const;

const PRICE_FALLBACK: { key: string; min?: number; max?: number }[] = [
  { key: "0-500k", min: 0, max: 500_000 },
  { key: "500k-1tr", min: 500_000, max: 1_000_000 },
  { key: "1-2tr", min: 1_000_000, max: 2_000_000 },
  { key: "2-3tr", min: 2_000_000, max: 3_000_000 },
  { key: "3-5tr", min: 3_000_000, max: 5_000_000 },
  { key: "5-10tr", min: 5_000_000, max: 10_000_000 },
  { key: "tren-10tr", min: 10_000_000, max: undefined },
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

/**
 * Danh sách lọc có "Xem thêm" — port React của theme JS `sideBarToggle`
 * (home.min.js chỉ chạy 1 lần lúc full-load, KHÔNG chạy lại khi điều hướng nội bộ
 * SPA → tự dựng lại bằng React cho ổn định mọi lúc).
 *
 * Khi thu gọn chỉ render đúng 10 mục: theme JS chỉ tác động khi ul có > 10 <li>,
 * nên nó sẽ bỏ qua ul này và KHÔNG chèn nút trùng. Clamp + nút dùng đúng class
 * `visible`/`show-more` đã có trong wp-theme-category.css/wp-theme-product.css.
 */
function ToggleList({
  className,
  children,
  collapseAt = 10,
}: {
  className?: string;
  children: React.ReactNode;
  collapseAt?: number;
}) {
  const t = useTranslations("Catalog");
  const [expanded, setExpanded] = useState(false);
  // Khi thu gọn vẫn giữ đủ <li> trong lúc chạy hiệu ứng (mới co lại được); cắt bớt
  // sau khi animation xong. `collapsing=true` = đang co nhưng chưa cắt.
  const [collapsing, setCollapsing] = useState(false);
  const ulRef = useRef<HTMLUListElement>(null);
  // Chiều cao đo được NGAY TRƯỚC khi đổi expanded, để useLayoutEffect animate từ đó.
  const fromHeight = useRef<number | null>(null);
  const items = Children.toArray(children);
  // collapseAt ≤ 10 để theme JS (chỉ tác động khi ul > 10 <li>) bỏ qua, tránh nút trùng.
  const hasMore = items.length > collapseAt;
  // Cắt bớt chỉ khi đã thu gọn HẲN (không mở, không đang co). `.visible` (clamp+fade)
  // cũng chỉ áp ở trạng thái nghỉ này.
  const collapsedRest = hasMore && !expanded && !collapsing;
  const visibleItems = collapsedRest ? items.slice(0, collapseAt) : items;

  // Slide mượt max-height. Mở: từ chiều cao cũ → scrollHeight đầy đủ. Thu gọn: giữ đủ
  // <li> (collapsing), animate về chiều cao của `collapseAt` mục đầu, xong mới cắt.
  useLayoutEffect(() => {
    const el = ulRef.current;
    if (!el || fromHeight.current == null) return;
    const from = fromHeight.current;
    fromHeight.current = null;
    let to: number;
    if (expanded) {
      to = el.scrollHeight;
    } else {
      // Đang giữ đủ <li>: mốc thu gọn = đỉnh của <li> thứ collapseAt so với ul.
      const cut = el.children[collapseAt] as HTMLElement | undefined;
      to = cut ? cut.getBoundingClientRect().top - el.getBoundingClientRect().top : el.scrollHeight;
    }
    el.style.overflow = "hidden";
    el.style.maxHeight = `${from}px`;
    el.getBoundingClientRect(); // ép reflow để trình duyệt ghi nhận mốc đầu
    el.style.transition = "max-height 0.3s ease";
    el.style.maxHeight = `${to}px`;
    const cleanup = () => {
      el.removeEventListener("transitionend", cleanup);
      el.style.transition = "";
      if (expanded) {
        el.style.maxHeight = "";
        el.style.overflow = "";
      } else {
        // Cắt <li> trước (giữ inline maxHeight để không giật về chiều cao đầy đủ).
        setCollapsing(false);
      }
    };
    el.addEventListener("transitionend", cleanup);
    return () => el.removeEventListener("transitionend", cleanup);
  }, [expanded, collapseAt]);

  // Sau khi đã cắt bớt <li> (collapsing → false), xoá inline style để trả về CSS gốc
  // (`.visible` clamp 400 + fade). Lúc này nội dung đã đúng chiều cao nên không giật.
  useLayoutEffect(() => {
    if (collapsing) return;
    const el = ulRef.current;
    if (!el) return;
    el.style.maxHeight = "";
    el.style.overflow = "";
    el.style.transition = "";
  }, [collapsing]);

  function toggle() {
    fromHeight.current = ulRef.current?.getBoundingClientRect().height ?? null;
    if (expanded) setCollapsing(true); // giữ đủ <li> để animate co lại
    setExpanded((v) => !v);
  }

  return (
    <>
      <ul ref={ulRef} className={`${className ?? ""}${collapsedRest ? " visible" : ""}`}>
        {visibleItems}
      </ul>
      {hasMore && (
        // KHÔNG dùng class `show-more`: home.min.js bind $('.show-more').on('click')
        // (ẩn nút + bỏ visible) vào mọi .show-more khi full-load, phá nút React. Dùng
        // Tailwind cùng kiểu dáng (.widget--body .show-more gốc) để theme JS không bắt được.
        <div
          className="h-[52px] cursor-pointer border border-black bg-black px-2.5 text-center font-semibold uppercase leading-[52px] text-white"
          role="button"
          tabIndex={0}
          onClick={toggle}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggle()}
        >
          {expanded ? t("showLess") : t("showMore")}
          {expanded ? (
            <Minus className="ml-2.5 inline-block align-middle" size={16} aria-hidden />
          ) : (
            <Plus className="ml-2.5 inline-block align-middle" size={16} aria-hidden />
          )}
        </div>
      )}
    </>
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

  // home.min.js `toggleCategories()` bind click vào `.filter-mobile-wrapper` (mở),
  // `.sidebar-wrap-product .close-btn` / `.overlay` (đóng) + tự toggle `html.overlay`
  // (khóa cuộn). Trùng với React (mở qua sự kiện wp:catfilter-open, đóng qua onClick)
  // → trên reload hai bên giành lớp active/in. Gỡ handler WP, React tự quản đóng/mở.
  useDetachWpHandlers([
    { selector: ".filter-mobile-wrapper", events: "click" },
    { selector: ".sidebar-wrap-product .close-btn", events: "click" },
    { selector: ".sidebar-wrap-product .overlay", events: "click" },
  ]);

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
                                className={`cat-item cat-item-${child.id} ${child.slug}${childActive ? " current-cat active" : ""}`}
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
