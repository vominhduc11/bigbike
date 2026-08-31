"use client";

import Link from "@/i18n/StorefrontLink";
import { useTranslations } from "next-intl";
import { Clock, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchShortcuts } from "./types";
import { preChip, preChips, preLabel, preLabelRow, sResults } from "./styles";

// Desktop pre-suggestions dropdown (no query yet): recent searches plus shortcuts
// generated from published inventory. Hidden ≤767 (mobile uses MobileSearchBody instead).
export function PreSuggestions({
  recentSearches,
  shortcuts,
  runSearch,
  removeSearch,
  clearAll,
  handleClose,
}: {
  recentSearches: string[];
  shortcuts: SearchShortcuts;
  runSearch: (value?: string) => void;
  removeSearch: (item: string) => void;
  clearAll: () => void;
  handleClose: () => void;
}) {
  const t = useTranslations("Search");
  const shortcutGroups = [
    { label: t("trendingHeading"), items: shortcuts.trendingBrands, icon: true },
    { label: t("suggestedProductsHeading"), items: shortcuts.suggestedProducts, icon: false },
    { label: t("popularCategoriesHeading"), items: shortcuts.popularCategories, icon: false },
  ];

  return (
    <div className={cn(sResults, "max-[767px]:hidden")} aria-label={t("suggestionsLabel")}>
      {recentSearches.length > 0 && (
        <>
          <div className={preLabelRow}>
            <span className={preLabel}>{t("recentLabel")}</span>
            <button type="button" className="cursor-pointer border-none bg-transparent p-0 font-cta text-b4-action uppercase text-brand-on-dark hover:underline" onClick={clearAll}>
              {t("recentClear")}
            </button>
          </div>
          {recentSearches.slice(0, 5).map((item) => (
            <div key={item} className="flex items-center border-b border-border transition-colors duration-fast last-of-type:border-b-0 hover:bg-card">
              <button
                type="button"
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 border-none bg-transparent py-[9px] pl-4 pr-2 text-left font-cta text-b4-action uppercase text-foreground hover:text-brand-on-dark focus-visible:text-brand-on-dark focus-visible:outline-none"
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
      {shortcutGroups.map((group) => group.items.length > 0 && (
        <div key={group.label}>
          <div className={preLabelRow}>
            <span className={preLabel}>{group.label}</span>
          </div>
          <div className={preChips}>
            {group.items.map((item) => (
              <Link key={item.id} href={item.href} className={preChip} onClick={handleClose}>
                {group.icon && <Zap size={11} aria-hidden className="text-brand-on-dark" />}
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
