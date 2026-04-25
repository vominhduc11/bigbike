import Link from "next/link";
import type { Brand } from "@/lib/contracts/public";
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

export function CatalogFilters({
  brands,
  current,
  resetHref,
  hiddenParams = {},
}: CatalogFiltersProps) {
  const chips = buildChips(current, resetHref, hiddenParams);

  return (
    <aside className="wp-filters">
      <form method="GET">
        {Object.entries(hiddenParams).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null,
        )}
        {current.sort && (
          <input type="hidden" name="sort" value={current.sort} />
        )}

        {brands.length > 0 && (
          <div className="wp-filter-group">
            <h5>Thương hiệu</h5>
            <label className="wp-filter-row">
              <input
                type="radio"
                name="pwb-brand"
                value=""
                defaultChecked={!current.brand}
              />
              Tất cả
            </label>
            {brands.map((b) => (
              <label key={b.id} className="wp-filter-row">
                <input
                  type="radio"
                  name="pwb-brand"
                  value={b.slug}
                  defaultChecked={current.brand === b.slug}
                />
                {b.name}
              </label>
            ))}
          </div>
        )}

        <div className="wp-filter-group">
          <h5>Khoảng giá</h5>
          <label
            className="wp-filter-row"
            style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}
          >
            <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bb-text-muted)" }}>
              Từ (₫)
            </span>
            <input
              name="min_price"
              type="number"
              min="0"
              step="50000"
              defaultValue={current.minPrice}
              placeholder="0"
              style={{
                width: "100%",
                background: "#0d0d0d",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                padding: "8px 10px",
                borderRadius: 4,
                fontSize: 12,
              }}
            />
          </label>
          <label
            className="wp-filter-row"
            style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}
          >
            <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bb-text-muted)" }}>
              Đến (₫)
            </span>
            <input
              name="max_price"
              type="number"
              min="0"
              step="50000"
              defaultValue={current.maxPrice}
              placeholder="Không giới hạn"
              style={{
                width: "100%",
                background: "#0d0d0d",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                padding: "8px 10px",
                borderRadius: 4,
                fontSize: 12,
              }}
            />
          </label>
        </div>

        <div className="wp-filter-group">
          <h5>Giới tính</h5>
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
              {opt.label}
            </label>
          ))}
        </div>

        <button className="wp-filter-apply" type="submit">
          Áp dụng bộ lọc
        </button>
        <Link href={resetHref} className="wp-filter-reset">
          Xoá bộ lọc
        </Link>
      </form>

      {chips.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {chips.map((chip) => (
            <Link
              key={chip.label}
              href={chip.removeHref}
              style={{
                fontSize: 10,
                padding: "3px 8px",
                background: "rgba(249,6,6,0.12)",
                color: "var(--bb-brand-primary)",
                border: "1px solid var(--bb-brand-primary-border)",
                borderRadius: 3,
                textDecoration: "none",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
              aria-label={`Bỏ bộ lọc: ${chip.label}`}
            >
              {chip.label} ✕
            </Link>
          ))}
        </div>
      )}
    </aside>
  );
}
