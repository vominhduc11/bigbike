"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Clock, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { toCategoryPath } from "@/lib/utils/routes";
import type { PopularCategory } from "./types";
import { SEARCH_PATH, preChip, preChips, preLabel, preLabelRow, sResults } from "./styles";

// Desktop pre-suggestions dropdown (no query yet): recent searches + trending +
// popular categories. Hidden ≤767 (mobile uses MobileSearchBody instead).
export function PreSuggestions({
  recentSearches,
  trendingSearches,
  resolvedCategories,
  runSearch,
  removeSearch,
  clearAll,
  handleClose,
}: {
  recentSearches: string[];
  trendingSearches: string[];
  resolvedCategories: PopularCategory[];
  runSearch: (value?: string) => void;
  removeSearch: (item: string) => void;
  clearAll: () => void;
  handleClose: () => void;
}) {
  const t = useTranslations("Search");
  return (
    <div className={cn(sResults, "max-[767px]:hidden")} aria-label={t("suggestionsLabel")}>
      {recentSearches.length > 0 && (
        <>
          <div className={preLabelRow}>
            <span className={preLabel}>{t("recentLabel")}</span>
            <button type="button" className="cursor-pointer border-none bg-transparent p-0 text-b5-label text-brand-on-dark hover:underline" onClick={clearAll}>
              {t("recentClear")}
            </button>
          </div>
          {recentSearches.slice(0, 5).map((item) => (
            <div key={item} className="flex items-center border-b border-border transition-colors duration-fast last-of-type:border-b-0 hover:bg-card">
              <button
                type="button"
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 border-none bg-transparent py-[9px] pl-4 pr-2 text-left font-body text-b4-action text-foreground hover:text-brand-on-dark focus-visible:text-brand-on-dark focus-visible:outline-none"
                onClick={() => runSearch(item)}
              >
                <Clock size={14} aria-hidden className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{item}</span>
              </button>
              <button
                type="button"
                className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-muted-foreground transition-colors duration-fast hover:text-foreground"
                aria-label={t("removeRecentAria", { item })}
                onClick={() => removeSearch(item)}
              >
                <X size={12} aria-hidden />
              </button>
            </div>
          ))}
        </>
      )}
      <div className={preLabelRow}>
        <span className={preLabel}>{t("trendingHeading")}</span>
      </div>
      <div className={preChips}>
        {trendingSearches.slice(0, 5).map((item) => (
          <button key={item} type="button" className={preChip} onClick={() => runSearch(item)}>
            <Zap size={11} aria-hidden className="text-brand-on-dark" />
            {item}
          </button>
        ))}
      </div>
      <div className={preLabelRow}>
        <span className={preLabel}>{t("popularCategoriesHeading")}</span>
      </div>
      <div className={preChips}>
        {resolvedCategories.map((cat) => (
          <Link
            key={cat.slug || cat.name}
            href={cat.slug ? toCategoryPath(cat.slug) : `${SEARCH_PATH}?s=${encodeURIComponent(cat.name)}`}
            className={preChip}
            onClick={handleClose}
          >
            {cat.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
