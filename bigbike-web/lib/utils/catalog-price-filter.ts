import { PRICE_PARAM_MAX } from "@/lib/constants/catalog";
import type { CatalogPriceRange } from "@/lib/contracts/public";

/**
 * Kept as response metadata for compatibility with the public facets contract.
 * The storefront deliberately does not use it as an offset from minPrice.
 */
export const PRICE_FILTER_STEP = 50_000;
export const PRICE_TICK_LIMIT = 64;
export const PRICE_DENSITY_CUTOFF = 0.9;

export type PriceSelection = {
  minPrice: number;
  maxPrice: number;
};

export type NormalizedPriceSelection = PriceSelection & {
  queryMinPrice?: number;
  queryMaxPrice?: number;
};

export type PriceScale = {
  ticks: number[];
  /** Index of the rounded cap whose meaning is "this value and above". */
  openEndedIndex: number | null;
  /** The rounded cap value shown beside the open-ended tick. */
  openEndedValue?: number;
};

function finiteInteger(value: number | string | null | undefined): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : undefined;
  if (value == null) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const direct = Number(trimmed);
  if (Number.isFinite(direct)) return Math.round(direct);

  const digits = trimmed.replace(/[^\d-]/g, "");
  if (!digits || digits === "-") return undefined;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function numberFormatLocale(locale: string): "vi-VN" | "en-US" {
  return locale === "vi" ? "vi-VN" : "en-US";
}

/** Parses the locale-formatted value used by the price inputs. */
export function parsePriceInput(
  value: number | string | null | undefined,
  locale: string,
): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : undefined;
  }
  if (value == null) return undefined;

  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return undefined;
  const groupingSeparator = locale === "vi" ? "." : ",";
  const normalized = trimmed.replaceAll(groupingSeparator, "").replace(/[^\d-]/g, "");
  if (!normalized || normalized === "-") return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

/** Formats a value without preventing an empty or in-progress negative edit. */
export function formatPriceInput(
  value: number | string | null | undefined,
  locale: string,
): string {
  if (value == null || value === "") return "";
  if (value === "-") return "-";
  const parsed = parsePriceInput(value, locale);
  if (parsed == null) return "";
  return new Intl.NumberFormat(numberFormatLocale(locale), {
    maximumFractionDigits: 0,
  }).format(parsed);
}

function priceStepAt(value: number): number {
  if (value < 1_000_000) return 50_000;
  if (value <= 5_000_000) return 100_000;
  return 500_000;
}

function roundUp(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function nextRoundTick(value: number): number {
  if (value < 1_000_000) return Math.min(1_000_000, roundUp(value + 1, 50_000));
  if (value < 5_000_000) return Math.min(5_000_000, roundUp(value + 1, 100_000));
  return roundUp(value + 1, 500_000);
}

function densityCutoff(range: CatalogPriceRange): number {
  const buckets = (Array.isArray(range.buckets) ? range.buckets : [])
    .filter((bucket) => Number.isFinite(bucket.count) && bucket.count > 0)
    .map((bucket) => ({
      maxPrice: clamp(Math.round(bucket.maxPrice), range.minPrice, range.maxPrice),
      count: bucket.count,
    }))
    .sort((left, right) => left.maxPrice - right.maxPrice);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  if (!total) return range.maxPrice;

  const target = total * PRICE_DENSITY_CUTOFF;
  let cumulative = 0;
  for (const bucket of buckets) {
    cumulative += bucket.count;
    if (cumulative >= target) return bucket.maxPrice;
  }
  return range.maxPrice;
}

function addRoundTicks(minPrice: number, maxPrice: number): number[] {
  const ticks = [minPrice];
  let next = nextRoundTick(minPrice);
  while (next < maxPrice) {
    if (next > ticks[ticks.length - 1]) ticks.push(next);
    next = nextRoundTick(next);
  }
  if (ticks[ticks.length - 1] !== maxPrice) ticks.push(maxPrice);
  return ticks;
}

function compressTicks(ticks: number[], requiredValues: number[]): number[] {
  if (ticks.length <= PRICE_TICK_LIMIT) return ticks;

  const required = new Set(requiredValues);
  [1_000_000, 5_000_000].forEach((value) => {
    if (ticks.includes(value)) required.add(value);
  });

  let stride = 2;
  while (stride < ticks.length) {
    const reduced = ticks.filter((value, index) => (
      index === 0
      || index === ticks.length - 1
      || index % stride === 0
      || required.has(value)
    ));
    if (reduced.length <= PRICE_TICK_LIMIT) return reduced;
    stride += 1;
  }
  return [ticks[0], ...Array.from(required).filter((value) => value !== ticks[0] && value !== ticks.at(-1)).sort((a, b) => a - b), ticks.at(-1)!].slice(0, PRICE_TICK_LIMIT);
}

/**
 * Builds the visual scale independently from the true API endpoints. The first
 * endpoint stays exact, interior values are round money marks, and a long price
 * tail becomes one open-ended final mark. `extraValues` keeps a typed value
 * visible on the slider even when it is not one of the round marks.
 */
export function buildPriceScale(
  range: CatalogPriceRange,
  extraValues: Array<number | undefined> = [],
): PriceScale {
  if (!Number.isFinite(range.minPrice) || !Number.isFinite(range.maxPrice) || range.minPrice >= range.maxPrice) {
    return { ticks: [], openEndedIndex: null };
  }

  const cutoff = densityCutoff(range);
  const roundedCutoff = clamp(roundUp(cutoff, priceStepAt(cutoff)), range.minPrice, range.maxPrice);
  const hasOpenEndedMax = roundedCutoff < range.maxPrice;
  const cappedMax = hasOpenEndedMax ? roundedCutoff : range.maxPrice;
  const baseTicks = addRoundTicks(range.minPrice, cappedMax);
  const extras = extraValues
    .map((value) => finiteInteger(value))
    .filter((value): value is number => value != null)
    .map((value) => clamp(value, 0, PRICE_PARAM_MAX));
  const merged = [...new Set([...baseTicks, ...extras])].sort((left, right) => left - right);
  const ticks = compressTicks(merged, [range.minPrice, cappedMax, ...extras]);
  const openEndedIndex = hasOpenEndedMax ? ticks.indexOf(cappedMax) : null;

  return {
    ticks,
    openEndedIndex: openEndedIndex != null && openEndedIndex >= 0 ? openEndedIndex : null,
    openEndedValue: hasOpenEndedMax ? cappedMax : undefined,
  };
}

/** Convenience API retained for callers/tests that only need the numeric ticks. */
export function buildPriceTicks(
  range: CatalogPriceRange,
  extraValues: Array<number | undefined> = [],
): number[] {
  return buildPriceScale(range, extraValues).ticks;
}

/**
 * Normalizes URL and typed values without snapping them to a display tick.
 * Missing bounds mean the true context endpoint; explicit values retain their
 * exact integer so the backend can honor a typed value outside the visual scale.
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

export function priceSelectionToTickIndexes(
  range: CatalogPriceRange,
  selection: PriceSelection,
  scale = buildPriceScale(range, [selection.minPrice, selection.maxPrice]),
): [number, number] {
  const ticks = scale.ticks;
  if (ticks.length < 2) return [0, 0];
  const closest = (value: number) => {
    let index = 0;
    let distance = Math.abs(ticks[0] - value);
    ticks.forEach((tick, candidate) => {
      const candidateDistance = Math.abs(tick - value);
      if (candidateDistance < distance) {
        index = candidate;
        distance = candidateDistance;
      }
    });
    return index;
  };
  const indexes = [closest(selection.minPrice), closest(selection.maxPrice)].sort((left, right) => left - right);
  return [indexes[0]!, indexes[1]!];
}

export function tickIndexesToPriceSelection(
  range: CatalogPriceRange,
  indexes: number[],
  scale = buildPriceScale(range),
): PriceSelection {
  const ticks = scale.ticks;
  const last = ticks.length - 1;
  if (last < 1) return { minPrice: range.minPrice, maxPrice: range.maxPrice };
  const minIndex = clamp(Math.round(indexes[0] ?? 0), 0, last);
  const maxIndex = clamp(Math.round(indexes[1] ?? last), 0, last);
  return minIndex <= maxIndex
    ? { minPrice: ticks[minIndex]!, maxPrice: ticks[maxIndex]! }
    : { minPrice: ticks[maxIndex]!, maxPrice: ticks[minIndex]! };
}

export function formatPriceAria(value: number, locale: string): string {
  const formatted = formatPriceInput(Math.max(0, Math.round(value)), locale);
  return locale === "vi" ? `${formatted} đồng` : `${formatted} VND`;
}

export function priceRangeHasSelection(
  range: CatalogPriceRange | null | undefined,
  minPrice?: number,
  maxPrice?: number,
): boolean {
  if (!range || range.minPrice >= range.maxPrice) return false;
  return minPrice != null || maxPrice != null;
}
