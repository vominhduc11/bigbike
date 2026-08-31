"use client";

import Link from "@/i18n/StorefrontLink";
import { useTranslations } from "next-intl";
import { Clock, Search, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchShortcuts } from "./types";
import {
  mBody,
  mChip,
  mGridCard,
  mLabel,
  mList,
  mListBtn,
  mRecentRemove,
  mSection,
} from "./styles";

// Mobile (≤767) full-screen search body: recent searches and inventory-backed
// brand, product, and category shortcuts. Shown when there are no live suggestions.
export function MobileSearchBody({
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
  return (
    <div className={mBody}>
      {recentSearches.length > 0 ? (
        <section className={mSection}>
          <div className="mb-1 flex items-center justify-between">
            <p className="m-0">{t("recentLabel")}</p>
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent px-0 py-1 font-cta text-b4-action uppercase text-brand-on-dark"
              onClick={clearAll}
            >
              {t("recentClear")}
            </button>
          </div>
          <div className={mList}>
            {recentSearches.map((item) => (
              <div key={item} className="flex items-center border-b border-border">
                <button
                  type="button"
                  className={cn(mListBtn, "flex-1 border-b-0")}
                  onClick={() => runSearch(item)}
                >
                  <Clock size={16} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item}</span>
                </button>
                <button
                  type="button"
                  className={cn(mRecentRemove, "border-b-0")}
                  aria-label={t("removeRecentAria", { item })}
                  onClick={() => removeSearch(item)}
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {shortcuts.trendingBrands.length > 0 && (
        <section className={mSection}>
          <p className={mLabel}>{t("trendingHeading")}</p>
          <div className="flex flex-wrap gap-2">
            {shortcuts.trendingBrands.map((item) => (
              <Link key={item.id} href={item.href} className={mChip} onClick={handleClose}>
                <Zap size={13} aria-hidden />
                {item.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {shortcuts.suggestedProducts.length > 0 && (
        <section className={mSection}>
          <p className={mLabel}>{t("suggestedProductsHeading")}</p>
          <div className={mList}>
            {shortcuts.suggestedProducts.map((item) => (
              <Link key={item.id} href={item.href} className={mListBtn} onClick={handleClose}>
                <Search size={16} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {shortcuts.popularCategories.length > 0 && (
        <section className={mSection}>
          <p className={mLabel}>{t("popularCategoriesHeading")}</p>
          <div className="grid grid-cols-2 gap-2">
            {shortcuts.popularCategories.map((item) => (
              <Link key={item.id} href={item.href} className={mGridCard} onClick={handleClose}>
                <span className="font-cta text-b5-label font-semibold uppercase">{item.name}</span>
                <small className="font-cta text-b5-label uppercase tracking-normal text-muted-foreground">
                  {t("categoryProductCount", { count: item.count ?? 0 })}
                </small>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
