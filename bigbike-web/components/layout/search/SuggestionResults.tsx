"use client";

import Link from "@/i18n/StorefrontLink";
import { useLocale, useTranslations } from "next-intl";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { toSearchPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import type { ArticleSuggestion, SearchSuggestion } from "./types";
import { resultItem, resultsLabel, sResults } from "./styles";
import { SearchKeyboardHints } from "./SearchKeyboardHints";
import { SearchProductRowContent } from "./SearchProductRowContent";

// Desktop live results listbox (query ≥1 char, settled): product + article hits,
// with a sticky "view all" footer. Mounted into the same overlay panel.
export function SuggestionResults({
  suggestions,
  articleSuggestions,
  trimmedQuery,
  addSearch,
  handleClose,
  activeIndex,
}: {
  suggestions: SearchSuggestion[];
  articleSuggestions: ArticleSuggestion[];
  trimmedQuery: string;
  addSearch: (item: string) => void;
  handleClose: () => void;
  activeIndex: number;
}) {
  const t = useTranslations("Search");
  const locale = useLocale() as Locale;
  const visibleArticles = articleSuggestions.slice(0, 3);
  // The desktop dropdown is height-capped, so 5 product rows plus two section headings pushed the
  // "Bài viết" group below the fold — the customer saw the heading but no articles. Give the
  // article group room by showing one product less whenever there is an article to show.
  const visibleProducts = suggestions.slice(0, visibleArticles.length > 0 ? 4 : 5);
  const searchHref = `${toSearchPath(locale)}?s=${encodeURIComponent(trimmedQuery)}`;
  return (
    <div
      id="bb-search-suggestions"
      className={sResults}
      role="listbox"
      aria-label={t("suggestionsLabel")}
    >
      {visibleProducts.length > 0 || visibleArticles.length > 0 ? (
        <>
          {/* Scrollable results list — always shows at most max-height of outer container */}
          <div className="md:min-h-0 md:flex-1 md:overflow-y-auto md:[-webkit-overflow-scrolling:touch]">
            {visibleProducts.length > 0 && <p className={resultsLabel}>{t("sectionProducts")}</p>}
            {visibleProducts.map((product, index) => (
              <LocalizedLink
                key={product.id}
                kind="product"
                viSlug={product.slug}
                enSlug={product.slugEn}
                id={`bb-search-option-${index}`}
                className={resultItem}
                role="option"
                aria-selected={activeIndex === index}
                onClick={() => {
                  addSearch(trimmedQuery);
                  handleClose();
                }}
              >
                <SearchProductRowContent
                  name={product.name}
                  price={product.price}
                  image={product.image}
                />
              </LocalizedLink>
            ))}
            {visibleArticles.length > 0 && (
              <>
                <p className={resultsLabel}>{t("sectionArticles")}</p>
                {visibleArticles.map((article, index) => (
                  <LocalizedLink
                    key={article.id}
                    kind="article"
                    viSlug={article.slug}
                    enSlug={article.slugEn}
                    id={`bb-search-option-${visibleProducts.length + index}`}
                    className={resultItem}
                    role="option"
                    aria-selected={activeIndex === visibleProducts.length + index}
                    onClick={() => {
                      addSearch(trimmedQuery);
                      handleClose();
                    }}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-a5-meta font-normal text-foreground line-clamp-2">
                        {article.title}
                      </span>
                    </div>
                  </LocalizedLink>
                ))}
              </>
            )}
          </div>
          {/* "View all" and keyboard help stay visible at the bottom. */}
          <div className="md:flex-none [border-top:1px_solid_var(--bb-color-border)]">
            <Link
              href={searchHref}
              className="flex items-center justify-center px-4 py-2 font-cta text-b4-action font-semibold uppercase tracking-normal text-brand-on-dark no-underline transition-colors duration-fast hover:bg-card focus-visible:bg-card focus-visible:outline-none"
              onClick={handleClose}
            >
              {t("viewAllResultsBtn", { query: trimmedQuery })}
            </Link>
            {/* Không lặp đường dẫn: nút "xem tất cả kết quả" ngay trên đã trỏ đúng chỗ, nên
                thanh dưới chỉ còn phần nhắc phím (và tự ẩn trên điện thoại). */}
            <SearchKeyboardHints />
          </div>
        </>
      ) : (
        <>
          <div className="px-4 py-5 text-center text-a5-meta text-muted-foreground">
            <p className="m-0 mb-2">{t("noMatchText", { query: trimmedQuery })}</p>
            {/* One way out, not two: this used to sit a line above an identical footer link to the
                same href (owner decision 2026-09-07). The contextual one is kept because it stays
                visible on phones, where the keyboard-hint bar is hidden. */}
            <Link
              href={searchHref}
              className="font-semibold text-brand-on-dark no-underline"
              onClick={handleClose}
            >
              {t("noMatchBrowse")}
            </Link>
          </div>
          <SearchKeyboardHints />
        </>
      )}
    </div>
  );
}
