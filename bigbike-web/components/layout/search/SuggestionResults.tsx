"use client";

import Link from "@/i18n/StorefrontLink";
import { useTranslations } from "next-intl";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { formatVnd, resolveMediaUrl } from "@/lib/utils/format";
import type { ArticleSuggestion, SearchSuggestion } from "./types";
import { SEARCH_PATH, resultItem, resultsLabel, sResults } from "./styles";

// Desktop live results listbox (query ≥1 char, settled): product + article hits,
// with a sticky "view all" footer. Mounted into the same overlay panel.
export function SuggestionResults({
  suggestions,
  articleSuggestions,
  trimmedQuery,
  addSearch,
  handleClose,
}: {
  suggestions: SearchSuggestion[];
  articleSuggestions: ArticleSuggestion[];
  trimmedQuery: string;
  addSearch: (item: string) => void;
  handleClose: () => void;
}) {
  const t = useTranslations("Search");
  return (
    <div
      id="bb-search-suggestions"
      className={sResults}
      role="listbox"
      aria-label={t("suggestionsLabel")}
    >
      {suggestions.length > 0 || articleSuggestions.length > 0 ? (
        <>
          {/* Scrollable results list — always shows at most max-height of outer container */}
          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto md:[-webkit-overflow-scrolling:touch]">
            {suggestions.length > 0 && (
              <p className={resultsLabel}>{t("sectionProducts")}</p>
            )}
            {suggestions.slice(0, 5).map((product) => (
              <LocalizedLink
                key={product.id}
                kind="product"
                viSlug={product.slug}
                enSlug={product.slugEn}
                className={resultItem}
                role="option"
                aria-selected={false}
                onClick={() => { addSearch(trimmedQuery); handleClose(); }}
              >
                {resolveMediaUrl(product.image?.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveMediaUrl(product.image?.url)!}
                    alt={product.name}
                    className="h-12 w-12 shrink-0 object-contain"
                    width={48}
                    height={48}
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 object-contain" aria-hidden />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-a5-meta font-medium text-foreground">{product.name}</span>
                  <span className="text-a5-meta font-bold text-brand-on-dark">
                    {formatVnd(product.price?.salePrice ?? product.price?.retailPrice)}
                  </span>
                </div>
              </LocalizedLink>
            ))}
            {articleSuggestions.length > 0 && (
              <>
                <p className={resultsLabel}>{t("sectionArticles")}</p>
                {articleSuggestions.slice(0, 3).map((article) => (
                  <LocalizedLink
                    key={article.id}
                    kind="article"
                    viSlug={article.slug}
                    enSlug={article.slugEn}
                    className={resultItem}
                    role="option"
                    aria-selected={false}
                    onClick={handleClose}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-a5-meta font-normal text-foreground line-clamp-2">{article.title}</span>
                      {article.category?.name && (
                        <span className="font-cta text-b5-label font-semibold uppercase tracking-normal text-brand-on-dark">
                          {article.category.name}
                        </span>
                      )}
                    </div>
                  </LocalizedLink>
                ))}
              </>
            )}
          </div>
          {/* "View all" always visible at bottom, never scrolls away */}
          <Link
            href={`${SEARCH_PATH}?s=${encodeURIComponent(trimmedQuery)}`}
            className="md:flex-none flex items-center justify-center px-4 py-[13px] font-cta text-b4-action font-semibold uppercase tracking-normal text-brand-on-dark no-underline transition-colors duration-fast hover:bg-card focus-visible:bg-card focus-visible:outline-none [border-top:1px_solid_var(--bb-color-border)]"
            onClick={handleClose}
          >
            {t("viewAllResultsBtn", { query: trimmedQuery })}
          </Link>
        </>
      ) : (
        <div className="px-4 py-5 text-center text-a5-meta text-muted-foreground">
          <p className="m-0 mb-2">{t("noMatchText", { query: trimmedQuery })}</p>
          <Link
            href={`${SEARCH_PATH}?s=${encodeURIComponent(trimmedQuery)}`}
            className="font-semibold text-brand-on-dark no-underline"
            onClick={handleClose}
          >
            {t("noMatchBrowse")}
          </Link>
        </div>
      )}
    </div>
  );
}
