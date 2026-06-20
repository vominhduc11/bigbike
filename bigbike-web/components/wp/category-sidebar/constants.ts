// Nhãn fallback (khi backend chưa trả facet màu/giá) — text lấy qua i18n
// `Catalog.colorFallback.*` / `Catalog.priceFallback.*` để đổi ngôn ngữ ở client.
export const COLOR_FALLBACK_KEYS = [
  "bac", "cam", "hong", "trang", "xam", "xanh-da-troi", "xanh-la-cay", "vang", "den", "do",
] as const;

export const PRICE_FALLBACK: { key: string; min?: number; max?: number }[] = [
  { key: "0-500k", min: 0, max: 500_000 },
  { key: "500k-1tr", min: 500_000, max: 1_000_000 },
  { key: "1-2tr", min: 1_000_000, max: 2_000_000 },
  { key: "2-3tr", min: 2_000_000, max: 3_000_000 },
  { key: "3-5tr", min: 3_000_000, max: 5_000_000 },
  { key: "5-10tr", min: 5_000_000, max: 10_000_000 },
  { key: "tren-10tr", min: 10_000_000, max: undefined },
];
