"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { CatalogPriceRange } from "@/lib/contracts/public";
import {
  buildPriceScale,
  formatPriceInput,
  formatPriceAria,
  normalizePriceSelection,
  parsePriceInput,
  priceRangeHasSelection,
  priceSelectionToTickIndexes,
  tickIndexesToPriceSelection,
  type NormalizedPriceSelection,
} from "@/lib/utils/catalog-price-filter";

type CatalogPriceFilterProps = {
  range: CatalogPriceRange;
  currentMinPrice?: number;
  currentMaxPrice?: number;
  queryHref: (override: Record<string, string | string[] | number | undefined>) => string;
  onCommit?: (minPrice: number | undefined, maxPrice: number | undefined) => void;
};

function countDigitsBeforeCaret(value: string, caret: number | null): number {
  return (value.slice(0, caret ?? value.length).match(/\d/g) ?? []).length;
}

function updateInputWhileTyping(
  event: ChangeEvent<HTMLInputElement>,
  setValue: (value: string) => void,
) {
  const target = event.currentTarget;
  const rawValue = target.value;
  const selectionStart = target.selectionStart;
  const selectionEnd = target.selectionEnd;
  const digitsBeforeCaret = countDigitsBeforeCaret(rawValue, selectionStart);
  const nextValue = rawValue.replace(/\D/g, "");
  const nextCaret = selectionStart === selectionEnd
    ? Math.min(digitsBeforeCaret, nextValue.length)
    : nextValue.length;

  setValue(nextValue);
  queueMicrotask(() => {
    if (document.activeElement === target) target.setSelectionRange(nextCaret, nextCaret);
  });
}

function formatInputOnBlur(
  value: string,
  locale: string,
  setValue: (value: string) => void,
) {
  setValue(formatPriceInput(value, locale));
}

function inputValue(value: number | undefined, locale: string): string {
  return value == null ? "" : formatPriceInput(value, locale);
}

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
  const committedSelection = useMemo(
    () => normalizePriceSelection(range, currentMinPrice, currentMaxPrice)
      ?? { minPrice: range.minPrice, maxPrice: range.maxPrice },
    [currentMaxPrice, currentMinPrice, range],
  );
  const scale = useMemo(
    () => buildPriceScale(range, [currentMinPrice, currentMaxPrice]),
    [currentMaxPrice, currentMinPrice, range],
  );
  const committedSliderValues = useMemo(
    () => priceSelectionToTickIndexes(range, committedSelection, scale),
    [committedSelection, range, scale],
  );
  const [sliderValues, setSliderValues] = useState<[number, number]>(() => committedSliderValues);
  const [inputMin, setInputMin] = useState(() => inputValue(currentMinPrice, locale));
  const [inputMax, setInputMax] = useState(() => inputValue(currentMaxPrice, locale));
  const minInputRef = useRef<HTMLInputElement>(null);
  const maxInputRef = useRef<HTMLInputElement>(null);
  const propsKey = useMemo(
    () => [
      range.minPrice,
      range.maxPrice,
      JSON.stringify(range.buckets ?? []),
      currentMinPrice ?? "",
      currentMaxPrice ?? "",
      locale,
    ].join("|"),
    [currentMaxPrice, currentMinPrice, locale, range.buckets, range.maxPrice, range.minPrice],
  );
  const previousPropsKey = useRef(propsKey);

  useEffect(() => {
    if (previousPropsKey.current === propsKey) return;
    previousPropsKey.current = propsKey;
    setSliderValues(committedSliderValues);
    if (document.activeElement !== minInputRef.current) setInputMin(inputValue(currentMinPrice, locale));
    if (document.activeElement !== maxInputRef.current) setInputMax(inputValue(currentMaxPrice, locale));
  }, [committedSliderValues, currentMaxPrice, currentMinPrice, locale, propsKey]);

  const syncInputs = useCallback((selection: NormalizedPriceSelection) => {
    if (document.activeElement !== minInputRef.current) setInputMin(inputValue(selection.queryMinPrice, locale));
    if (document.activeElement !== maxInputRef.current) setInputMax(inputValue(selection.queryMaxPrice, locale));
  }, [locale]);

  const commitSelection = useCallback((
    rawMin: number | string | null | undefined,
    rawMax: number | string | null | undefined,
  ) => {
    const normalized = normalizePriceSelection(range, rawMin, rawMax);
    if (!normalized) return;
    const nextScale = buildPriceScale(range, [normalized.minPrice, normalized.maxPrice]);
    setSliderValues(priceSelectionToTickIndexes(range, normalized, nextScale));
    syncInputs(normalized);
    if (onCommit) {
      onCommit(normalized.queryMinPrice, normalized.queryMaxPrice);
    } else {
      router.push(queryHref({
        min_price: normalized.queryMinPrice,
        max_price: normalized.queryMaxPrice,
      }));
    }
  }, [onCommit, queryHref, range, router, syncInputs]);

  const applyTypedInputs = useCallback(() => {
    commitSelection(
      parsePriceInput(inputMin, locale),
      parsePriceInput(inputMax, locale),
    );
  }, [commitSelection, inputMax, inputMin, locale]);

  const ticks = scale.ticks;
  if (ticks.length < 2) return null;

  const hasSelection = priceRangeHasSelection(range, currentMinPrice, currentMaxPrice);
  const lastTickIndex = ticks.length - 1;
  const minIndex = Math.min(lastTickIndex, Math.max(0, sliderValues[0] ?? 0));
  const maxIndex = Math.min(lastTickIndex, Math.max(0, sliderValues[1] ?? lastTickIndex));
  const minTick = ticks[minIndex] ?? ticks[0] ?? range.minPrice;
  const maxTick = ticks[maxIndex] ?? ticks[lastTickIndex] ?? range.maxPrice;
  const liveSelection = minIndex !== committedSliderValues[0] || maxIndex !== committedSliderValues[1];
  const activeSlider = hasSelection || liveSelection;
  const thumbsAreClose = Math.abs(maxIndex - minIndex) / Math.max(1, lastTickIndex) <= 0.16;
  const maxIsOpenEnded = scale.openEndedIndex === maxIndex && currentMaxPrice == null;
  const minLabel = formatPriceInput(minTick, locale);
  const maxLabel = `${formatPriceInput(maxTick, locale)}${maxIsOpenEnded ? ` ${t("priceAndAbove")}` : ""}`;
  const thumbLabelPosition = (index: number) => {
    if (index === 0) return "translate-x-0";
    if (index === lastTickIndex) return "-translate-x-full";
    return "-translate-x-1/2";
  };
  const thumbAriaText = (value: number, openEnded: boolean) => (
    `${formatPriceAria(value, locale)}${openEnded ? ` ${t("priceAndAbove")}` : ""}`
  );
  const thumbProps = [
    {
      "aria-label": t("priceMinAria"),
      "aria-valuemin": ticks[0],
      "aria-valuemax": ticks[lastTickIndex],
      "aria-valuenow": minTick,
      "aria-valuetext": thumbAriaText(minTick, false),
    },
    {
      "aria-label": t("priceMaxAria"),
      "aria-valuemin": ticks[0],
      "aria-valuemax": ticks[lastTickIndex],
      "aria-valuenow": maxTick,
      "aria-valuetext": thumbAriaText(maxTick, maxIsOpenEnded),
    },
  ];

  /** Enter is an explicit action; moving focus between boxes is not. */
  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setInputMin(inputValue(currentMinPrice, locale));
      setInputMax(inputValue(currentMaxPrice, locale));
      event.currentTarget.blur();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyTypedInputs();
    event.currentTarget.blur();
  };

  return (
    <div
      className="space-y-4"
      data-price-filter="true"
      data-price-filter-active={activeSlider ? "true" : "false"}
      data-price-scale-open-ended={scale.openEndedIndex == null ? "false" : "true"}
      role="group"
      aria-label={t("priceRangeAria")}
    >
      <div className="relative h-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-12" aria-hidden="true">
          <span
            className={cn("absolute top-0 whitespace-nowrap text-a5-meta text-foreground", thumbLabelPosition(minIndex))}
            data-price-thumb-label="min"
            style={{ left: `${(minIndex / lastTickIndex) * 100}%` }}
          >
            {minLabel}
          </span>
          <span
            className={cn(
              "absolute whitespace-nowrap text-a5-meta text-foreground",
              thumbsAreClose ? "top-6" : "top-0",
              thumbLabelPosition(maxIndex),
            )}
            data-price-thumb-label="max"
            style={{ left: `${(maxIndex / lastTickIndex) * 100}%` }}
          >
            {maxLabel}
          </span>
        </div>

        <Slider
          min={0}
          max={lastTickIndex}
          step={1}
          value={[minIndex, maxIndex]}
          thumbCount={2}
          thumbProps={thumbProps}
          trackClassName="bg-border-default"
          rangeClassName={activeSlider ? "bg-brand" : "bg-transparent"}
          aria-label={t("priceRangeAria")}
          className="relative z-10 h-11"
          onValueChange={(values) => setSliderValues([values[0] ?? 0, values[1] ?? lastTickIndex])}
          onValueCommit={(values) => {
            const indexes = [values[0] ?? 0, values[1] ?? lastTickIndex];
            const selection = tickIndexesToPriceSelection(range, indexes, scale);
            const openEndedMax = scale.openEndedIndex === Math.max(...indexes);
            commitSelection(selection.minPrice, openEndedMax ? undefined : selection.maxPrice);
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-a5-meta text-muted-foreground">
        <span>{formatPriceInput(range.minPrice, locale)}</span>
        <span>{formatPriceInput(range.maxPrice, locale)}</span>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-3">
        <label className="min-w-0 space-y-1">
          <span className="font-body text-a5-meta text-muted-foreground">{t("priceFrom")}</span>
          <Input
            ref={minInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={inputMin}
            placeholder={formatPriceInput(range.minPrice, locale)}
            data-price-input="min"
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => updateInputWhileTyping(event, setInputMin)}
            onBlur={() => formatInputOnBlur(inputMin, locale, setInputMin)}
            onKeyDown={handleInputKeyDown}
            aria-label={t("priceFrom")}
          />
        </label>
        <label className="min-w-0 space-y-1">
          <span className="font-body text-a5-meta text-muted-foreground">{t("priceTo")}</span>
          <Input
            ref={maxInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={inputMax}
            placeholder={formatPriceInput(range.maxPrice, locale)}
            data-price-input="max"
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => updateInputWhileTyping(event, setInputMax)}
            onBlur={() => formatInputOnBlur(inputMax, locale, setInputMax)}
            onKeyDown={handleInputKeyDown}
            aria-label={t("priceTo")}
          />
        </label>
      </div>

      <p className="font-body text-a5-meta text-muted-foreground" data-price-range-hint="true">
        {t("priceRangeHint", {
          min: formatPriceInput(range.minPrice, locale),
          max: formatPriceInput(range.maxPrice, locale),
        })}
      </p>

      <Button
        type="button"
        variant="primary"
        size="sm"
        className="min-h-11 w-full rounded-none font-body normal-case tracking-normal"
        data-price-apply="true"
        onClick={applyTypedInputs}
      >
        {t("applyPrice")}
      </Button>
    </div>
  );
}
