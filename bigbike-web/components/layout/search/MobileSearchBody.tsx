"use client";

import Link from "@/i18n/StorefrontLink";
import { useLocale, useTranslations } from "next-intl";
import { Clock, Search, X, Zap } from "lucide-react";
import { toCategoryPath, toSearchPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import type { PopularCategory } from "./types";
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

// Mobile (≤767) full-screen search body: recent OR quick searches, trending
// chips, popular category grid. Shown when there are no live suggestions.
export function MobileSearchBody({
  recentSearches,
  quickSearches,
  trendingSearches,
  resolvedCategories,
  runSearch,
  removeSearch,
  clearAll,
  handleClose,
}: {
  recentSearches: string[];
  quickSearches: string[];
  trendingSearches: string[];
  resolvedCategories: PopularCategory[];
  runSearch: (value?: string) => void;
  removeSearch: (item: string) => void;
  clearAll: () => void;
  handleClose: () => void;
}) {
  const t = useTranslations("Search");
  const locale = useLocale() as Locale;
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
              <div
                key={item}
                role="button"
                tabIndex={0}
                className="flex w-full items-center gap-3 text-left"
                onClick={() => runSearch(item)}
                onKeyDown={(e) => e.key === "Enter" && runSearch(item)}
              >
                <Clock size={16} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item}</span>
                <button
                  type="button"
                  className={mRecentRemove}
                  aria-label={t("removeRecentAria", { item })}
                  onClick={(e) => { e.stopPropagation(); removeSearch(item); }}
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className={mSection}>
          <p className={mLabel}>{t("quickSearchesHeading")}</p>
          <div className={mList}>
            {quickSearches.map((item) => (
              <button key={item} type="button" className={mListBtn} onClick={() => runSearch(item)}>
                <Search size={16} aria-hidden />
                <span>{item}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={mSection}>
        <p className={mLabel}>{t("trendingHeading")}</p>
        <div className="flex flex-wrap gap-2">
          {trendingSearches.map((item) => (
            <button key={item} type="button" className={mChip} onClick={() => runSearch(item)}>
              <Zap size={13} aria-hidden />
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className={mSection}>
        <p className={mLabel}>{t("popularCategoriesHeading")}</p>
        <div className="grid grid-cols-2 gap-2">
          {resolvedCategories.map((cat) => (
            <Link
              key={cat.slug || cat.name}
              href={cat.slug ? toCategoryPath(cat.slug, locale) : `${toSearchPath(locale)}?s=${encodeURIComponent(cat.name)}`}
              className={mGridCard}
              onClick={handleClose}
            >
              <span className="font-cta text-b5-label font-semibold uppercase">{cat.name}</span>
              <small className="font-cta text-b5-label uppercase tracking-normal text-muted-foreground">BIGBIKE</small>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
