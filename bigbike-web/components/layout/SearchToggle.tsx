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
import { useMediaQueryChange } from "@/lib/hooks/useMediaQueryChange";
import { useRecentSearches } from "@/lib/hooks/useRecentSearches";
import { formatVnd, resolveMediaUrl } from "@/lib/utils/format";
import { toArticlePath, toCategoryPath, toProductPath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils";

const SEARCH_PATH = "/tim-kiem/";

// Inline-Tailwind class bundles for the search-panel CONTENT (the overlay shell
// — layer/overlay/panel/form/input + transitions/keyframe — stays in globals.css
// per the CLAUDE.md keyframe/complex-pseudo exemption). Search reds use
// --bb-brand-primary (#ff0c09) → text-brand-on-dark (the exact-value token).
const preLabelRow = "flex items-center justify-between border-b border-border bg-card px-4 pt-2 pb-1";
const preLabel = "font-cta text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground";
const preChips = "flex flex-wrap gap-1.5 px-4 pb-3 pt-2.5";
const preChip =
  "inline-flex cursor-pointer items-center gap-[5px] border border-border bg-card px-3 py-[5px] font-cta text-[12px] font-semibold uppercase text-foreground transition-colors duration-fast hover:text-brand-on-dark focus-visible:text-brand-on-dark focus-visible:outline-none";
const resultItem =
  "flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 text-foreground no-underline transition-colors duration-fast hover:bg-card focus-visible:bg-card focus-visible:outline-none";
const resultsLabel =
  "m-0 border-b border-border bg-card px-4 pt-2 pb-1 font-cta text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground";

// Mobile-only search body (≤767). The dark 9437 layer is fully overridden by the
// "whole-site refactor pass" to LIGHT, so these are the merged light values; the
// panel/form/input/results overlay shell stays in globals.css. Tokens are exact
// equivalents: bg-background == --bb-bg-page, bg-card == --bb-bg-surface,
// border-border == --bb-border-subtle, text-muted-foreground == --bb-text-secondary.
const mFocusRing =
  "focus-visible:[outline:var(--bb-focus-outline)] focus-visible:[outline-offset:2px]";
const mBody =
  "hidden max-md:block flex-none min-h-0 overflow-y-auto bg-background px-6 pt-[18px] pb-[calc(24px_+_env(safe-area-inset-bottom))] text-foreground [-webkit-overflow-scrolling:touch]";
const mSection = "mb-[22px]";
const mLabel =
  "m-0 mb-2 font-cta text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
const mList = "grid [&_svg]:text-muted-foreground";
const mListBtn =
  "flex min-h-11 cursor-pointer items-center gap-3 border-b border-border bg-transparent p-0 text-left font-body text-foreground " +
  mFocusRing;
const mRecentRemove =
  "flex h-7 w-7 min-h-11 shrink-0 cursor-pointer items-center justify-center border-b border-border bg-transparent p-0 " +
  mFocusRing;
const mChip =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 border border-border bg-card px-[14px] py-0 font-cta text-[13px] font-medium uppercase text-foreground [&>svg]:text-brand-on-dark " +
  mFocusRing;
const mGridCard =
  "grid min-h-11 cursor-pointer gap-0.5 border border-border bg-card px-3 py-2.5 text-left font-body text-foreground no-underline " +
  mFocusRing;

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

  useMediaQueryChange("(min-width: 1261px)", closePanel);

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
                  <div className={preLabelRow}>
                    <span className={preLabel}>{t("recentLabel")}</span>
                    <button type="button" className="cursor-pointer border-none bg-transparent p-0 text-[12px] text-brand-on-dark hover:underline" onClick={clearAll}>
                      {t("recentClear")}
                    </button>
                  </div>
                  {recentSearches.slice(0, 5).map((item) => (
                    <div key={item} className="flex items-center border-b border-border transition-colors duration-fast last-of-type:border-b-0 hover:bg-card">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 border-none bg-transparent py-[9px] pl-4 pr-2 text-left font-body text-caption text-foreground hover:text-brand-on-dark focus-visible:text-brand-on-dark focus-visible:outline-none"
                        onClick={() => runSearch(item)}
                      >
                        <Clock size={14} aria-hidden className="shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{item}</span>
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-muted-foreground transition-colors duration-fast hover:text-foreground"
                        aria-label={`Xoá "${item}"`}
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
                    <p className={resultsLabel}>{t("sectionProducts")}</p>
                  )}
                  {suggestions.slice(0, 5).map((product) => (
                    <Link
                      key={product.id}
                      href={toProductPath(product.slug)}
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
                        <span className="truncate text-caption font-medium text-foreground">{product.name}</span>
                        <span className="text-[13px] font-bold text-brand-on-dark">
                          {formatVnd(product.price?.salePrice ?? product.price?.retailPrice)}
                        </span>
                      </div>
                    </Link>
                  ))}
                  {articleSuggestions.length > 0 && (
                    <>
                      <p className={resultsLabel}>{t("sectionArticles")}</p>
                      {articleSuggestions.slice(0, 5).map((article) => (
                        <Link
                          key={article.id}
                          href={toArticlePath(article.slug)}
                          className={resultItem}
                          role="option"
                          aria-selected={false}
                          onClick={handleClose}
                        >
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-[13px] font-normal text-foreground line-clamp-2">{article.title}</span>
                            {article.category?.name && (
                              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-brand-on-dark">
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
                    className="flex items-center justify-center px-4 py-[13px] font-cta text-[13px] font-semibold uppercase tracking-[0.04em] text-brand-on-dark no-underline transition-colors duration-fast hover:bg-card focus-visible:bg-card focus-visible:outline-none"
                    onClick={handleClose}
                  >
                    {t("viewAllResultsBtn", { query: trimmedQuery })}
                  </Link>
                </>
              ) : (
                <div className="px-4 py-5 text-center text-caption text-muted-foreground">
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
          )}

          {!showSuggestions && (
          <div className={mBody}>
            {recentSearches.length > 0 ? (
              <section className={mSection}>
                <div className="mb-1 flex items-center justify-between">
                  <p className="m-0">{t("recentLabel")}</p>
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent px-0 py-1 font-body text-[13px] text-brand-on-dark"
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
                    href={cat.slug ? toCategoryPath(cat.slug) : `${SEARCH_PATH}?s=${encodeURIComponent(cat.name)}`}
                    className={mGridCard}
                    onClick={handleClose}
                  >
                    <span className="font-cta text-[13px] font-semibold uppercase">{cat.name}</span>
                    <small className="font-cta text-[10px] tracking-[0.08em] text-muted-foreground">BIGBIKE</small>
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
