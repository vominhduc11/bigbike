import { PRICE_PARAM_MAX } from "@/lib/constants/catalog";
import type { CatalogPriceRange } from "@/lib/contracts/public";

/** Number of logical positions used by the continuous slider. */
export const PRICE_TRACK_STEPS = 1_000;

/** Small linear contribution keeps empty histogram gaps reachable. */
const LINEAR_SCALE_WEIGHT = 0.08;

export type PriceSelection = {
  minPrice: number;
  maxPrice: number;
};

export type NormalizedPriceSelection = PriceSelection & {
  queryMinPrice?: number;
  queryMaxPrice?: number;
};

export type PriceDisplayRange = PriceSelection;

export type PriceScale = PriceDisplayRange & {
  actualMinPrice: number;
  actualMaxPrice: number;
  usesDensity: boolean;
  priceToPosition: (price: number) => number;
  positionToPrice: (position: number) => number;
};

function finiteInteger(value: number | string | null | undefined): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : undefined;
  if (value == null) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(/[^\d-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function numberFormatLocale(locale: string): "vi-VN" | "en-US" {
  return locale === "vi" ? "vi-VN" : "en-US";
}

/** Formats a full VND amount without shortening it to millions/billions. */
export function formatPriceInput(
  value: number | string | null | undefined,
  locale: string,
): string {
  const parsed = finiteInteger(value);
  if (parsed == null) return "";
  return new Intl.NumberFormat(numberFormatLocale(locale), {
    maximumFractionDigits: 0,
  }).format(parsed);
}

/** Formats the amount together with the locale-appropriate currency unit. */
export function formatPriceDisplay(value: number, locale: string): string {
  const formatted = formatPriceInput(value, locale);
  return locale === "vi" ? `${formatted}₫` : `${formatted} VND`;
}

function priceStepAt(value: number): number {
  if (value < 1_000_000) return 50_000;
  if (value <= 5_000_000) return 500_000;
  return 1_000_000;
}

function roundDown(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function roundUp(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/** Rounds the true facet endpoints outward for a readable public scale. */
export function getPriceDisplayRange(range: CatalogPriceRange): PriceDisplayRange {
  const minStep = priceStepAt(range.minPrice);
  const maxStep = priceStepAt(range.maxPrice);
  const roundedMin = roundDown(range.minPrice, minStep);
  const roundedMax = Math.min(PRICE_PARAM_MAX, roundUp(range.maxPrice, maxStep));

  return {
    minPrice: roundedMin > 0 ? roundedMin : range.minPrice,
    maxPrice: Math.max(range.maxPrice, roundedMax),
  };
}

function normalizedBuckets(range: CatalogPriceRange) {
  return (Array.isArray(range.buckets) ? range.buckets : [])
    .map((bucket) => ({
      minPrice: clamp(Math.round(bucket.minPrice), range.minPrice, range.maxPrice),
      maxPrice: clamp(Math.round(bucket.maxPrice), range.minPrice, range.maxPrice),
      count: Number.isFinite(bucket.count) && bucket.count > 0 ? bucket.count : 0,
    }))
    .filter((bucket) => bucket.maxPrice >= bucket.minPrice)
    .sort((left, right) => left.minPrice - right.minPrice || left.maxPrice - right.maxPrice);
}

function histogramCdf(
  price: number,
  range: CatalogPriceRange,
  buckets: ReturnType<typeof normalizedBuckets>,
  total: number,
): number {
  if (!total) return (price - range.minPrice) / Math.max(1, range.maxPrice - range.minPrice);

  let cumulative = 0;
  for (const bucket of buckets) {
    if (price >= bucket.maxPrice) {
      cumulative += bucket.count;
      continue;
    }
    if (price > bucket.minPrice && bucket.maxPrice > bucket.minPrice) {
      cumulative += bucket.count * ((price - bucket.minPrice) / (bucket.maxPrice - bucket.minPrice));
    }
    break;
  }
  return clamp(cumulative / total, 0, 1);
}

function shouldUseDensityScale(
  displayRange: PriceDisplayRange,
  buckets: ReturnType<typeof normalizedBuckets>,
): boolean {
  const span = displayRange.maxPrice - displayRange.minPrice;
  const narrowRange = span <= Math.max(1_000_000, displayRange.minPrice * 2);
  return !narrowRange && buckets.some((bucket) => bucket.count > 0);
}

/**
 * Builds the complete visual price scale. Density mode blends the histogram
 * quantile with a small linear component so even empty price gaps remain
 * reachable instead of collapsing to one point.
 */
export function buildPriceScale(range: CatalogPriceRange): PriceScale {
  const displayRange = getPriceDisplayRange(range);
  const buckets = normalizedBuckets(range);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const usesDensity = shouldUseDensityScale(displayRange, buckets);
  const displaySpan = Math.max(1, displayRange.maxPrice - displayRange.minPrice);

  const linearPosition = (price: number) => (
    clamp((price - displayRange.minPrice) / displaySpan, 0, 1)
  );

  const priceToPosition = (price: number) => {
    const normalizedPrice = clamp(price, displayRange.minPrice, displayRange.maxPrice);
    const linear = linearPosition(normalizedPrice);
    if (!usesDensity) return linear * PRICE_TRACK_STEPS;

    const histogram = histogramCdf(normalizedPrice, range, buckets, total);
    return (linear * LINEAR_SCALE_WEIGHT + histogram * (1 - LINEAR_SCALE_WEIGHT)) * PRICE_TRACK_STEPS;
  };

  const positionToPrice = (position: number) => {
    const normalizedPosition = clamp(position, 0, PRICE_TRACK_STEPS) / PRICE_TRACK_STEPS;
    if (!usesDensity) return displayRange.minPrice + normalizedPosition * displaySpan;
    if (normalizedPosition <= 0) return displayRange.minPrice;
    if (normalizedPosition >= 1) return displayRange.maxPrice;

    let low = displayRange.minPrice;
    let high = displayRange.maxPrice;
    for (let iteration = 0; iteration < 36; iteration += 1) {
      const middle = (low + high) / 2;
      if (priceToPosition(middle) < normalizedPosition * PRICE_TRACK_STEPS) low = middle;
      else high = middle;
    }
    return (low + high) / 2;
  };

  return {
    ...displayRange,
    actualMinPrice: range.minPrice,
    actualMaxPrice: range.maxPrice,
    usesDensity,
    priceToPosition,
    positionToPrice,
  };
}

/**
 * Normalizes URL price values against the actual facet endpoints. Explicit
 * values remain exact so existing shared URLs continue to work.
 */
export function normalizePriceSelection(
  range: CatalogPriceRange | null | undefined,
  rawMinPrice?: number | string | null,
  rawMaxPrice?: number | string | null,
): NormalizedPriceSelection | null {
  if (!range || !Number.isFinite(range.minPrice) || !Number.isFinite(range.maxPrice) || range.minPrice >= range.maxPrice) return null;

  const rawMin = finiteInteger(rawMinPrice);
  const rawMax = finiteInteger(rawMaxPrice);
  let minPrice = rawMin == null ? range.minPrice : clamp(rawMin, 0, PRICE_PARAM_MAX);
  let maxPrice = rawMax == null ? range.maxPrice : clamp(rawMax, 0, PRICE_PARAM_MAX);
  if (minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];

  return {
    minPrice,
    maxPrice,
    queryMinPrice: minPrice === range.minPrice ? undefined : minPrice,
    queryMaxPrice: maxPrice === range.maxPrice ? undefined : maxPrice,
  };
}

/** Maps an explicit/current selection into continuous slider coordinates. */
export function priceSelectionToSliderValues(
  selection: PriceSelection,
  scale: PriceScale,
): [number, number] {
  const values = [scale.priceToPosition(selection.minPrice), scale.priceToPosition(selection.maxPrice)]
    .sort((left, right) => left - right);
  return [values[0] ?? 0, values[1] ?? PRICE_TRACK_STEPS];
}

/** Converts live slider coordinates back to unsnapped money values. */
export function sliderValuesToPriceSelection(
  values: number[],
  scale: PriceScale,
): PriceSelection {
  const prices = [
    scale.positionToPrice(values[0] ?? 0),
    scale.positionToPrice(values[1] ?? PRICE_TRACK_STEPS),
  ].sort((left, right) => left - right);
  return {
    minPrice: prices[0] ?? scale.minPrice,
    maxPrice: prices[1] ?? scale.maxPrice,
  };
}

/** Snaps lower/upper bounds outward only after the user releases the handle. */
export function snapPriceSelection(
  selection: PriceSelection,
  scale: PriceScale,
): PriceSelection {
  const minPrice = clamp(
    roundDown(selection.minPrice, priceStepAt(selection.minPrice)),
    scale.minPrice,
    scale.maxPrice,
  );
  const maxPrice = clamp(
    roundUp(selection.maxPrice, priceStepAt(selection.maxPrice)),
    scale.minPrice,
    scale.maxPrice,
  );
  return minPrice <= maxPrice
    ? { minPrice, maxPrice }
    : { minPrice: maxPrice, maxPrice: minPrice };
}

/** Converts a snapped visual range to the public URL bounds. */
export function priceSelectionToQueryBounds(
  selection: PriceSelection,
  scale: PriceScale,
): { minPrice?: number; maxPrice?: number } {
  return {
    minPrice: selection.minPrice <= scale.minPrice ? undefined : selection.minPrice,
    maxPrice: selection.maxPrice >= scale.maxPrice ? undefined : selection.maxPrice,
  };
}

export function formatPriceAria(value: number, locale: string): string {
  return formatPriceDisplay(Math.max(0, Math.round(value)), locale);
}

export function priceRangeHasSelection(
  range: CatalogPriceRange | null | undefined,
  minPrice?: number,
  maxPrice?: number,
): boolean {
  if (!range || range.minPrice >= range.maxPrice) return false;
  return minPrice != null || maxPrice != null;
}
