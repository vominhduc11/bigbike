"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Clock, Loader2, Search, X, Zap } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useRecentSearches } from "@/lib/hooks/useRecentSearches";
import { formatVnd, resolveMediaUrl } from "@/lib/utils/format";
import { toArticlePath, toCategoryPath, toProductPath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils";

const SEARCH_PATH = "/tim-kiem/";

type PopularCategory = { name: string; slug: string };

type SearchSuggestion = {
  id: string;
  slug: string;
  name: string;
  price?: { retailPrice?: number; salePrice?: number } | null;
  image?: { url?: string } | null;
};

type ArticleSuggestion = {
  id: string;
  slug: string;
  title: string;
  category?: { name: string } | null;
  coverImage?: { url?: string } | null;
};

type SearchToggleProps = {
  popularCategories?: PopularCategory[];
};

export function SearchToggle({ popularCategories: categoriesFromApi = [] }: SearchToggleProps) {
  const t = useTranslations("Search");
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [articleSuggestions, setArticleSuggestions] = useState<ArticleSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const debouncedQuery = useDebounce(query.trim(), 300);
  const { isPanelOpen, togglePanel, closePanel } = useHeaderUi();
  const open = isPanelOpen("search");
  const currentSearchQuery = searchParams.get("s") ?? searchParams.get("q") ?? "";

  const { searches: recentSearches, addSearch, removeSearch, clearAll } = useRecentSearches();

  const quickSearches = t.raw("quickSearchSuggestions") as string[];
  const trendingSearches = t.raw("trendingSearches") as string[];
  const localCategories = t.raw("popularCategories") as string[];
  const resolvedCategories: PopularCategory[] = categoriesFromApi.length > 0
    ? categoriesFromApi
    : localCategories.map(name => ({ name, slug: "" }));

  const trimmedQuery = query.trim();
  const isDebouncing = trimmedQuery.length >= 1 && trimmedQuery !== debouncedQuery;
  const isLoading = isDebouncing || suggestLoading;
  const showSuggestions = open && debouncedQuery.length >= 1 && !isLoading;
  const showPreSuggestions =
    open && !trimmedQuery && !isLoading &&
    (recentSearches.length > 0 || trendingSearches.length > 0);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1261px)");
    function onBreakpointChange(e: MediaQueryListEvent) {
      if (e.matches) closePanel();
    }
    mql.addEventListener("change", onBreakpointChange);
    return () => mql.removeEventListener("change", onBreakpointChange);
  }, [closePanel]);

  useEffect(() => {
    if (!open || debouncedQuery.length < 1) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setSuggestLoading(true);

    fetch(`/api/search-suggest?q=${encodeURIComponent(debouncedQuery)}`, { signal })
      .then((res) => res.json())
      .then((data: { products: SearchSuggestion[]; articles: ArticleSuggestion[] }) => {
        setSuggestions(data.products ?? []);
        setArticleSuggestions(data.articles ?? []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
        setArticleSuggestions([]);
      })
      .finally(() => setSuggestLoading(false));

    return () => abortRef.current?.abort();
  }, [debouncedQuery, open]);

  function handleClose() {
    setQuery("");
    setSuggestions([]);
    setArticleSuggestions([]);
    setSuggestLoading(false);
    closePanel();
  }

  function handleToggle() {
    if (open) {
      handleClose();
      return;
    }
    setQuery(currentSearchQuery);
    togglePanel("search");
  }

  function runSearch(value = query) {
    const trimmed = value.trim();
    if (!trimmed) return;
    addSearch(trimmed);
    handleClose();
    router.push(`${SEARCH_PATH}?s=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="bb-header-search">
      <Button
        variant="ghost"
        className={cn(
          "bb-icon-btn bb-header-search-trigger hidden md:flex",
          open && "is-active",
        )}
        aria-label={t("toggleAriaLabel")}
        aria-haspopup="dialog"
        aria-expanded={open}
        type="button"
        onClick={handleToggle}
      >
        <Search size={20} aria-hidden />
      </Button>

      <div
        className={cn("bb-header-search-layer", open && "is-open")}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="bb-header-search-overlay"
          aria-label={t("closeAriaLabel")}
          onClick={handleClose}
        />

        <div
          className="bb-header-search-panel"
          role="dialog"
          aria-modal="true"
          aria-label={t("dialogAriaLabel")}
        >
          <form
            role="search"
            className="bb-header-search-form"
            onSubmit={(event) => {
              event.preventDefault();
              runSearch();
            }}
          >
            <span className="bb-header-search-icon" aria-hidden="true">
              <Search size={20} />
            </span>

            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("inputPlaceholder")}
              autoComplete="off"
              aria-label={t("inputAriaLabel")}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              aria-controls={showSuggestions ? "bb-search-suggestions" : undefined}
              className="bb-header-search-input"
            />

            <Button
              type="button"
              variant="ghost"
              className="bb-header-search-close"
              aria-label={isLoading ? t("inputPlaceholder") : t("closeAriaLabel")}
              onClick={isLoading ? undefined : handleClose}
            >
              {isLoading
                ? <Loader2 size={20} aria-hidden className="animate-spin" />
                : <X size={20} aria-hidden />}
            </Button>
          </form>

          {showPreSuggestions && (
            <div className="bb-header-search-results max-[767px]:hidden" aria-label={t("suggestionsLabel")}>
              {recentSearches.length > 0 && (
                <>
                  <div className="bb-search-pre-label-row">
                    <span>{t("recentLabel")}</span>
                    <button type="button" className="bb-search-pre-clear" onClick={clearAll}>
                      {t("recentClear")}
                    </button>
                  </div>
                  {recentSearches.slice(0, 5).map((item) => (
                    <div key={item} className="bb-search-pre-item">
                      <button
                        type="button"
                        className="bb-search-pre-item-trigger"
                        onClick={() => runSearch(item)}
                      >
                        <Clock size={14} aria-hidden />
                        <span>{item}</span>
                      </button>
                      <button
                        type="button"
                        className="bb-search-pre-remove"
                        aria-label={`Xoá "${item}"`}
                        onClick={() => removeSearch(item)}
                      >
                        <X size={12} aria-hidden />
                      </button>
                    </div>
                  ))}
                </>
              )}
              <div className="bb-search-pre-label-row">
                <span>{t("trendingHeading")}</span>
              </div>
              <div className="bb-search-pre-chips">
                {trendingSearches.slice(0, 5).map((item) => (
                  <button key={item} type="button" className="bb-search-pre-chip" onClick={() => runSearch(item)}>
                    <Zap size={11} aria-hidden />
                    {item}
                  </button>
                ))}
              </div>
              <div className="bb-search-pre-label-row">
                <span>{t("popularCategoriesHeading")}</span>
              </div>
              <div className="bb-search-pre-chips">
                {resolvedCategories.map((cat) => (
                  <Link
                    key={cat.slug || cat.name}
                    href={cat.slug ? toCategoryPath(cat.slug) : `${SEARCH_PATH}?s=${encodeURIComponent(cat.name)}`}
                    className="bb-search-pre-chip"
                    onClick={handleClose}
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {showSuggestions && (
            <div
              id="bb-search-suggestions"
              className="bb-header-search-results"
              role="listbox"
              aria-label={t("suggestionsLabel")}
            >
              {suggestions.length > 0 || articleSuggestions.length > 0 ? (
                <>
                  {suggestions.length > 0 && (
                    <p className="bb-header-search-results-label">{t("sectionProducts")}</p>
                  )}
                  {suggestions.slice(0, 5).map((product) => (
                    <Link
                      key={product.id}
                      href={toProductPath(product.slug)}
                      className="bb-header-search-result-item"
                      role="option"
                      aria-selected={false}
                      onClick={() => { addSearch(trimmedQuery); handleClose(); }}
                    >
                      {resolveMediaUrl(product.image?.url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveMediaUrl(product.image?.url)!}
                          alt={product.name}
                          className="bb-header-search-result-img"
                          width={48}
                          height={48}
                        />
                      ) : (
                        <div className="bb-header-search-result-img" aria-hidden />
                      )}
                      <div className="bb-header-search-result-info">
                        <span className="bb-header-search-result-name">{product.name}</span>
                        <span className="bb-header-search-result-price">
                          {formatVnd(product.price?.salePrice ?? product.price?.retailPrice)}
                        </span>
                      </div>
                    </Link>
                  ))}
                  {articleSuggestions.length > 0 && (
                    <>
                      <p className="bb-header-search-results-label">{t("sectionArticles")}</p>
                      {articleSuggestions.slice(0, 5).map((article) => (
                        <Link
                          key={article.id}
                          href={toArticlePath(article.slug)}
                          className="bb-header-search-result-item bb-header-search-result-article"
                          role="option"
                          aria-selected={false}
                          onClick={handleClose}
                        >
                          <div className="bb-header-search-result-info">
                            <span className="bb-header-search-result-name">{article.title}</span>
                            {article.category?.name && (
                              <span className="bb-header-search-result-category">
                                {article.category.name}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </>
                  )}
                  <Link
                    href={`${SEARCH_PATH}?s=${encodeURIComponent(trimmedQuery)}`}
                    className="bb-header-search-results-footer"
                    onClick={handleClose}
                  >
                    {t("viewAllResultsBtn", { query: trimmedQuery })}
                  </Link>
                </>
              ) : (
                <div className="bb-header-search-results-empty">
                  <p>{t("noMatchText", { query: trimmedQuery })}</p>
                  <Link
                    href={`${SEARCH_PATH}?s=${encodeURIComponent(trimmedQuery)}`}
                    onClick={handleClose}
                  >
                    {t("noMatchBrowse")}
                  </Link>
                </div>
              )}
            </div>
          )}

          {!showSuggestions && (
          <div className="bb-mobile-search-body">
            {recentSearches.length > 0 ? (
              <section className="bb-mobile-search-section">
                <div className="bb-mobile-search-section-header">
                  <p>{t("recentLabel")}</p>
                  <button
                    type="button"
                    className="bb-mobile-search-clear-btn"
                    onClick={clearAll}
                  >
                    {t("recentClear")}
                  </button>
                </div>
                <div className="bb-mobile-search-list">
                  {recentSearches.map((item) => (
                    <div
                      key={item}
                      role="button"
                      tabIndex={0}
                      className="bb-mobile-search-recent-item"
                      onClick={() => runSearch(item)}
                      onKeyDown={(e) => e.key === "Enter" && runSearch(item)}
                    >
                      <Clock size={16} aria-hidden />
                      <span>{item}</span>
                      <button
                        type="button"
                        className="bb-mobile-search-recent-remove"
                        aria-label={`Xoá "${item}"`}
                        onClick={(e) => { e.stopPropagation(); removeSearch(item); }}
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="bb-mobile-search-section">
                <p>{t("quickSearchesHeading")}</p>
                <div className="bb-mobile-search-list">
                  {quickSearches.map((item) => (
                    <button key={item} type="button" onClick={() => runSearch(item)}>
                      <Search size={16} aria-hidden />
                      <span>{item}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="bb-mobile-search-section">
              <p>{t("trendingHeading")}</p>
              <div className="bb-mobile-search-chips">
                {trendingSearches.map((item) => (
                  <button key={item} type="button" onClick={() => runSearch(item)}>
                    <Zap size={13} aria-hidden />
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="bb-mobile-search-section">
              <p>{t("popularCategoriesHeading")}</p>
              <div className="bb-mobile-search-grid">
                {resolvedCategories.map((cat) => (
                  <Link
                    key={cat.slug || cat.name}
                    href={cat.slug ? toCategoryPath(cat.slug) : `${SEARCH_PATH}?s=${encodeURIComponent(cat.name)}`}
                    onClick={handleClose}
                  >
                    <span>{cat.name}</span>
                    <small>BIGBIKE</small>
                  </Link>
                ))}
              </div>
            </section>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
