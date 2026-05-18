"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import type {
  Brand,
  CatalogFacets,
  Category,
  HomeSlider,
  ImageAsset,
} from "@/lib/contracts/public";
import { MediaImage } from "@/components/ui/MediaImage";
import { Input } from "@/components/ui/input";
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

type CatalogFiltersProps = {
  brands: Brand[];
  categories?: Category[];
  facets?: CatalogFacets | null;
  current: FilterState;
  resetHref: string;
  hiddenParams?: Record<string, string | undefined>;
  banner?: HomeSlider | null;
};

type Chip = { label: string; removeHref: string };

// Fixed named colors — must stay in sync with CatalogReadService.COLOR_FACETS (backend).
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

const COLOR_HEX: Record<string, string> = {
  bac: "#c4c4c4",
  cam: "#f97316",
  hong: "#ec4899",
  trang: "#f5f5f5",
  xam: "#6b7280",
  "xanh-da-troi": "#3b82f6",
  "xanh-la-cay": "#22c55e",
  vang: "#eab308",
  den: "#1a1a1a",
  do: "#e02020",
};

// Fixed price bands — must stay in sync with CatalogReadService.PRICE_BANDS (backend).
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

function buildChips(
  current: FilterState,
  resetHref: string,
  hiddenParams: Record<string, string | undefined>,
  categories: Category[],
): Chip[] {
  const chips: Chip[] = [];

  function hrefWithout(key: string): string {
    const remaining: Record<string, string | number | undefined> = {
      ...hiddenParams,
      q: key === "q" ? undefined : current.q,
      category: key === "category" ? undefined : current.category,
      "pwb-brand": key === "brand" ? undefined : current.brand,
      filter_color: key === "color" ? undefined : current.color,
      min_price: key === "price" ? undefined : current.minPrice,
      max_price: key === "price" ? undefined : current.maxPrice,
      sort: key === "sort" ? undefined : current.sort,
    };
    const qs = buildQueryString(remaining);
    return qs ? `${resetHref}${qs}` : resetHref;
  }

  if (current.q) chips.push({ label: `"${current.q}"`, removeHref: hrefWithout("q") });
  if (current.category) {
    const categoryLabel =
      categories.find((c) => c.slug === current.category)?.name ?? current.category;
    chips.push({ label: `Danh mục: ${categoryLabel}`, removeHref: hrefWithout("category") });
  }
  if (current.brand) chips.push({ label: current.brand, removeHref: hrefWithout("brand") });
  if (current.color) chips.push({ label: `Màu: ${current.color}`, removeHref: hrefWithout("color") });
  if (current.minPrice || current.maxPrice) {
    const lo = current.minPrice ? `${(current.minPrice / 1_000_000).toFixed(0)}tr` : "0";
    const hi = current.maxPrice ? `${(current.maxPrice / 1_000_000).toFixed(0)}tr` : "∞";
    chips.push({ label: `${lo} – ${hi}`, removeHref: hrefWithout("price") });
  }

  return chips;
}

const SECTION_HEADER =
  "mb-2.5 border-b-2 border-brand pb-1.5 font-display text-sm font-semibold uppercase tracking-[0.06em] text-foreground";

// One filter section — header + always-open content.
function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className={SECTION_HEADER}>{title}</h3>
      {children}
    </div>
  );
}

// One clickable filter row — label slot + optional count badge.
function FilterRow({
  href,
  active,
  count,
  children,
}: {
  href: string;
  active: boolean;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 py-[5px] text-sm leading-[1.3] no-underline transition-colors",
        active
          ? "font-semibold text-brand"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-current={active ? "true" : undefined}
    >
      {children}
      {count != null && (
        <span
          className={cn(
            "ml-auto shrink-0 text-xs tabular-nums",
            active ? "text-brand" : "text-muted-foreground/70",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

export function CatalogFilters({
  brands,
  categories = [],
  facets = null,
  current,
  resetHref,
  hiddenParams = {},
  banner = null,
}: CatalogFiltersProps) {
  const [brandSearch, setBrandSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleCategories = categories.filter((c) => c.isVisible);
  const chips = buildChips(current, resetHref, hiddenParams, visibleCategories);

  const hasActiveFilters =
    current.category || current.brand || current.color ||
    current.minPrice || current.maxPrice || current.q;

  // Builds an href off resetHref that keeps every active filter except the
  // dimension being changed by `override`.
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

  // ── Category rows: navigate to each category's own page ──────────────────
  const allProductsHref = toProductListPath();
  const categoryRows = visibleCategories.map((c) => ({ key: c.slug, label: c.name }));

  // ── Brand rows: prefer facets (all visible brands + counts), else props ──
  const brandRows: { key: string; label: string; image?: ImageAsset | null; count?: number }[] =
    facets?.brands && facets.brands.length > 0
      ? facets.brands
      : brands.map((b) => ({ key: b.slug, label: b.name, image: b.logo }));
  const filteredBrandRows = brandSearch.trim()
    ? brandRows.filter((b) => b.label.toLowerCase().includes(brandSearch.toLowerCase()))
    : brandRows;

  // ── Color rows ───────────────────────────────────────────────────────────
  const colorRows: { key: string; label: string; count?: number }[] =
    facets?.colors && facets.colors.length > 0 ? facets.colors : COLOR_FALLBACK;

  // ── Price rows ───────────────────────────────────────────────────────────
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

  const bannerImage = banner?.desktopImage?.url ? banner.desktopImage : null;
  const bannerHref = banner?.link ?? banner?.productLink ?? banner?.externalLink ?? null;

  return (
    <aside className="sticky top-[calc(var(--bb-header-height)+34px+16px)] self-start border-r border-border pr-7 max-[768px]:static max-[768px]:mb-6 max-[768px]:border-r-0 max-[768px]:border-b max-[768px]:border-b-white/[0.08] max-[768px]:pr-0 max-[768px]:pb-1">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b-2 border-brand pb-3 max-[768px]:px-0 max-[768px]:pt-1 max-[768px]:pb-2.5">
        <span className="font-display text-sm font-semibold uppercase tracking-[0.06em] text-foreground">
          Bộ lọc
        </span>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <Link
              href={resetHref}
              className="text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground no-underline transition-colors hover:text-brand"
            >
              Xoá tất cả
            </Link>
          )}
          <button
            type="button"
            className="hidden cursor-pointer border-0 bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground max-[768px]:flex max-[768px]:items-center"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
          >
            <svg
              className={cn(
                "shrink-0 text-muted-foreground transition-transform duration-300",
                mobileOpen && "rotate-180",
              )}
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 4l4 4 4-4" />
            </svg>
          </button>
        </div>
      </div>

      <div className={cn("block max-[768px]:hidden", mobileOpen && "max-[768px]:block")}>
        {/* Active filter chips */}
        {chips.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <Link
                key={chip.label}
                href={chip.removeHref}
                className="inline-flex items-center gap-1.5 border border-[color:var(--bb-brand-primary-border)] bg-brand/10 px-2.5 py-1 text-sm font-bold uppercase tracking-[0.08em] text-brand no-underline transition-colors hover:bg-brand/20"
                aria-label={`Bỏ bộ lọc: ${chip.label}`}
              >
                {chip.label}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M2 2l6 6M8 2l-6 6" />
                </svg>
              </Link>
            ))}
          </div>
        )}

        {/* ── Nhóm sản phẩm ───────────────────────────────────────────── */}
        {categoryRows.length > 0 && (
          <FilterSection title="Nhóm sản phẩm">
            <div className="flex flex-col">
              <FilterRow href={allProductsHref} active={resetHref === allProductsHref}>
                <span>Tất cả sản phẩm</span>
              </FilterRow>
              {categoryRows.map((cat) => {
                const href = toCategoryPath(cat.key);
                return (
                  <FilterRow
                    key={cat.key}
                    href={href}
                    active={href === resetHref}
                    count={facetCount(facets?.categories, cat.key)}
                  >
                    <span>{cat.label}</span>
                  </FilterRow>
                );
              })}
            </div>
          </FilterSection>
        )}

        {/* ── Giá bán ─────────────────────────────────────────────────── */}
        <FilterSection title="Giá bán">
          <div className="flex flex-col">
            {priceRows.map((band) => {
              const active =
                (current.minPrice ?? undefined) === band.min &&
                (current.maxPrice ?? undefined) === band.max;
              const href = active
                ? queryHref({ min_price: undefined, max_price: undefined })
                : queryHref({ min_price: band.min, max_price: band.max });
              return (
                <FilterRow key={band.key} href={href} active={active} count={band.count}>
                  <span>{band.label}</span>
                </FilterRow>
              );
            })}
          </div>
        </FilterSection>

        {/* ── Thương hiệu ─────────────────────────────────────────────── */}
        {brandRows.length > 0 && (
          <FilterSection title="Thương hiệu">
            <div className="flex flex-col">
              {brandRows.length > 8 && (
                <div className="relative mb-2">
                  <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <circle cx="5.5" cy="5.5" r="4" />
                    <path d="M8.5 8.5l3 3" />
                  </svg>
                  <Input
                    type="text"
                    className="min-h-0 py-2 pl-[30px] pr-2.5 text-sm"
                    placeholder="Tìm thương hiệu..."
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    aria-label="Tìm kiếm thương hiệu"
                  />
                </div>
              )}
              <div className="max-h-[260px] overflow-y-auto pr-1">
                <FilterRow href={queryHref({ "pwb-brand": undefined })} active={!current.brand}>
                  <span>Tất cả</span>
                </FilterRow>
                {filteredBrandRows.map((brand) => {
                  const active = current.brand === brand.key;
                  const href = active
                    ? queryHref({ "pwb-brand": undefined })
                    : queryHref({ "pwb-brand": brand.key });
                  return (
                    <FilterRow key={brand.key} href={href} active={active} count={brand.count}>
                      {brand.image?.url ? (
                        <MediaImage
                          image={brand.image}
                          altFallback={brand.label}
                          width={28}
                          height={28}
                          className="h-7 w-7 shrink-0 object-contain"
                        />
                      ) : (
                        <span className="h-7 w-7 shrink-0" aria-hidden="true" />
                      )}
                      <span className="truncate">{brand.label}</span>
                    </FilterRow>
                  );
                })}
                {filteredBrandRows.length === 0 && (
                  <p className="m-0 py-1 text-sm text-muted-foreground">Không tìm thấy</p>
                )}
              </div>
            </div>
          </FilterSection>
        )}

        {/* ── Màu sắc ─────────────────────────────────────────────────── */}
        <FilterSection title="Màu sắc">
          <div className="flex flex-col">
            <FilterRow href={queryHref({ filter_color: undefined })} active={!current.color}>
              <span>Tất cả</span>
            </FilterRow>
            {colorRows.map((color) => {
              const active = current.color === color.key;
              const href = active
                ? queryHref({ filter_color: undefined })
                : queryHref({ filter_color: color.key });
              return (
                <FilterRow key={color.key} href={href} active={active} count={color.count}>
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-border"
                    style={{ background: COLOR_HEX[color.key] ?? "#cccccc" }}
                    aria-hidden="true"
                  />
                  <span>{color.label}</span>
                </FilterRow>
              );
            })}
          </div>
        </FilterSection>

        {/* ── Banner khuyến mãi (admin-managed) ───────────────────────── */}
        {bannerImage && (
          <div className="mt-6">
            {bannerHref ? (
              <Link href={bannerHref} className="block" aria-label="Xem khuyến mãi">
                <MediaImage
                  image={{ url: bannerImage.url ?? undefined, alt: bannerImage.alt ?? undefined }}
                  altFallback="Khuyến mãi BigBike"
                  width={bannerImage.width ?? 260}
                  height={bannerImage.height ?? 340}
                  className="h-auto w-full"
                />
              </Link>
            ) : (
              <MediaImage
                image={{ url: bannerImage.url ?? undefined, alt: bannerImage.alt ?? undefined }}
                altFallback="Khuyến mãi BigBike"
                width={bannerImage.width ?? 260}
                height={bannerImage.height ?? 340}
                className="h-auto w-full"
              />
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
