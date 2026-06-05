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
import { iconBtn } from "@/lib/ui-classes";

const SEARCH_PATH = "/tim-kiem/";

// Inline-Tailwind class bundles for the search-panel CONTENT (the overlay shell
// — layer/overlay/panel/form/input + transitions/keyframe — stays in globals.css
// per the CLAUDE.md keyframe/complex-pseudo exemption). Search reds use
// --bb-brand-primary (#ff0c09) → text-brand-on-dark (the exact-value token).
// 3xl/4xl (≥1920 / ≥2560): the fixed search labels/chips bump one text-ui step +
// padding grows, so the panel doesn't look lost on showroom-wide screens. Exception
// to the §10 "nhóm chữ cố định" rule, documented in docs/TYPOGRAPHY.md §8.
const preLabelRow =
  "flex items-center justify-between border-b border-border bg-card px-4 pt-2 pb-1 3xl:px-5 4xl:px-6";
const preLabel =
  "font-cta text-ui-10 font-bold uppercase tracking-[0.1em] text-muted-foreground 3xl:text-ui-11 4xl:text-ui-12";
const preChips = "flex flex-wrap gap-1.5 px-4 pb-3 pt-2.5 3xl:gap-2 3xl:px-5 4xl:px-6";
const preChip =
  "inline-flex cursor-pointer items-center gap-[5px] border border-border bg-card px-3 py-[5px] font-cta text-ui-12 font-semibold uppercase text-foreground transition-colors duration-fast hover:text-brand-on-dark focus-visible:text-brand-on-dark focus-visible:outline-none 3xl:px-3.5 3xl:py-1.5 3xl:text-ui-13 4xl:px-[18px] 4xl:py-2 4xl:text-ui-14";
const resultItem =
  "flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 text-foreground no-underline transition-colors duration-fast hover:bg-card focus-visible:bg-card focus-visible:outline-none 3xl:gap-4 3xl:px-5 3xl:py-3 4xl:px-6 4xl:py-3.5";
const resultsLabel =
  "m-0 border-b border-border bg-card px-4 pt-2 pb-1 font-cta text-ui-10 font-bold uppercase tracking-[0.1em] text-muted-foreground 3xl:px-5 3xl:text-ui-11 4xl:px-6 4xl:text-ui-12";

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
  "m-0 mb-2 font-cta text-ui-11 font-semibold uppercase tracking-[0.16em] text-muted-foreground";
const mList = "grid [&_svg]:text-muted-foreground";
const mListBtn =
  "flex min-h-11 cursor-pointer items-center gap-3 border-b border-border bg-transparent p-0 text-left font-body text-foreground " +
  mFocusRing;
const mRecentRemove =
  "flex h-7 w-7 min-h-11 shrink-0 cursor-pointer items-center justify-center border-b border-border bg-transparent p-0 " +
  mFocusRing;
const mChip =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 border border-border bg-card px-[14px] py-0 font-cta text-ui-13 font-medium uppercase text-foreground [&>svg]:text-brand-on-dark " +
  mFocusRing;
const mGridCard =
  "grid min-h-11 cursor-pointer gap-0.5 border border-border bg-card px-3 py-2.5 text-left font-body text-foreground no-underline " +
  mFocusRing;

// ── Search SHELL bundles (were the `.bb-header-search*` overlay rules in
// globals.css). Dual layout: desktop centered-bar dropdown ↔ mobile (≤767 =
// max-md) full-screen. Raw var() refs + `color:`-hinted arbitraries mirror the
// legacy cascade exactly (the mobile "light reskin" layer is already merged in).
// The `bb-suggest-in` keyframe, the shared `.is-active` trigger color, and the
// global prefers-reduced-motion duration override all stay in globals.css.
const sLayer =
  "pointer-events-none opacity-0 invisible [transition:opacity_0.3s_ease,visibility_0s_linear_0.3s] " +
  "max-md:z-[var(--bb-z-modal)] " +
  // fixed black bar across the header strip (desktop only; hidden on the mobile full-screen panel)
  "before:content-[''] before:fixed before:inset-x-0 before:top-0 before:h-[var(--bb-header-height)] " +
  "before:bg-black before:opacity-0 before:z-[var(--bb-z-modal)] before:[transition:opacity_0.2s_ease] max-md:before:hidden";
const sLayerOpen =
  "pointer-events-auto opacity-100 visible [transition:opacity_0.3s_ease,visibility_0s_linear_0s] before:opacity-100";
const sOverlay =
  "fixed inset-0 [border:none] bg-[rgba(0,0,0,0.64)] " +
  "max-md:bg-[color-mix(in_srgb,var(--bb-color-black)_58%,transparent)]";
// open: the .is-open .overlay rule lifts the overlay just under the mobile panel
const sOverlayOpen = "max-md:z-[calc(var(--bb-mobile-panel-z)_-_1)]";
const sPanel =
  "fixed top-0 left-1/2 z-[calc(var(--bb-z-modal)_+_1)] w-[min(calc(100vw_-_24px),770px)] h-[var(--bb-header-height)] " +
  "3xl:w-[min(calc(100vw_-_24px),940px)] 4xl:w-[min(calc(100vw_-_24px),1120px)] " +
  "px-10 py-0 [transform:translateX(-50%)] " +
  "max-md:left-0 max-md:z-[var(--bb-mobile-panel-z)] max-md:flex max-md:w-screen max-md:h-[100dvh] max-md:max-h-[100dvh] " +
  "max-md:flex-col max-md:p-0 max-md:overflow-hidden max-md:bg-[var(--bb-bg-page)] max-md:text-[color:var(--bb-text-primary)] max-md:[transform:none]";
const sForm =
  "relative flex items-center h-full " +
  "max-md:h-auto max-md:min-h-[calc(var(--bb-header-height)_+_env(safe-area-inset-top))] " +
  "max-md:[padding:max(10px,env(safe-area-inset-top))_14px_10px] max-md:gap-2 " +
  "max-md:[border-bottom:1px_solid_var(--bb-mobile-shell-border)] max-md:bg-[var(--bb-bg-surface-dark-2)] max-md:flex-[0_0_auto]";
const sIcon =
  "absolute top-1/2 left-0 mt-[3px] [transform:translateY(-50%)] text-white " +
  "max-md:static max-md:inline-flex max-md:w-[var(--bb-touch-target)] max-md:h-[var(--bb-touch-target)] " +
  "max-md:min-w-[var(--bb-touch-target)] max-md:min-h-[var(--bb-touch-target)] max-md:items-center max-md:justify-center " +
  "max-md:[transform:none] max-md:text-[color:var(--bb-text-inverse)]";
const sClose =
  // min-h-0 / p-0 ungated: the base `.bb-header-search-close` rule was !important,
  // beating the ≤767 touch-target min-height, so the close stays min-height:0 everywhere.
  "absolute top-1/2 right-0 [transform:translateY(-50%)] min-h-0 p-0 text-white " +
  "hover:bg-transparent hover:text-[color:var(--bb-brand-primary)] focus-visible:bg-transparent focus-visible:text-[color:var(--bb-brand-primary)] " +
  "max-md:static max-md:right-auto max-md:w-[var(--bb-touch-target)] max-md:h-[var(--bb-touch-target)] " +
  "max-md:min-w-[var(--bb-touch-target)] max-md:items-center max-md:justify-center max-md:[transform:none] max-md:text-[color:var(--bb-text-inverse)]";
const sInput =
  // `!` mirrors the legacy !important — guarantees these win over the shadcn Input
  // base regardless of twMerge grouping of the arbitrary properties. Font-size MUST
  // be an arbitrary length (`text-[24px]`, not the named `text-ui-24`): the Input
  // wrapper runs className through cn()/twMerge, which mis-classifies the unknown
  // `text-ui-*` token as a text-COLOR class and collapses it with `text-white!`,
  // silently dropping the color (→ dark text on the black bar). Arbitrary lengths
  // are recognized as the font-size group, so color + size both survive.
  "h-full [border:none]! bg-transparent! [padding:0_48px_0_34px]! [box-shadow:none]! text-white! text-[24px]! 3xl:text-[28px]! 4xl:text-[32px]! " +
  "placeholder:text-white placeholder:opacity-100 placeholder:font-normal focus-visible:outline-none " +
  "max-md:h-[var(--bb-touch-target)]! max-md:[border:1px_solid_rgba(255,255,255,0.18)]! max-md:bg-[var(--bb-bg-surface)]! " +
  "max-md:[padding:0_12px]! max-md:text-[color:var(--bb-text-primary)]! max-md:text-[16px]! max-md:leading-none! " +
  "max-md:min-w-0 max-md:placeholder:text-[color:var(--bb-text-secondary)]";
const sResults =
  "absolute top-full left-[-40px] right-[-40px] z-[1] bg-white [border-top:2px_solid_var(--bb-brand-primary)] " +
  "[box-shadow:0_8px_32px_rgba(0,0,0,0.18)] animate-[bb-suggest-in_180ms_var(--bb-ease-standard)_both] motion-reduce:animate-none " +
  "max-md:static max-md:left-auto max-md:right-auto max-md:flex-[1_1_auto] max-md:min-h-0 max-md:max-h-none " +
  "max-md:overflow-y-auto max-md:[-webkit-overflow-scrolling:touch] max-md:[box-shadow:none] max-md:animate-none max-md:rounded-none";

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
    <div className="relative max-md:static max-md:order-2 max-md:ml-auto">
      <Button
        variant="ghost"
        className={cn(
          iconBtn,
          "bb-header-search-trigger hidden md:inline-flex",
          open && "is-active",
        )}
        aria-label={t("toggleAriaLabel")}
        aria-haspopup="dialog"
        aria-expanded={open}
        type="button"
        onClick={handleToggle}
      >
        <Search size={20} aria-hidden className="4xl:size-6" />
      </Button>

      <div
        className={cn(sLayer, open && sLayerOpen)}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={cn(sOverlay, open && sOverlayOpen)}
          aria-label={t("closeAriaLabel")}
          onClick={handleClose}
        />

        <div
          className={sPanel}
          role="dialog"
          aria-modal="true"
          aria-label={t("dialogAriaLabel")}
        >
          <form
            role="search"
            className={sForm}
            onSubmit={(event) => {
              event.preventDefault();
              runSearch();
            }}
          >
            <span className={sIcon} aria-hidden="true">
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
              className={sInput}
            />

            <Button
              type="button"
              variant="ghost"
              className={sClose}
              aria-label={isLoading ? t("inputPlaceholder") : t("closeAriaLabel")}
              onClick={isLoading ? undefined : handleClose}
            >
              {isLoading
                ? <Loader2 size={20} aria-hidden className="animate-spin" />
                : <X size={20} aria-hidden />}
            </Button>
          </form>

          {showPreSuggestions && (
            <div className={cn(sResults, "max-[767px]:hidden")} aria-label={t("suggestionsLabel")}>
              {recentSearches.length > 0 && (
                <>
                  <div className={preLabelRow}>
                    <span className={preLabel}>{t("recentLabel")}</span>
                    <button type="button" className="cursor-pointer border-none bg-transparent p-0 text-ui-12 text-brand-on-dark hover:underline 3xl:text-ui-13 4xl:text-ui-14" onClick={clearAll}>
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
              className={sResults}
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
                          className="h-12 w-12 shrink-0 object-contain 3xl:h-14 3xl:w-14 4xl:h-16 4xl:w-16"
                          width={48}
                          height={48}
                        />
                      ) : (
                        <div className="h-12 w-12 shrink-0 object-contain 3xl:h-14 3xl:w-14 4xl:h-16 4xl:w-16" aria-hidden />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-caption font-medium text-foreground">{product.name}</span>
                        <span className="text-ui-13 font-bold text-brand-on-dark 3xl:text-ui-14 4xl:text-ui-16">
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
                            <span className="text-ui-13 font-normal text-foreground line-clamp-2 3xl:text-ui-14 4xl:text-ui-16">{article.title}</span>
                            {article.category?.name && (
                              <span className="text-ui-11 font-semibold uppercase tracking-[0.04em] text-brand-on-dark 3xl:text-ui-12 4xl:text-ui-13">
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
                    className="flex items-center justify-center px-4 py-[13px] font-cta text-ui-13 font-semibold uppercase tracking-[0.04em] text-brand-on-dark no-underline transition-colors duration-fast hover:bg-card focus-visible:bg-card focus-visible:outline-none 3xl:text-ui-14 4xl:py-4 4xl:text-ui-16"
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
                    className="cursor-pointer border-0 bg-transparent px-0 py-1 font-body text-ui-13 text-brand-on-dark"
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
                    <span className="font-cta text-ui-13 font-semibold uppercase">{cat.name}</span>
                    <small className="font-cta text-ui-10 tracking-[0.08em] text-muted-foreground">BIGBIKE</small>
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
