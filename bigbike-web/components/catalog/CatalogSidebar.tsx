"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { CATALOG_FILTER_OPEN_EVENT } from "@/components/catalog/catalog-events";
import { CatalogFilterChips } from "@/components/catalog/CatalogFilterChips";
import { CatalogPriceFilter } from "@/components/catalog/CatalogPriceFilter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { Brand, CatalogFacets, Category, FacetBucket, SizeBucket } from "@/lib/contracts/public";
import { cn } from "@/lib/utils";
import {
  clearCatalogFilters,
  countCatalogFilters,
  getAvailableCatalogFilterGroups,
  removeCatalogFilter,
  toggleCatalogArrayValue,
  type CatalogFilterGroupKey,
  type CatalogFilterState,
} from "@/lib/utils/catalog-filter-state";
import { buildQueryString } from "@/lib/utils/query";

export type { CatalogFilterState } from "@/lib/utils/catalog-filter-state";

const DESKTOP_OPEN_KEY = "bb-catalog-filter-open-v2";
const DEFAULT_DESKTOP_OPEN = ["brand", "price"];

type CatalogSidebarProps = {
  brands: Brand[];
  categories: Category[];
  facets?: CatalogFacets | null;
  current: CatalogFilterState;
  mobileCurrent: CatalogFilterState;
  resetHref: string;
  hiddenParams?: Record<string, string | string[] | number | undefined>;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onMobileChange: (next: CatalogFilterState) => void;
  onMobileApply: () => void;
  hideBrandFilter?: boolean;
};

function stateToQuery(
  state: CatalogFilterState,
  hiddenParams: CatalogSidebarProps["hiddenParams"],
) {
  return {
    ...hiddenParams,
    "pwb-brand": state.brand.length ? state.brand : undefined,
    filter_color: state.color.length ? state.color : undefined,
    filter_finish: state.finish.length ? state.finish : undefined,
    filter_gender: state.gender,
    "kich-co": state.size.length ? state.size : undefined,
    min_price: state.minPrice,
    max_price: state.maxPrice,
    in_stock: state.inStock ? "true" : undefined,
    q: state.q,
    category: state.category,
  };
}

function FacetList({
  rows,
  selected,
  onToggle,
  searchable,
  colorDots = false,
  grid = false,
}: {
  rows: FacetBucket[];
  selected: string[];
  onToggle: (key: string) => void;
  searchable?: boolean;
  colorDots?: boolean;
  grid?: boolean;
}) {
  const t = useTranslations("Catalog");
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = rows.filter((row) => row.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const visible = expanded || query ? filtered : filtered.slice(0, 8);
  const hasMore = filtered.length > 8 && !query;

  return (
    <div>
      {searchable && rows.length > 10 ? (
        <label className="relative mb-3 block">
          <span className="sr-only">{t("brandSearchAria")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={t("brandSearchPlaceholder")}
            className="min-h-11 pl-10"
          />
        </label>
      ) : null}
      <ul className={cn("m-0 list-none p-0", grid ? "grid grid-cols-2 gap-2" : "space-y-1")}>
        {visible.map((row) => {
          const active = selected.includes(row.key);
          return (
            <li key={row.key}>
              <label className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 py-1 text-a5-meta font-semibold text-muted-foreground",
                grid && "border border-border px-3 transition-colors hover:border-brand hover:bg-brand-soft",
                active && grid && "border-brand bg-brand-soft",
              )}>
                <Checkbox
                  checked={active}
                  onCheckedChange={() => onToggle(row.key)}
                  aria-label={`${row.label} (${row.count})`}
                />
                {colorDots ? (
                  <span
                    aria-hidden
                    className="h-5 w-5 shrink-0 rounded-full border border-border"
                    style={{ backgroundColor: row.swatch ?? "transparent" }}
                  />
                ) : null}
                <span className={cn("min-w-0 flex-1", active && "text-brand")}>{row.label}</span>
                <span aria-hidden>({row.count})</span>
              </label>
            </li>
          );
        })}
      </ul>
      {hasMore ? (
        <Button
          type="button"
          variant="link"
          className="mt-2 min-h-11 rounded-none px-0 text-a5-meta normal-case tracking-normal underline"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? t("showLess") : t("showMore")}
        </Button>
      ) : null}
    </div>
  );
}

function SizeGrid({
  groups,
  selected,
  onToggle,
}: {
  groups: NonNullable<CatalogFacets["sizeGroups"]>;
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const t = useTranslations("Catalog");
  const allBuckets = groups.flatMap((group) => group.buckets);
  const [query, setQuery] = useState("");
  const matches = (bucket: SizeBucket) => bucket.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  return (
    <div className="space-y-4" data-size-filter="true">
      {allBuckets.length > 10 ? (
        <label className="relative block">
          <span className="sr-only">{t("sizeSearch")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={t("sizeSearch")}
            className="min-h-11 pl-10"
          />
        </label>
      ) : null}
      {groups.map((group) => {
        const buckets = group.buckets.filter(matches);
        if (!buckets.length) return null;
        return (
          <div key={group.key}>
            <p className="mb-2 text-a5-meta font-semibold text-muted-foreground">{group.label}</p>
            {/* Ô cỡ tự co giãn theo độ dài nhãn (XS → XL/2XL, 30/44): cột lọc desktop chỉ ~290px
                nên lưới cột cố định sẽ cắt chữ tràn ra ngoài viền. */}
            <div className="flex flex-wrap gap-2">
              {buckets.map((bucket) => {
                const active = selected.includes(bucket.key);
                return (
                  <Button
                    key={bucket.key}
                    type="button"
                    variant={active ? "primary" : "filter"}
                    className="h-11 min-w-11 shrink-0 whitespace-nowrap rounded-none px-3 text-a5-meta hover:not-disabled:!scale-100"
                    onClick={() => onToggle(bucket.key)}
                    aria-pressed={active}
                    aria-label={`${bucket.label} (${bucket.count})`}
                  >
                    {bucket.label}
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function summaryFor(group: CatalogFilterGroupKey, state: CatalogFilterState, facets: CatalogFacets | null | undefined) {
  const values = group === "brand" ? state.brand
    : group === "color" ? state.color
      : group === "finish" ? state.finish
        : group === "size" ? state.size
          : [];
  if (values.length) {
    const all = [
      ...(facets?.brands ?? []),
      ...(facets?.colors ?? []),
      ...(facets?.finishes ?? []),
      ...((facets?.sizeGroups ?? []).flatMap((item) => item.buckets)),
    ];
    return values.map((value) => all.find((item) => item.key === value)?.label ?? value).join(", ");
  }
  if (group === "gender") return state.gender;
  if (group === "price" && (state.minPrice != null || state.maxPrice != null)) return "✓";
  if (group === "stock" && state.inStock) return "✓";
  return undefined;
}

export function CatalogSidebar({
  facets,
  current,
  mobileCurrent,
  resetHref,
  hiddenParams = {},
  mobileOpen,
  onMobileOpenChange,
  onMobileChange,
  onMobileApply,
  hideBrandFilter = false,
}: CatalogSidebarProps) {
  const t = useTranslations("Catalog");
  const [desktopOpen, setDesktopOpen] = useState<string[]>(DEFAULT_DESKTOP_OPEN);
  const [mobileGroup, setMobileGroup] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(DESKTOP_OPEN_KEY);
        if (saved) setDesktopOpen(JSON.parse(saved) as string[]);
      } catch { /* localStorage may be unavailable; defaults remain usable. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const open = () => {
      setMobileGroup("");
      onMobileOpenChange(true);
    };
    window.addEventListener(CATALOG_FILTER_OPEN_EVENT, open);
    return () => window.removeEventListener(CATALOG_FILTER_OPEN_EVENT, open);
  }, [onMobileOpenChange]);

  function setMobileSheetOpen(open: boolean) {
    if (open) setMobileGroup("");
    onMobileOpenChange(open);
  }

  const groups = getAvailableCatalogFilterGroups(facets, hideBrandFilter);

  const groupTitle = (group: CatalogFilterGroupKey, state: CatalogFilterState) => {
    const base = group === "brand" ? t("filterBrand")
      : group === "price" ? t("filterPrice")
        : group === "size" ? t("filterSize")
          : group === "color" ? t("filterColor")
            : group === "finish" ? t("filterFinish")
              : group === "stock" ? t("filterAvailability")
                : t("filterGender");
    const count = group === "brand" ? state.brand.length
      : group === "color" ? state.color.length
        : group === "finish" ? state.finish.length
          : group === "size" ? state.size.length
            : group === "gender" && state.gender ? 1
              : group === "stock" && state.inStock ? 1
                : group === "price" && (state.minPrice != null || state.maxPrice != null) ? 1 : 0;
    return count ? `${base} (${count})` : base;
  };

  function desktopHref(next: CatalogFilterState) {
    const query = buildQueryString(stateToQuery(next, hiddenParams));
    return `${resetHref}${query}`;
  }

  function commitDesktop(next: CatalogFilterState) {
    const target = desktopHref(next);
    const current = `${window.location.pathname}${window.location.search}`;
    if (target !== current) window.history.pushState(null, "", target);
  }

  function content(group: CatalogFilterGroupKey, state: CatalogFilterState, change: (next: CatalogFilterState) => void, mobile: boolean) {
    if (group === "brand") return (
      <FacetList rows={facets?.brands ?? []} selected={state.brand} searchable onToggle={(key) => change({ ...state, brand: toggleCatalogArrayValue(state.brand, key) })} />
    );
    if (group === "price" && facets?.priceRange) return (
      <CatalogPriceFilter
        range={facets.priceRange}
        currentMinPrice={state.minPrice}
        currentMaxPrice={state.maxPrice}
        queryHref={(override) => desktopHref({
          ...state,
          minPrice: override.min_price as number | undefined,
          maxPrice: override.max_price as number | undefined,
        })}
        onCommit={(minPrice, maxPrice) => change({ ...state, minPrice, maxPrice })}
      />
    );
    if (group === "size") return (
      <SizeGrid groups={facets?.sizeGroups ?? []} selected={state.size} onToggle={(key) => change({ ...state, size: toggleCatalogArrayValue(state.size, key) })} />
    );
    if (group === "color") return (
      <FacetList rows={facets?.colors ?? []} selected={state.color} colorDots grid={mobile} onToggle={(key) => change({ ...state, color: toggleCatalogArrayValue(state.color, key) })} />
    );
    if (group === "finish") return (
      <FacetList rows={facets?.finishes ?? []} selected={state.finish} onToggle={(key) => change({ ...state, finish: toggleCatalogArrayValue(state.finish, key) })} />
    );
    if (group === "stock") return (
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-a5-meta font-semibold text-muted-foreground">
        <Checkbox checked={state.inStock} onCheckedChange={() => change({ ...state, inStock: !state.inStock })} />
        <span className={cn(state.inStock && "text-brand")}>{t("inStockOnly")}</span>
        <span className="ml-auto">({facets?.availability?.count ?? 0})</span>
      </label>
    );
    return (
      <RadioGroup
        value={state.gender ?? ""}
        onValueChange={(value) => change({ ...state, gender: value || undefined })}
        className={mobile ? "grid grid-cols-2 gap-2" : "space-y-1"}
        data-gender-filter="true"
        aria-label={t("filterGender")}
      >
        {(facets?.genders ?? []).map((gender) => {
          const active = state.gender === gender.key;
          const id = `catalog-gender-${mobile ? "mobile" : "desktop"}-${gender.key}`;
          return (
            <label
              key={gender.key}
              htmlFor={id}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 py-1 text-a5-meta font-semibold text-muted-foreground",
                active && "text-brand",
              )}
            >
              <RadioGroupItem id={id} value={gender.key} className="!h-5 !w-5 !rounded-full">
                {active ? <span aria-hidden className="h-2.5 w-2.5 !rounded-full bg-brand" /> : null}
              </RadioGroupItem>
              <span className="min-w-0 flex-1">{gender.label}</span>
              <span aria-hidden>({gender.count})</span>
            </label>
          );
        })}
      </RadioGroup>
    );
  }

  return (
    <>
      <aside
        data-catalog-sidebar
        className="sticky top-[calc(var(--bb-header-height)+1rem)] hidden max-h-[calc(100dvh-var(--bb-header-height)-2rem)] min-w-0 overflow-y-auto overscroll-contain pr-3 md:block"
        aria-label={t("filterMobileHeading")}
      >
        <Accordion
          type="multiple"
          value={desktopOpen}
          onValueChange={(value) => {
            setDesktopOpen(value);
            try { window.localStorage.setItem(DESKTOP_OPEN_KEY, JSON.stringify(value)); } catch { /* noop */ }
          }}
        >
          {groups.map((group) => (
            <AccordionItem value={group} key={group}>
              <AccordionTrigger>{groupTitle(group, current)}</AccordionTrigger>
              <AccordionContent>{content(group, current, commitDesktop, false)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent side="right" showClose={false} className="inset-0 flex h-dvh w-screen max-w-none flex-col gap-0 border-0 p-0 sm:max-w-none">
          <header className="flex min-h-16 items-center gap-3 border-b border-border px-4">
            <Button type="button" variant="ghost" className="h-11 w-11 rounded-none p-0" onClick={() => setMobileSheetOpen(false)}>
              <ChevronLeft className="h-5 w-5" aria-hidden />
              <span className="sr-only">{t("closeFilter")}</span>
            </Button>
            <SheetTitle className="flex-1">{t("filterMobileHeading")}</SheetTitle>
            <SheetDescription className="sr-only">{t("filterMobileDescription")}</SheetDescription>
            {countCatalogFilters(mobileCurrent) ? (
              <Button type="button" variant="link" className="h-11 rounded-none text-a5-meta normal-case tracking-normal underline" onClick={() => onMobileChange(clearCatalogFilters(mobileCurrent))}>
                {t("clearAll")}
              </Button>
            ) : null}
          </header>

          <div className="border-b border-border px-4 py-3">
            <CatalogFilterChips
              compact
              current={mobileCurrent}
              facets={facets}
              onRemove={(token) => onMobileChange(removeCatalogFilter(mobileCurrent, token))}
              onClear={() => onMobileChange(clearCatalogFilters(mobileCurrent))}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <Accordion type="single" collapsible value={mobileGroup} onValueChange={setMobileGroup}>
              {groups.map((group) => {
                const summary = summaryFor(group, mobileCurrent, facets);
                return (
                  <AccordionItem value={group} key={group}>
                    <AccordionTrigger className="min-h-14 py-3">
                      <span className="min-w-0 text-left">
                        <span className="block">{groupTitle(group, mobileCurrent)}</span>
                        {summary ? <span className="mt-1 block truncate font-body text-a5-meta font-normal normal-case text-muted-foreground">{summary}</span> : null}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>{content(group, mobileCurrent, onMobileChange, true)}</AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          <footer className="border-t border-border bg-background p-4">
            <Button type="button" variant="primary" className="h-13 w-full rounded-none" onClick={onMobileApply}>
              {t("viewProducts", { count: facets?.resultCount ?? 0 })}
            </Button>
          </footer>
        </SheetContent>
      </Sheet>
    </>
  );
}
