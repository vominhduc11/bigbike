"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Slider } from "@/components/ui/slider";
import type { CatalogPriceRange } from "@/lib/contracts/public";
import {
  buildPriceScale,
  formatPriceAria,
  formatPriceDisplay,
  PRICE_TRACK_STEPS,
  priceRangeHasSelection,
  priceSelectionToQueryBounds,
  priceSelectionToSliderValues,
  sliderValuesToPriceSelection,
  snapPriceSelection,
} from "@/lib/utils/catalog-price-filter";

type CatalogPriceFilterProps = {
  range: CatalogPriceRange;
  currentMinPrice?: number;
  currentMaxPrice?: number;
  queryHref: (override: Record<string, string | string[] | number | undefined>) => string;
  onCommit?: (minPrice: number | undefined, maxPrice: number | undefined) => void;
};

export function CatalogPriceFilter({
  range,
  currentMinPrice,
  currentMaxPrice,
  queryHref,
  onCommit,
}: CatalogPriceFilterProps) {
  const t = useTranslations("Catalog");
  const locale = useLocale();
  const router = useRouter();
  const scale = useMemo(() => buildPriceScale(range), [range]);
  const committedSelection = useMemo(
    () => ({
      minPrice: currentMinPrice ?? scale.minPrice,
      maxPrice: currentMaxPrice ?? scale.maxPrice,
    }),
    [currentMaxPrice, currentMinPrice, scale.maxPrice, scale.minPrice],
  );
  const committedSliderValues = useMemo(
    () => priceSelectionToSliderValues(committedSelection, scale),
    [committedSelection, scale],
  );
  const [sliderValues, setSliderValues] = useState<[number, number]>(() => committedSliderValues);
  const propsKey = useMemo(
    () => [
      range.minPrice,
      range.maxPrice,
      JSON.stringify(range.buckets ?? []),
      currentMinPrice ?? "",
      currentMaxPrice ?? "",
    ].join("|"),
    [currentMaxPrice, currentMinPrice, range.buckets, range.maxPrice, range.minPrice],
  );
  const previousPropsKey = useRef(propsKey);

  useEffect(() => {
    if (previousPropsKey.current === propsKey) return;
    previousPropsKey.current = propsKey;
    setSliderValues(committedSliderValues);
  }, [committedSliderValues, propsKey]);

  const minPosition = Math.min(PRICE_TRACK_STEPS, Math.max(0, sliderValues[0] ?? 0));
  const maxPosition = Math.min(PRICE_TRACK_STEPS, Math.max(0, sliderValues[1] ?? PRICE_TRACK_STEPS));
  const liveSelection = sliderValuesToPriceSelection([minPosition, maxPosition], scale);
  const liveMinPrice = Math.round(liveSelection.minPrice);
  const liveMaxPrice = Math.round(liveSelection.maxPrice);
  const hasSelection = priceRangeHasSelection(range, currentMinPrice, currentMaxPrice);
  const isLiveSelection = minPosition !== committedSliderValues[0] || maxPosition !== committedSliderValues[1];
  const activeSlider = hasSelection || isLiveSelection;
  const thumbProps = [
    {
      "aria-label": t("priceMinAria"),
      "aria-valuemin": scale.minPrice,
      "aria-valuemax": scale.maxPrice,
      "aria-valuenow": liveMinPrice,
      "aria-valuetext": formatPriceAria(liveMinPrice, locale),
    },
    {
      "aria-label": t("priceMaxAria"),
      "aria-valuemin": scale.minPrice,
      "aria-valuemax": scale.maxPrice,
      "aria-valuenow": liveMaxPrice,
      "aria-valuetext": formatPriceAria(liveMaxPrice, locale),
    },
  ];

  function commitSliderValues(values: number[]) {
    const snappedSelection = snapPriceSelection(sliderValuesToPriceSelection(values, scale), scale);
    const nextSliderValues = priceSelectionToSliderValues(snappedSelection, scale);
    const queryBounds = priceSelectionToQueryBounds(snappedSelection, scale);
    setSliderValues(nextSliderValues);

    if (onCommit) {
      onCommit(queryBounds.minPrice, queryBounds.maxPrice);
      return;
    }

    router.push(queryHref({
      min_price: queryBounds.minPrice,
      max_price: queryBounds.maxPrice,
    }));
  }

  if (scale.minPrice >= scale.maxPrice) return null;

  return (
    <div
      className="space-y-2"
      data-price-filter="true"
      data-price-filter-active={activeSlider ? "true" : "false"}
      data-price-scale-density={scale.usesDensity ? "true" : "false"}
      role="group"
      aria-label={t("priceRangeAria")}
    >
      <div className="flex items-center justify-between gap-3 whitespace-nowrap font-body text-a5-meta text-foreground" data-price-range-label="true">
        <span>{formatPriceDisplay(liveMinPrice, locale)}</span>
        <span aria-hidden className="shrink-0 text-muted-foreground">–</span>
        <span className="text-right">{formatPriceDisplay(liveMaxPrice, locale)}</span>
      </div>

      <Slider
        min={0}
        max={PRICE_TRACK_STEPS}
        step={1}
        value={[minPosition, maxPosition]}
        thumbCount={2}
        thumbProps={thumbProps}
        trackClassName="bg-border-default"
        rangeClassName="bg-brand"
        aria-label={t("priceRangeAria")}
        className="relative z-10 h-11"
        onValueChange={(values) => setSliderValues([values[0] ?? 0, values[1] ?? PRICE_TRACK_STEPS])}
        onValueCommit={commitSliderValues}
      />
    </div>
  );
}
