"use client";

/* eslint-disable @next/next/no-img-element */

import { Children, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "@/i18n/StorefrontLink";
import { Minus, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { CATALOG_FILTER_OPEN_EVENT } from "@/components/catalog/catalog-events";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Brand, CatalogFacets, Category, ImageAsset } from "@/lib/contracts/public";
import { cn } from "@/lib/utils";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { buildQueryString } from "@/lib/utils/query";
import { toCategoryPath } from "@/lib/utils/routes";
import { submenuIcon } from "@/lib/ui-classes";
import type { Locale } from "@/i18n/locale";

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
  { key: "tren-10tr", min: 10_000_000 },
];

export type CatalogFilterState = {
  q?: string;
  category?: string;
  brand?: string;
  color?: string;
  gender?: string;
  minPrice?: number;
  maxPrice?: number;
};

type CatalogSidebarProps = {
  brands: Brand[];
  categories: Category[];
  facets?: CatalogFacets | null;
  current: CatalogFilterState;
  resetHref: string;
  hiddenParams?: Record<string, string | undefined>;
};

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="m-0 pb-4 font-body text-a2-page font-semibold text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function CatalogToggleList({
  children,
  collapseAt = 10,
}: {
  children: React.ReactNode;
  collapseAt?: number;
}) {
  const t = useTranslations("Catalog");
  const [expanded, setExpanded] = useState(false);
  const [collapsing, setCollapsing] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const fromHeight = useRef<number | null>(null);
  const items = Children.toArray(children);
  const hasMore = items.length > collapseAt;
  const collapsed = hasMore && !expanded && !collapsing;
  const visibleItems = collapsed ? items.slice(0, collapseAt) : items;

  useLayoutEffect(() => {
    const element = listRef.current;
    if (!element || fromHeight.current == null) return;
    const from = fromHeight.current;
    fromHeight.current = null;
    const cut = element.children[collapseAt] as HTMLElement | undefined;
    const to = expanded
      ? element.scrollHeight
      : cut
        ? cut.getBoundingClientRect().top - element.getBoundingClientRect().top
        : element.scrollHeight;
    element.style.overflow = "hidden";
    element.style.maxHeight = `${from}px`;
    element.getBoundingClientRect();
    element.style.transition = "max-height 0.3s ease";
    element.style.maxHeight = `${to}px`;
    const finish = () => {
      element.removeEventListener("transitionend", finish);
      element.style.transition = "";
      if (expanded) {
        element.style.maxHeight = "";
        element.style.overflow = "";
      } else {
        setCollapsing(false);
      }
    };
    element.addEventListener("transitionend", finish);
    return () => element.removeEventListener("transitionend", finish);
  }, [expanded, collapseAt]);

  useLayoutEffect(() => {
    if (collapsing || !listRef.current) return;
    listRef.current.style.maxHeight = "";
    listRef.current.style.overflow = "";
    listRef.current.style.transition = "";
  }, [collapsing]);

  function toggle() {
    fromHeight.current = listRef.current?.getBoundingClientRect().height ?? null;
    if (expanded) setCollapsing(true);
    setExpanded((value) => !value);
  }

  return (
    <>
      <ul ref={listRef} className="m-0 list-none p-0">
        {visibleItems}
      </ul>
      {hasMore ? (
        <Button
          type="button"
          variant="primary"
          className="mt-3 h-13 w-full rounded-none text-primary-foreground!"
          onClick={toggle}
          aria-expanded={expanded}
        >
          {expanded ? t("showLess") : t("showMore")}
          {expanded ? <Minus className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
        </Button>
      ) : null}
    </>
  );
}

const filterListClass = "m-0 list-none p-0";
const filterRowClass = "flex min-h-11 items-center justify-between gap-3 py-2.5";
const filterLinkClass = "block flex-1 font-body font-semibold text-muted-foreground! no-underline! hover:text-brand!";
const categoryLinkClass = "text-a4-content md:text-a5-meta";

export function CatalogSidebar({
  brands,
  categories,
  facets = null,
  current,
  resetHref,
  hiddenParams = {},
}: CatalogSidebarProps) {
  const t = useTranslations("Catalog");
  const locale = useLocale() as Locale;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener(CATALOG_FILTER_OPEN_EVENT, open);
    return () => window.removeEventListener(CATALOG_FILTER_OPEN_EVENT, open);
  }, []);

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

  const visibleCategories = categories.filter((category) => category.isVisible);
  const activeCategory = visibleCategories.find(
    (category) => toCategoryPath(category.slug, locale) === resetHref || current.category === category.slug,
  );
  const activeParentId = activeCategory?.parentId ?? activeCategory?.id ?? null;
  const rootCategories = visibleCategories.filter((category) => !category.parentId);
  const brandRows: { key: string; label: string; image?: ImageAsset | null; count?: number }[] =
    facets?.brands?.length
      ? facets.brands
      : brands.map((brand) => ({ key: brand.slug, label: brand.name, image: brand.logo ?? null }));
  const colorRows: { key: string; label: string; count?: number }[] = facets?.colors?.length
    ? facets.colors
    : COLOR_FALLBACK_KEYS.map((key) => ({ key, label: t(`colorFallback.${key}`) }));
  const priceRows = facets?.priceBands?.length
    ? facets.priceBands.map((band) => ({
        key: band.key,
        label: band.label,
        min: band.minPrice ?? undefined,
        max: band.maxPrice ?? undefined,
      }))
    : PRICE_FALLBACK.map((band) => ({ ...band, label: t(`priceFallback.${band.key}`) }));
  const noPrice = current.minPrice == null && current.maxPrice == null;

  function renderFilters() {
    return (
      <div className="space-y-8">
        {rootCategories.length ? (
          <FilterSection title={t("filterCategory")}>
            <ul className={filterListClass}>
              {rootCategories.map((category) => {
                const href = toCategoryPath(category.slug, locale);
                const active = href === resetHref || current.category === category.slug;
                const children = activeParentId === category.id
                  ? visibleCategories.filter((child) => child.parentId === category.id)
                  : [];
                return (
                  <li key={category.id} className="py-2.5">
                    <LocalizedLink
                      kind="category"
                      viSlug={category.slug}
                      enSlug={category.slugEn}
                      className={cn(filterLinkClass, categoryLinkClass, "relative", category.menuIconUrl && "pl-7.5", active && "text-brand!")}
                    >
                      {category.menuIconUrl ? (
                        <span
                          aria-hidden
                          className={`${submenuIcon} absolute left-0 top-[3px]`}
                          style={{ maskImage: `url(${category.menuIconUrl})`, WebkitMaskImage: `url(${category.menuIconUrl})` }}
                        />
                      ) : null}
                      {category.name}
                    </LocalizedLink>
                    {children.length ? (
                      <ul className="ml-2 mt-2 list-none border-l border-dashed border-muted-foreground/60 pl-8">
                        {children.map((child) => {
                          const childActive = toCategoryPath(child.slug, locale) === resetHref || current.category === child.slug;
                          return (
                            <li key={child.id} className="py-2.5">
                              <LocalizedLink
                                kind="category"
                                viSlug={child.slug}
                                enSlug={child.slugEn}
                                className={cn(filterLinkClass, categoryLinkClass, "relative", child.menuIconUrl && "pl-7.5", childActive && "text-brand!")}
                              >
                                {child.menuIconUrl ? (
                                  <span
                                    aria-hidden
                                    className={`${submenuIcon} absolute left-0 top-[3px]`}
                                    style={{ maskImage: `url(${child.menuIconUrl})`, WebkitMaskImage: `url(${child.menuIconUrl})` }}
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
          </FilterSection>
        ) : null}

        <FilterSection title={t("filterPrice")}>
          <ul className={filterListClass}>
            <li className={filterRowClass}>
              <Link className={cn(filterLinkClass, noPrice && "text-brand!")} href={queryHref({ min_price: undefined, max_price: undefined })}>
                {t("allColors")}
              </Link>
            </li>
            {priceRows.map((band) => {
              const active = (current.minPrice ?? undefined) === band.min && (current.maxPrice ?? undefined) === band.max;
              return (
                <li className={filterRowClass} key={band.key}>
                  <Link
                    className={cn(filterLinkClass, active && "text-brand!")}
                    href={active ? queryHref({ min_price: undefined, max_price: undefined }) : queryHref({ min_price: band.min, max_price: band.max })}
                  >
                    {band.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </FilterSection>

        {facets?.genders?.length ? (
          <FilterSection title={t("filterGender")}>
            <ul className={filterListClass}>
              {facets.genders.map((gender) => {
                const active = current.gender === gender.key;
                return (
                  <li className={filterRowClass} key={gender.key}>
                    <Link className={cn(filterLinkClass, active && "text-brand!")} rel="nofollow" href={active ? queryHref({ filter_gender: undefined }) : queryHref({ filter_gender: gender.key })}>
                      {gender.label}
                    </Link>
                    {gender.count != null ? <span className="text-a5-meta text-muted-foreground">({gender.count})</span> : null}
                  </li>
                );
              })}
            </ul>
          </FilterSection>
        ) : null}

        <FilterSection title={t("filterColor")}>
          <CatalogToggleList collapseAt={7}>
            {colorRows.map((color) => {
              const active = current.color === color.key;
              return (
                <li className={filterRowClass} key={color.key}>
                  <Link className={cn(filterLinkClass, active && "text-brand!")} rel="nofollow" href={active ? queryHref({ filter_color: undefined }) : queryHref({ filter_color: color.key })}>
                    {color.label}
                  </Link>
                  {color.count != null ? <span className="text-a5-meta text-muted-foreground">({color.count})</span> : null}
                </li>
              );
            })}
          </CatalogToggleList>
        </FilterSection>

        {brandRows.length ? (
          <FilterSection title={t("filterBrand")}>
            <CatalogToggleList>
              {brandRows.map((brand) => {
                const active = current.brand === brand.key;
                const imageSrc = brand.image?.url?.trim() ? resolveMediaUrl(brand.image.url.trim()) : null;
                return (
                  <li className={filterRowClass} key={brand.key}>
                    <Link className={cn(filterLinkClass, "flex min-w-0 items-center gap-3", active && "text-brand!")} rel="nofollow" href={active ? queryHref({ "pwb-brand": undefined }) : queryHref({ "pwb-brand": brand.key })}>
                      <span className="flex h-8 w-24 shrink-0 items-center justify-center" aria-hidden={!imageSrc}>
                        {imageSrc ? <img src={imageSrc} alt={safeText(brand.image?.alt, brand.label)} width={92} height={32} loading="lazy" className="max-h-full max-w-full w-auto object-contain" /> : null}
                      </span>
                      <span className="min-w-0">{brand.label}</span>
                    </Link>
                  </li>
                );
              })}
            </CatalogToggleList>
          </FilterSection>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <aside className="hidden min-w-0 md:block!" aria-label={t("filterMobileHeading")}>
        {renderFilters()}
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-full! max-w-77.5! overflow-y-auto p-6!">
          <SheetTitle className="mb-6 border-b border-border pb-5 font-body text-a2-page font-semibold">
            {t("filterMobileHeading")}
          </SheetTitle>
          <SheetDescription className="sr-only">{t("filterMobileHeading")}</SheetDescription>
          {renderFilters()}
        </SheetContent>
      </Sheet>
    </>
  );
}
