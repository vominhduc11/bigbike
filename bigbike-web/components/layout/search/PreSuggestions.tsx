"use client";

import Link from "@/i18n/StorefrontLink";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Clock, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchShortcuts } from "./types";
import {
  preChips,
  preChip,
  preContent,
  preLabel,
  preLabelRow,
  preRemove,
  preSection,
  resultItem,
  sResults,
} from "./styles";
import { SearchKeyboardHints } from "./SearchKeyboardHints";
import { SearchProductRowContent } from "./SearchProductRowContent";

const MAX_RECENT_SEARCHES = 5;
const MAX_BRANDS = 5;
const MAX_SUGGESTED_PRODUCTS = 3;

// Empty-query search panel. The same semantic tree is used on desktop and mobile;
// only spacing and the panel shell change at the responsive breakpoint.
export function PreSuggestions({
  recentSearches,
  shortcuts,
  runSearch,
  removeSearch,
  clearAll,
  handleClose,
  activeIndex,
}: {
  recentSearches: string[];
  shortcuts: SearchShortcuts;
  runSearch: (value?: string) => void;
  removeSearch: (item: string) => void;
  clearAll: () => void;
  handleClose: () => void;
  activeIndex: number;
}) {
  const t = useTranslations("Search");
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const visibleRecentSearches = recentSearches.slice(0, MAX_RECENT_SEARCHES);
  const visibleBrands = shortcuts.trendingBrands.slice(0, MAX_BRANDS);
  const visibleProducts = shortcuts.suggestedProducts.slice(0, MAX_SUGGESTED_PRODUCTS);
  const productsStartIndex = visibleRecentSearches.length + visibleBrands.length;

  function confirmClearAll() {
    clearAll();
    setIsConfirmingClear(false);
  }

  return (
    <div
      id="bb-search-suggestions"
      className={sResults}
      role="listbox"
      aria-label={t("suggestionsLabel")}
    >
      <div className={preContent} data-search-scroll-region>
        {visibleRecentSearches.length > 0 && (
          <section className={preSection} data-search-section="recent">
            <div className={preLabelRow}>
              <span className={preLabel}>{t("recentLabel")}</span>
              {!isConfirmingClear ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center border-none bg-transparent px-2 font-cta text-b5-label font-semibold uppercase text-muted-foreground hover:text-brand-on-dark focus-visible:text-brand-on-dark focus-visible:outline-none"
                  onClick={() => setIsConfirmingClear(true)}
                >
                  {t("recentClear")}
                </button>
              ) : null}
            </div>
            {isConfirmingClear ? (
              <div
                className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2 text-a5-meta text-foreground max-md:px-0 max-md:pt-0"
                role="group"
                aria-live="polite"
              >
                <span className="mr-auto">{t("clearRecentConfirm")}</span>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center border-none bg-transparent px-2 font-cta text-b5-label font-semibold uppercase text-brand-on-dark hover:underline focus-visible:outline-none"
                  onClick={confirmClearAll}
                >
                  {t("confirmClearRecent")}
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center border border-border bg-background px-2 font-cta text-b5-label font-semibold uppercase text-foreground hover:border-brand-on-dark hover:text-brand-on-dark focus-visible:outline-none"
                  onClick={() => setIsConfirmingClear(false)}
                >
                  {t("cancelClearRecent")}
                </button>
              </div>
            ) : null}
            <div>
              {visibleRecentSearches.map((item, index) => (
                <div
                  key={item}
                  className="flex items-center border-b border-border last:border-b-0"
                >
                  <button
                    type="button"
                    id={`bb-search-option-${index}`}
                    role="option"
                    aria-selected={activeIndex === index}
                    className={cn(
                      "flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 border-none bg-transparent px-4 text-left font-body text-a4-content text-foreground hover:bg-card hover:text-brand-on-dark focus-visible:bg-card focus-visible:text-brand-on-dark focus-visible:outline-none max-md:px-0",
                      activeIndex === index && "bg-card text-brand-on-dark",
                    )}
                    onClick={() => runSearch(item)}
                  >
                    <Clock size={16} aria-hidden className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{item}</span>
                  </button>
                  <button
                    type="button"
                    className={preRemove}
                    aria-label={t("removeRecentAria", { item })}
                    onClick={() => removeSearch(item)}
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {visibleBrands.length > 0 && (
          <section className={preSection} data-search-section="brands">
            <div className={preLabelRow}>
              <span className={preLabel}>{t("trendingHeading")}</span>
            </div>
            <div className={preChips}>
              {visibleBrands.map((item, index) => {
                const optionIndex = visibleRecentSearches.length + index;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    id={`bb-search-option-${optionIndex}`}
                    role="option"
                    aria-selected={activeIndex === optionIndex}
                    className={cn(
                      preChip,
                      activeIndex === optionIndex && "border-brand-on-dark text-brand-on-dark",
                    )}
                    onClick={handleClose}
                  >
                    <Zap size={13} aria-hidden className="text-brand-on-dark" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {visibleProducts.length > 0 && (
          <section className={preSection} data-search-section="products">
            <div className={preLabelRow}>
              <span className={preLabel}>{t("suggestedProductsHeading")}</span>
            </div>
            <div>
              {visibleProducts.map((item, index) => {
                const optionIndex = productsStartIndex + index;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    id={`bb-search-option-${optionIndex}`}
                    role="option"
                    aria-selected={activeIndex === optionIndex}
                    className={cn(resultItem, activeIndex === optionIndex && "bg-card")}
                    onClick={handleClose}
                  >
                    <SearchProductRowContent
                      name={item.name}
                      price={item.price}
                      image={item.image}
                    />
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
      <SearchKeyboardHints />
    </div>
  );
}
