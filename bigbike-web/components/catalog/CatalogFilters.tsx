"use client";
import { useState } from "react";
import Link from "next/link";
import type { Brand } from "@/lib/contracts/public";
import { BBTooltip } from "@/components/ui/BBTooltip";
import { buildQueryString } from "@/lib/utils/query";

type FilterState = {
  q?: string;
  brand?: string;
  color?: string;
  gender?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
};

type CatalogFiltersProps = {
  brands: Brand[];
  current: FilterState;
  resetHref: string;
  hiddenParams?: Record<string, string | undefined>;
};

type Chip = { label: string; removeHref: string };

function buildChips(
  current: FilterState,
  resetHref: string,
  hiddenParams: Record<string, string | undefined>,
): Chip[] {
  const chips: Chip[] = [];

  function hrefWithout(key: string): string {
    const remaining: Record<string, string | number | undefined> = {
      ...hiddenParams,
      q: key === "q" ? undefined : current.q,
      "pwb-brand": key === "brand" ? undefined : current.brand,
      filter_color: key === "color" ? undefined : current.color,
      filter_gender: key === "gender" ? undefined : current.gender,
      min_price: key === "price" ? undefined : current.minPrice,
      max_price: key === "price" ? undefined : current.maxPrice,
      sort: key === "sort" ? undefined : current.sort,
    };
    const qs = buildQueryString(remaining);
    return qs ? `${resetHref}${qs}` : resetHref;
  }

  if (current.q) chips.push({ label: `"${current.q}"`, removeHref: hrefWithout("q") });
  if (current.brand) chips.push({ label: current.brand, removeHref: hrefWithout("brand") });
  if (current.color) chips.push({ label: `Màu: ${current.color}`, removeHref: hrefWithout("color") });
  if (current.gender === "nam") chips.push({ label: "Nam", removeHref: hrefWithout("gender") });
  if (current.gender === "nu") chips.push({ label: "Nữ", removeHref: hrefWithout("gender") });
  if (current.minPrice || current.maxPrice) {
    const lo = current.minPrice ? `${(current.minPrice / 1_000_000).toFixed(0)}tr` : "0";
    const hi = current.maxPrice ? `${(current.maxPrice / 1_000_000).toFixed(0)}tr` : "∞";
    chips.push({ label: `${lo} – ${hi}`, removeHref: hrefWithout("price") });
  }

  return chips;
}

function FilterSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="wp-filter-section">
      <button
        type="button"
        className="wp-filter-section-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <svg
          className={`wp-filter-chevron${open ? " open" : ""}`}
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
      {open && <div className="wp-filter-section-body">{children}</div>}
    </div>
  );
}

export function CatalogFilters({
  brands,
  current,
  resetHref,
  hiddenParams = {},
}: CatalogFiltersProps) {
  const [brandSearch, setBrandSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const chips = buildChips(current, resetHref, hiddenParams);

  const filteredBrands = brandSearch.trim()
    ? brands.filter((b) =>
        b.name.toLowerCase().includes(brandSearch.toLowerCase()),
      )
    : brands;

  const hasActiveFilters =
    current.brand || current.color || current.gender || current.minPrice || current.maxPrice || current.q;

  return (
    <aside className="wp-filters-v2">
      {/* Header */}
      <div className="wp-filters-v2-header">
        <span className="wp-filters-v2-title">BỘ LỌC</span>
        <div className="wp-filters-v2-header-actions">
          {hasActiveFilters && (
            <Link href={resetHref} className="wp-filters-v2-clear">
              Xoá tất cả
            </Link>
          )}
          <button
            type="button"
            className="wp-filters-mobile-toggle"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
          >
            <svg
              className={`wp-filter-chevron${mobileOpen ? " open" : ""}`}
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

      <div className={`wp-filters-v2-body${mobileOpen ? " is-open" : ""}`}>
      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="wp-filter-chips">
          {chips.map((chip) => (
            <Link
              key={chip.label}
              href={chip.removeHref}
              className="wp-filter-chip"
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

      <form method="GET" className="wp-filters-v2-form">
        {Object.entries(hiddenParams).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null,
        )}
        {current.sort && (
          <input type="hidden" name="sort" value={current.sort} />
        )}

        {/* Brand filter */}
        {brands.length > 0 && (
          <FilterSection title="Thương hiệu">
            {brands.length > 6 && (
              <div className="wp-filter-search-wrap">
                <svg className="wp-filter-search-icon" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <circle cx="5.5" cy="5.5" r="4" />
                  <path d="M8.5 8.5l3 3" />
                </svg>
                <input
                  type="text"
                  className="wp-filter-search"
                  placeholder="Tìm thương hiệu..."
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  aria-label="Tìm kiếm thương hiệu"
                />
              </div>
            )}
            <label className="wp-filter-row">
              <input type="radio" name="pwb-brand" value="" defaultChecked={!current.brand} />
              <span className="wp-filter-row-label">Tất cả</span>
            </label>
            {filteredBrands.map((b) => (
              <label key={b.id} className="wp-filter-row">
                <input
                  type="radio"
                  name="pwb-brand"
                  value={b.slug}
                  defaultChecked={current.brand === b.slug}
                />
                <span className="wp-filter-row-label">{b.name}</span>
              </label>
            ))}
            {filteredBrands.length === 0 && (
              <p className="wp-filter-empty">Không tìm thấy</p>
            )}
          </FilterSection>
        )}

        {/* Price filter */}
        <FilterSection title="Khoảng giá">
          <div className="wp-filter-price-row">
            <div className="wp-filter-price-field">
              <label className="wp-filter-price-label" htmlFor="min_price">Từ (₫)</label>
              <input
                id="min_price"
                name="min_price"
                type="number"
                min="0"
                step="50000"
                defaultValue={current.minPrice}
                placeholder="0"
                className="wp-filter-price-input"
              />
            </div>
            <span className="wp-filter-price-sep">—</span>
            <div className="wp-filter-price-field">
              <label className="wp-filter-price-label" htmlFor="max_price">Đến (₫)</label>
              <input
                id="max_price"
                name="max_price"
                type="number"
                min="0"
                step="50000"
                defaultValue={current.maxPrice}
                placeholder="∞"
                className="wp-filter-price-input"
              />
            </div>
          </div>
          <div className="wp-filter-price-presets">
            {[
              { label: "< 1tr", min: undefined, max: 1000000 },
              { label: "1–3tr", min: 1000000, max: 3000000 },
              { label: "3–5tr", min: 3000000, max: 5000000 },
              { label: "> 5tr", min: 5000000, max: undefined },
            ].map((p) => {
              const active = current.minPrice === p.min && current.maxPrice === p.max;
              const qs = buildQueryString({
                ...hiddenParams,
                "pwb-brand": current.brand,
                filter_gender: current.gender,
                q: current.q,
                sort: current.sort,
                min_price: p.min,
                max_price: p.max,
              });
              return (
                <Link
                  key={p.label}
                  href={`${resetHref}${qs}`}
                  className={`wp-filter-preset${active ? " active" : ""}`}
                >
                  {p.label}
                </Link>
              );
            })}
          </div>
        </FilterSection>

        {/* Color filter */}
        <FilterSection title="Màu sắc" defaultOpen={false}>
          <div className="wp-filter-color-grid">
            {[
              { value: "", label: "Tất cả", hex: null },
              { value: "den", label: "Đen", hex: "#1a1a1a" },
              { value: "trang", label: "Trắng", hex: "#f5f5f5" },
              { value: "do", label: "Đỏ", hex: "#e02020" },
              { value: "xanh", label: "Xanh", hex: "#1d6fe8" },
              { value: "xam", label: "Xám", hex: "#6b7280" },
              { value: "cam", label: "Cam", hex: "#f97316" },
              { value: "vang", label: "Vàng", hex: "#eab308" },
            ].map((opt) => {
              const isActive = (current.color ?? "") === opt.value;
              return (
                <BBTooltip key={opt.value || "all-color"} content={opt.label} placement="top">
                  <label
                    className={`wp-filter-color-swatch${isActive ? " active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="filter_color"
                      value={opt.value}
                      defaultChecked={isActive}
                      className="wp-filter-color-input"
                    />
                    <span
                      className="wp-filter-color-dot"
                      style={opt.hex ? { background: opt.hex } : undefined}
                      aria-hidden="true"
                    >
                      {!opt.hex && <span style={{ fontSize: 8, color: "var(--bb-text-muted)" }}>ALL</span>}
                    </span>
                    <span className="wp-filter-color-name">{opt.label}</span>
                  </label>
                </BBTooltip>
              );
            })}
          </div>
        </FilterSection>

        {/* Gender filter */}
        <FilterSection title="Giới tính" defaultOpen={false}>
          {[
            { value: "", label: "Tất cả" },
            { value: "nam", label: "Nam" },
            { value: "nu", label: "Nữ" },
          ].map((opt) => (
            <label key={opt.value || "all"} className="wp-filter-row">
              <input
                type="radio"
                name="filter_gender"
                value={opt.value}
                defaultChecked={(current.gender ?? "") === opt.value}
              />
              <span className="wp-filter-row-label">{opt.label}</span>
            </label>
          ))}
        </FilterSection>

        <button className="wp-filter-apply" type="submit">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 3h12M3 7h8M5 11h4" />
          </svg>
          Áp dụng bộ lọc
        </button>
      </form>
      </div>
    </aside>
  );
}
