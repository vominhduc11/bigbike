type CatalogFilterSummary = {
  brandName?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  colorName?: string | null;
  page?: number | null;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);
}

export function buildCatalogTitle(baseTitle: string, filters: CatalogFilterSummary = {}): string {
  const parts = [baseTitle];

  if (filters.brandName) {
    parts.push(filters.brandName);
  }

  const hasMinPrice = typeof filters.minPrice === "number";
  const hasMaxPrice = typeof filters.maxPrice === "number";
  if (hasMinPrice || hasMaxPrice) {
    if (filters.minPrice === 0 && hasMaxPrice) {
      parts.push(`Gia duoi ${formatMoney(filters.maxPrice as number)} dong`);
    } else if (filters.maxPrice === 0 && hasMinPrice) {
      parts.push(`Gia tren ${formatMoney(filters.minPrice as number)} dong`);
    } else if (hasMinPrice && hasMaxPrice) {
      parts.push(`Gia tu ${formatMoney(filters.minPrice as number)} den ${formatMoney(filters.maxPrice as number)} dong`);
    } else if (hasMinPrice) {
      parts.push(`Gia tren ${formatMoney(filters.minPrice as number)} dong`);
    } else if (hasMaxPrice) {
      parts.push(`Gia duoi ${formatMoney(filters.maxPrice as number)} dong`);
    }
  }

  if (filters.colorName) {
    parts.push(`Mau ${filters.colorName}`);
  }

  if (filters.page && filters.page > 1) {
    parts.push(`Trang ${filters.page}`);
  }

  return parts.join(" - ");
}

