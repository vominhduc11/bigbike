"use client";
import { useState } from "react";
import Link from "next/link";
import type { Brand, Category } from "@/lib/contracts/public";
import { BBTooltip } from "@/components/ui/BBTooltip";
import { buildQueryString } from "@/lib/utils/query";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  current: FilterState;
  resetHref: string;
  hiddenParams?: Record<string, string | undefined>;
};

type Chip = { label: string; removeHref: string };

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

const COLOR_OPTIONS = [
  { value: "", label: "Tất cả", hex: null },
  { value: "den", label: "Đen", hex: "#1a1a1a" },
  { value: "trang", label: "Trắng", hex: "#f5f5f5" },
  { value: "do", label: "Đỏ", hex: "#e02020" },
  { value: "xanh", label: "Xanh", hex: "#1d6fe8" },
  { value: "xam", label: "Xám", hex: "#6b7280" },
  { value: "cam", label: "Cam", hex: "#f97316" },
  { value: "vang", label: "Vàng", hex: "#eab308" },
];

export function CatalogFilters({
  brands,
  categories = [],
  current,
  resetHref,
  hiddenParams = {},
}: CatalogFiltersProps) {
  const [brandSearch, setBrandSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const visibleCategories = categories.filter((c) => c.isVisible);
  const chips = buildChips(current, resetHref, hiddenParams, visibleCategories);

  const filteredBrands = brandSearch.trim()
    ? brands.filter((b) => b.name.toLowerCase().includes(brandSearch.toLowerCase()))
    : brands;

  const hasActiveFilters =
    current.category || current.brand || current.color ||
    current.minPrice || current.maxPrice || current.q;

  const defaultOpenValues: string[] = ["category", "brand", "price"];

  return (
    <aside className="bb-filters-v2">
      {/* Header */}
      <div className="bb-filters-v2-header">
        <span className="bb-filters-v2-title">BỘ LỌC</span>
        <div className="bb-filters-v2-header-actions">
          {hasActiveFilters && (
            <Link href={resetHref} className="bb-filters-v2-clear">
              Xoá tất cả
            </Link>
          )}
          <button
            type="button"
            className="bb-filters-mobile-toggle"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
          >
            <svg
              className={cn("bb-filter-chevron", mobileOpen && "open")}
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

      <div className={cn("bb-filters-v2-body", mobileOpen && "is-open")}>
        {/* Active filter chips */}
        {chips.length > 0 && (
          <div className="bb-filter-chips">
            {chips.map((chip) => (
              <Link
                key={chip.label}
                href={chip.removeHref}
                className="bb-filter-chip"
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

        <form method="GET" className="bb-filters-v2-form">
          {Object.entries(hiddenParams).map(([key, value]) =>
            value ? <input key={key} type="hidden" name={key} value={value} /> : null,
          )}
          {current.sort && (
            <input type="hidden" name="sort" value={current.sort} />
          )}

          <Accordion type="multiple" defaultValue={defaultOpenValues} className="w-full">

            {/* Category filter */}
            {visibleCategories.length > 0 && (
              <AccordionItem value="category" className="border-b border-border">
                <AccordionTrigger className="py-3 text-xs font-semibold uppercase">
                  Danh mục
                </AccordionTrigger>
                <AccordionContent>
                  <RadioGroup name="category" defaultValue={current.category ?? ""} className="flex flex-col gap-1 pb-1">
                    <label className="bb-filter-row">
                      <RadioGroupItem value="" />
                      <span className="bb-filter-row-label">Tất cả sản phẩm</span>
                    </label>
                    {visibleCategories.map((category) => (
                      <label key={category.id} className="bb-filter-row">
                        <RadioGroupItem value={category.slug} />
                        <span className="bb-filter-row-label">{category.name}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Brand filter */}
            {brands.length > 0 && (
              <AccordionItem value="brand" className="border-b border-border">
                <AccordionTrigger className="py-3 text-xs font-semibold uppercase">
                  Thương hiệu
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-1 pb-1">
                    {brands.length > 6 && (
                      <div className="bb-filter-search-wrap mb-2">
                        <svg className="bb-filter-search-icon" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                          <circle cx="5.5" cy="5.5" r="4" />
                          <path d="M8.5 8.5l3 3" />
                        </svg>
                        <Input
                          type="text"
                          className="bb-filter-search"
                          placeholder="Tìm thương hiệu..."
                          value={brandSearch}
                          onChange={(e) => setBrandSearch(e.target.value)}
                          aria-label="Tìm kiếm thương hiệu"
                        />
                      </div>
                    )}
                    <RadioGroup name="pwb-brand" defaultValue={current.brand ?? ""} className="flex flex-col gap-1">
                      <label className="bb-filter-row">
                        <RadioGroupItem value="" />
                        <span className="bb-filter-row-label">Tất cả</span>
                      </label>
                      {filteredBrands.map((b) => (
                        <label key={b.id} className="bb-filter-row">
                          <RadioGroupItem value={b.slug} />
                          <span className="bb-filter-row-label">{b.name}</span>
                        </label>
                      ))}
                    </RadioGroup>
                    {filteredBrands.length === 0 && (
                      <p className="bb-filter-empty text-xs text-muted-foreground">Không tìm thấy</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Price filter */}
            <AccordionItem value="price" className="border-b border-border">
              <AccordionTrigger className="py-3 text-xs font-semibold uppercase">
                Khoảng giá
              </AccordionTrigger>
              <AccordionContent>
                <div className="pb-2">
                  <div className="bb-filter-price-row">
                    <div className="bb-filter-price-field">
                      <label className="bb-filter-price-label" htmlFor="min_price">Từ (₫)</label>
                      <Input
                        id="min_price"
                        name="min_price"
                        type="number"
                        min="0"
                        step="50000"
                        defaultValue={current.minPrice}
                        placeholder="0"
                        className="bb-filter-price-input"
                      />
                    </div>
                    <span className="bb-filter-price-sep">—</span>
                    <div className="bb-filter-price-field">
                      <label className="bb-filter-price-label" htmlFor="max_price">Đến (₫)</label>
                      <Input
                        id="max_price"
                        name="max_price"
                        type="number"
                        min="0"
                        step="50000"
                        defaultValue={current.maxPrice}
                        placeholder="∞"
                        className="bb-filter-price-input"
                      />
                    </div>
                  </div>
                  <div className="bb-filter-price-presets">
                    {[
                      { label: "< 1tr", min: undefined, max: 1000000 },
                      { label: "1–3tr", min: 1000000, max: 3000000 },
                      { label: "3–5tr", min: 3000000, max: 5000000 },
                      { label: "> 5tr", min: 5000000, max: undefined },
                    ].map((p) => {
                      const active = current.minPrice === p.min && current.maxPrice === p.max;
                      const qs = buildQueryString({
                        ...hiddenParams,
                        category: current.category,
                        "pwb-brand": current.brand,
                        q: current.q,
                        sort: current.sort,
                        min_price: p.min,
                        max_price: p.max,
                      });
                      return (
                        <Link
                          key={p.label}
                          href={`${resetHref}${qs}`}
                          className={cn("bb-filter-preset", active && "active")}
                        >
                          {p.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Color filter */}
            <AccordionItem value="color" className="border-b border-border">
              <AccordionTrigger className="py-3 text-xs font-semibold uppercase">
                Màu sắc
              </AccordionTrigger>
              <AccordionContent>
                <RadioGroup name="filter_color" defaultValue={current.color ?? ""} className="bb-filter-color-grid pb-1">
                  {COLOR_OPTIONS.map((opt) => {
                    const isActive = (current.color ?? "") === opt.value;
                    return (
                      <BBTooltip key={opt.value || "all-color"} content={opt.label} placement="top">
                        <label className={cn("bb-filter-color-swatch", isActive && "active")}>
                          <RadioGroupItem
                            value={opt.value}
                            className="bb-filter-color-input"
                            aria-label={opt.label}
                          />
                          <span
                            className="bb-filter-color-dot"
                            style={opt.hex ? { background: opt.hex } : undefined}
                            aria-hidden="true"
                          >
                            {!opt.hex && <span className="text-xs text-muted-foreground font-bold leading-none">ALL</span>}
                          </span>
                          <span className="bb-filter-color-name">{opt.label}</span>
                        </label>
                      </BBTooltip>
                    );
                  })}
                </RadioGroup>
              </AccordionContent>
            </AccordionItem>

          </Accordion>

          <Button className="bb-filter-apply mt-4 w-full" type="submit">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 3h12M3 7h8M5 11h4" />
            </svg>
            Áp dụng bộ lọc
          </Button>
        </form>
      </div>
    </aside>
  );
}
