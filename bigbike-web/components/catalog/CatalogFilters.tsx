"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Brand, CatalogFacets, Category, HomeSlider, ImageAsset } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { buildQueryString } from "@/lib/utils/query";
import { toCategoryPath } from "@/lib/utils/routes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterState = {
  q?: string;
  category?: string;
  brand?: string;
  color?: string;
  gender?: string;
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

/* ── Inline-Tailwind ports of the former .bb-product-archive sidebar/.widget rules ───
 * #cecece = --bb-border-default (no Tailwind token); #6f6f6f = --bb-text-muted = text-muted-foreground;
 * --bb-action-primary = --bb-text-brand = brand. Rotated pseudo-squares use the arbitrary
 * [transform:rotate(45deg)] (v4 `rotate-45` sets the `rotate` prop, not `transform`).
 * Mobile (max-md) values are the EFFECTIVE last-override (the drawer/widget were re-overridden
 * by a second @media block: wrapper min(86vw,340px)/18px pad, overlay color-mix 58%, widget 20/16). */
const WIDGET = "mb-[30px] border-b border-[var(--bb-border-default)] pb-[15px] last:border-b-0 max-md:mb-5 max-md:pb-4";
const WIDGET_TITLE_H3 =
  "m-0 font-body text-ui-24 font-semibold uppercase text-black";
const LIST = "m-0 list-none p-0"; // widget--body ul
const LIST_LINK =
  "relative block pr-5 text-sm font-semibold leading-[1.3] text-muted-foreground no-underline hover:text-brand";
const CAT_DIAMOND =
  "after:absolute after:left-[3px] after:top-[10px] after:h-[5px] after:w-[5px] after:rounded-[1px] after:bg-brand after:[transform:rotate(45deg)] after:content-['']";
// "Xem thêm" facet reveal. Routed through <Button variant="dark">; the trailing
// gap-0/scale-100/py-0 overrides keep the flat WP look (icon spacing stays on ml-1.5).
const SHOW_MORE =
  "h-[52px] w-full gap-0 border border-black bg-black px-2.5 py-0 text-center font-semibold leading-[52px] text-white hover:not-disabled:scale-100";
const VISIBLE_CLAMP =
  "relative max-h-[400px] overflow-hidden after:absolute after:bottom-0 after:left-0 after:z-[2] after:h-[10%] after:w-full after:bg-[linear-gradient(transparent,#ffffff)] after:content-['']";

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
    <div className={cn(WIDGET, className)}>
      <div className="pb-[15px]">
        <h3 className={WIDGET_TITLE_H3}>{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

/** Layered-nav count badge (rotated grey square with the number on top). Categories hide it. */
function Count({ value }: { value?: number }) {
  if (value == null) return null;
  return (
    <span className="absolute right-[3px] top-[10px] h-5 w-5 text-center font-semibold text-white after:absolute after:left-0 after:top-[2px] after:h-full after:w-full after:rounded-[2px] after:bg-[var(--bb-text-muted)] after:[transform:rotate(45deg)] after:content-['']">
      <span className="relative z-[2] text-sm leading-5">{value}</span>
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
      <ul className={cn(className, shouldClamp && !revealed && VISIBLE_CLAMP)}>{children}</ul>
      {shouldClamp && !revealed && (
        <Button type="button" variant="dark" className={SHOW_MORE} onClick={() => setRevealed(true)}>
          Xem thêm
          <i className="far fa-plus ml-1.5" aria-hidden="true" />
        </Button>
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
      filter_gender: current.gender,
      min_price: current.minPrice,
      max_price: current.maxPrice,
      q: current.q,
      sort: current.sort,
      ...override,
    };
    return `${resetHref}${buildQueryString(params)}`;
  }

  const allBrandRows: { key: string; label: string; image?: ImageAsset | null; count?: number }[] =
    facets?.brands && facets.brands.length > 0
      ? facets.brands
      : brands.map((b) => ({ key: b.slug, label: b.name, image: b.logo ?? null }));
  const BRAND_LIMIT = 14;
  const brandRows =
    allBrandRows.length <= BRAND_LIMIT
      ? allBrandRows
      : (() => {
          const sliced = allBrandRows.slice(0, BRAND_LIMIT);
          if (current.brand && !sliced.some((b) => b.key === current.brand)) {
            const active = allBrandRows.find((b) => b.key === current.brand);
            if (active) sliced[BRAND_LIMIT - 1] = active;
          }
          return sliced;
        })();

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
    <aside
      className={cn(
        "block max-md:fixed max-md:top-0 max-md:right-0 max-md:z-[9999] max-md:h-full max-md:w-full",
        mobileOpen ? "max-md:block" : "max-md:hidden",
      )}
    >
      <div
        className={cn(
          "bg-white max-md:absolute max-md:top-0 max-md:right-0 max-md:z-[2] max-md:h-full max-md:w-[min(86vw,340px)] max-md:max-w-[340px] max-md:overflow-x-auto max-md:py-[18px] max-md:px-[var(--bb-mobile-page-x)] max-md:[transition:all_0.3s_ease]",
          mobileIn ? "max-md:[transform:translateX(0)]" : "max-md:[transform:translateX(100%)]",
        )}
      >
        <div className="hidden max-md:relative max-md:mb-[18px] max-md:block max-md:border-b max-md:border-[var(--bb-border-default)] max-md:pb-[14px] max-md:text-black">
          <p className="m-0 bg-white text-ui-24 font-semibold">BỘ LỌC</p>
          <button
            type="button"
            className="absolute right-0 top-2 cursor-pointer border-none bg-transparent text-ui-24 leading-none text-black"
            onClick={onMobileClose}
            aria-label={t("filterToggleCollapse")}
          >
            ×
          </button>
        </div>

        <div>
          {rootCategories.length > 0 && (
            <FilterSection title="Danh mục sản phẩm">
              <FilterList className={cn(LIST, "mb-5")} count={categoryRowCount}>
                {rootCategories.map((cat) => {
                  const href = toCategoryPath(cat.slug);
                  const active = href === resetHref || current.category === cat.slug;
                  const children = activeCategoryParentId === cat.id
                    ? visibleCategories.filter((child) => child.parentId === cat.id)
                    : [];
                  return (
                    <li key={cat.id} className="relative py-2.5">
                      <Link
                        href={href}
                        className={cn(LIST_LINK, active && `text-brand pl-[25px] ${CAT_DIAMOND}`)}
                      >
                        {cat.name}
                      </Link>
                      {children.length > 0 ? (
                        <ul className="relative m-0 block pt-2.5 after:absolute after:left-[9px] after:top-[15px] after:w-px after:[height:calc(100%_-_30px)] after:border after:border-dashed after:border-border-control-hover after:content-['']">
                          {children.map((child) => {
                            const childHref = toCategoryPath(child.slug);
                            const childActive = childHref === resetHref || current.category === child.slug;
                            return (
                              <li key={child.id} className="relative py-2.5 pl-[47px]">
                                <Link
                                  href={childHref}
                                  className={cn(LIST_LINK, childActive && `text-brand ${CAT_DIAMOND}`)}
                                >
                                  {child.name}
                                </Link>
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
            <FilterList className={LIST} count={priceRows.length + 1}>
              <li className="relative py-[15px]">
                <Link
                  href={queryHref({ min_price: undefined, max_price: undefined })}
                  className={cn(LIST_LINK, current.minPrice == null && current.maxPrice == null && "text-brand")}
                >
                  Tất cả
                </Link>
              </li>
              {priceRows.map((band) => {
                const active =
                  (current.minPrice ?? undefined) === band.min &&
                  (current.maxPrice ?? undefined) === band.max;
                const href = active
                  ? queryHref({ min_price: undefined, max_price: undefined })
                  : queryHref({ min_price: band.min, max_price: band.max });
                return (
                  <li key={band.key} className="relative py-[15px]">
                    <Link href={href} className={cn(LIST_LINK, active && "text-brand")}>
                      {band.label}
                    </Link>
                    <Count value={band.count} />
                  </li>
                );
              })}
            </FilterList>
          </FilterSection>

          {brandRows.length > 0 && (
            <FilterSection title="Thương Hiệu">
              <FilterList className={LIST} count={brandRows.length}>
                {brandRows.map((brand) => {
                  const active = current.brand === brand.key;
                  const href = active
                    ? queryHref({ "pwb-brand": undefined })
                    : queryHref({ "pwb-brand": brand.key });
                  const imageSrc = brand.image?.url?.trim()
                    ? resolveMediaUrl(brand.image.url.trim())
                    : null;
                  return (
                    <li key={brand.key} className="relative py-[15px]">
                      <Link
                        href={href}
                        className={cn(LIST_LINK, "flex items-center gap-2", active && "text-brand")}
                      >
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={safeText(brand.image?.alt, brand.label)}
                            width={92}
                            loading="lazy"
                            className="inline-block h-auto w-[92px] !max-w-[92px] align-middle"
                          />
                        ) : null}
                        {showBrandLabels || !imageSrc ? (
                          <span className="inline-block">{brand.label}</span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </FilterList>
            </FilterSection>
          )}

          {facets?.genders && facets.genders.length > 0 && (
            <FilterSection title={t("filterGender")}>
              <FilterList className={LIST} count={facets.genders.length}>
                {facets.genders.map((g) => {
                  const active = current.gender === g.key;
                  const href = active
                    ? queryHref({ filter_gender: undefined })
                    : queryHref({ filter_gender: g.key });
                  return (
                    <li key={g.key} className="relative py-[15px]">
                      <Link href={href} className={cn(LIST_LINK, active && "text-brand")}>
                        {g.label}
                      </Link>
                    </li>
                  );
                })}
              </FilterList>
            </FilterSection>
          )}

          <FilterSection title="Màu sắc">
            <FilterList className={LIST} count={colorRows.length}>
              {colorRows.map((color) => {
                const active = current.color === color.key;
                const href = active
                  ? queryHref({ filter_color: undefined })
                  : queryHref({ filter_color: color.key });
                return (
                  <li key={color.key} className="relative py-[15px]">
                    <Link href={href} className={cn(LIST_LINK, active && "text-brand")}>
                      {color.label}
                    </Link>
                  </li>
                );
              })}
            </FilterList>
          </FilterSection>
        </div>
      </div>
      <button
        type="button"
        className={cn(
          "hidden max-md:absolute max-md:top-0 max-md:left-0 max-md:z-[1] max-md:block max-md:h-full max-md:w-full max-md:border-none max-md:bg-[color-mix(in_srgb,var(--bb-color-black)_58%,transparent)] max-md:[transition:all_0.2s_ease]",
          mobileIn ? "max-md:opacity-100" : "max-md:opacity-0",
        )}
        onClick={onMobileClose}
        aria-label={t("filterToggleCollapse")}
      />
    </aside>
  );
}
