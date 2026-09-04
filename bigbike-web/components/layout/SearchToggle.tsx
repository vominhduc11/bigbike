"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Search, X } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useMediaQueryChange } from "@/lib/hooks/useMediaQueryChange";
import { useRecentSearches } from "@/lib/hooks/useRecentSearches";
import { SearchSuggestionsError, useSearchSuggestions } from "@/lib/query/search-suggestions";
import { cn } from "@/lib/utils";
import { toArticlePath, toProductPath, toSearchPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import type { ArticleSuggestion, SearchShortcuts, SearchSuggestion } from "./search/types";
import {
  sClear,
  sClose,
  sForm,
  sIcon,
  sInput,
  sLayer,
  sLayerOpen,
  sLoading,
  sOverlay,
  sOverlayOpen,
  sPanel,
  sResults,
} from "./search/styles";
import { PreSuggestions } from "./search/PreSuggestions";
import { SuggestionResults } from "./search/SuggestionResults";

type SearchToggleProps = {
  shortcuts?: SearchShortcuts;
};

const EMPTY_SHORTCUTS: SearchShortcuts = {
  trendingBrands: [],
  suggestedProducts: [],
  popularCategories: [],
};
const EMPTY_PRODUCT_SUGGESTIONS: SearchSuggestion[] = [];
const EMPTY_ARTICLE_SUGGESTIONS: ArticleSuggestion[] = [];

type SearchNavigationOption = { kind: "recent"; value: string } | { kind: "link"; href: string };

function truncateQueryForDisplay(value: string) {
  const characters = Array.from(value);
  return characters.length > 72 ? `${characters.slice(0, 72).join("")}…` : value;
}

export function SearchToggle({ shortcuts = EMPTY_SHORTCUTS }: SearchToggleProps) {
  const t = useTranslations("Search");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebounce(query.trim(), 300);
  const { isPanelOpen, closePanel } = useHeaderUi();
  const open = isPanelOpen("search");
  const currentSearchQuery = searchParams.get("s") ?? searchParams.get("q") ?? "";
  const trimmedQuery = query.trim();
  const queryTooLong = trimmedQuery.length > 100;
  const currentSearchQueryDisplay = truncateQueryForDisplay(trimmedQuery);

  const { searches: recentSearches, addSearch, removeSearch, clearAll } = useRecentSearches();
  const suggestQuery = open && debouncedQuery.length >= 1 && !queryTooLong;
  const {
    data: suggestionResult,
    error: suggestionError,
    isFetching: suggestLoading,
    refetch,
  } = useSearchSuggestions(locale, debouncedQuery, suggestQuery);
  const suggestions = suggestionResult?.products ?? EMPTY_PRODUCT_SUGGESTIONS;
  const articleSuggestions = suggestionResult?.articles ?? EMPTY_ARTICLE_SUGGESTIONS;
  const isDebouncing = trimmedQuery.length >= 1 && trimmedQuery !== debouncedQuery;
  const isLoading = isDebouncing || suggestLoading;
  const searchError = suggestionError instanceof SearchSuggestionsError ? suggestionError : null;
  const failureKind =
    queryTooLong || searchError?.status === 400
      ? "validation"
      : searchError?.status === 429
        ? "rate-limit"
        : suggestionError
          ? "system"
          : null;
  const showFailure = open && trimmedQuery.length > 0 && failureKind !== null;
  const showSuggestions =
    open &&
    trimmedQuery.length >= 1 &&
    debouncedQuery.length >= 1 &&
    Boolean(suggestionResult) &&
    !showFailure;
  const hasShortcuts =
    shortcuts.trendingBrands.length > 0 || shortcuts.suggestedProducts.length > 0;
  const showPreSuggestions = open && !trimmedQuery && (recentSearches.length > 0 || hasShortcuts);

  const selectableItems: SearchNavigationOption[] = !trimmedQuery
    ? [
        ...recentSearches.slice(0, 5).map((value) => ({ kind: "recent" as const, value })),
        ...shortcuts.trendingBrands
          .slice(0, 5)
          .map((item) => ({ kind: "link" as const, href: item.href })),
        ...shortcuts.suggestedProducts
          .slice(0, 3)
          .map((item) => ({ kind: "link" as const, href: item.href })),
      ]
    : [
        ...(suggestionResult?.products ?? []).slice(0, 5).map((product) => ({
          kind: "link" as const,
          href: toProductPath(
            locale === "en" ? product.slugEn || product.slug : product.slug,
            locale,
          ),
        })),
        ...(suggestionResult?.articles ?? []).slice(0, 3).map((article) => ({
          kind: "link" as const,
          href: toArticlePath(
            locale === "en" ? article.slugEn || article.slug : article.slug,
            locale,
          ),
        })),
      ];

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setQuery(currentSearchQuery);
    }
    wasOpenRef.current = open;
  }, [open, currentSearchQuery]);

  useMediaQueryChange("(min-width: 1261px)", closePanel);

  function handleClose() {
    setQuery("");
    setActiveIndex(-1);
    closePanel();
  }

  function runSearch(value = query) {
    const trimmed = value.trim();
    if (!trimmed) return;
    addSearch(trimmed);
    setQuery("");
    setActiveIndex(-1);
    closePanel();
    router.push(`${toSearchPath(locale)}?s=${encodeURIComponent(trimmed)}`);
  }

  function openActiveSuggestion() {
    const selected = selectableItems[activeIndex];
    if (!selected) return false;
    if (selected.kind === "recent") {
      runSearch(selected.value);
      return true;
    }
    if (trimmedQuery) addSearch(trimmedQuery);
    setQuery("");
    setActiveIndex(-1);
    closePanel();
    router.push(selected.href);
    return true;
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      handleClose();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (selectableItems.length === 0) return;
      event.preventDefault();
      setActiveIndex((current) => {
        if (event.key === "ArrowDown")
          return (current + 1 + selectableItems.length) % selectableItems.length;
        return current <= 0 ? selectableItems.length - 1 : current - 1;
      });
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      openActiveSuggestion();
    }
  }

  const failureCopy =
    failureKind === "rate-limit"
      ? { title: t("rateLimitTitle"), description: t("rateLimitDescription") }
      : failureKind === "validation"
        ? {
            title: t("validationErrorTitle"),
            description: t("validationErrorDescription", { query: currentSearchQueryDisplay }),
          }
        : { title: t("systemErrorTitle"), description: t("systemErrorDescription") };

  return (
    <div
      className={cn(
        "relative max-md:static max-md:order-2 max-md:ml-auto",
        // Panel host trên route storefront: header WP đặt cứng `height:80px` (px tuyệt đối,
        // theme gốc). Nhưng --bb-header-height = 5rem, mà root font-size trên trang WP
        // là 14px → 5rem chỉ ra 70px. Lệch 10px: thanh tìm kiếm (70px) thấp hơn header
        // (80px) nên dropdown (mốc top = 70px) đè lên 10px mép dưới header. Ghim token
        // về đúng 80px px tại md+ để thanh + dropdown bám sát mép dưới header. Mirror
        // cách mega-menu ghim cứng 80px trong globals.css. Mobile (<md) giữ nguyên
        // (panel full-screen, không phụ thuộc mép header).
        "md:[--bb-header-height:80px]",
      )}
    >
      <div className={cn(sLayer, open && sLayerOpen)} aria-hidden={!open}>
        <button
          type="button"
          className={cn(sOverlay, open && sOverlayOpen)}
          aria-label={t("closeAriaLabel")}
          onClick={handleClose}
        />

        <div className={sPanel} role="dialog" aria-modal="true" aria-label={t("dialogAriaLabel")}>
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
              enterKeyHint="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(-1);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder={t("inputPlaceholder")}
              autoComplete="off"
              aria-label={t("inputAriaLabel")}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showSuggestions || showPreSuggestions}
              aria-controls={
                showSuggestions || showPreSuggestions ? "bb-search-suggestions" : undefined
              }
              aria-activedescendant={
                activeIndex >= 0 ? `bb-search-option-${activeIndex}` : undefined
              }
              className={sInput}
            />

            {trimmedQuery && (
              <Button
                type="button"
                variant="ghost"
                className={sClear}
                aria-label={t("clearAriaLabel")}
                onClick={() => {
                  setQuery("");
                  setActiveIndex(-1);
                  inputRef.current?.focus();
                }}
              >
                <X size={16} aria-hidden />
              </Button>
            )}

            {isLoading && (
              <Loader2 size={18} aria-hidden className={cn(sLoading, "animate-spin")} />
            )}

            <Button
              type="button"
              variant="ghost"
              className={sClose}
              aria-label={t("closeAriaLabel")}
              onClick={handleClose}
            >
              <X size={20} aria-hidden />
            </Button>
          </form>

          <span className="sr-only" aria-live="polite">
            {isLoading ? t("loadingSuggestions") : ""}
          </span>

          {showFailure && (
            <div
              className={cn(sResults, "px-4 py-5 text-center text-a5-meta text-muted-foreground")}
              role="alert"
            >
              <p className="m-0 font-semibold text-foreground">{failureCopy.title}</p>
              <p className="m-0 mt-1 break-words">{failureCopy.description}</p>
              {failureKind !== "validation" && (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => void refetch()}
                >
                  {t("retry")}
                </Button>
              )}
            </div>
          )}

          {showPreSuggestions && (
            <PreSuggestions
              recentSearches={recentSearches}
              shortcuts={shortcuts}
              runSearch={runSearch}
              removeSearch={removeSearch}
              clearAll={clearAll}
              handleClose={handleClose}
              activeIndex={activeIndex}
            />
          )}

          {showSuggestions && (
            <SuggestionResults
              suggestions={suggestions}
              articleSuggestions={articleSuggestions}
              trimmedQuery={trimmedQuery}
              addSearch={addSearch}
              handleClose={handleClose}
              activeIndex={activeIndex}
            />
          )}
        </div>
      </div>
    </div>
  );
}
