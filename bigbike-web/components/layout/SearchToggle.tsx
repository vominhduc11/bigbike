"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Search, X } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useMediaQueryChange } from "@/lib/hooks/useMediaQueryChange";
import { useRecentSearches } from "@/lib/hooks/useRecentSearches";
import { cn } from "@/lib/utils";
import { toSearchPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { iconBtn } from "@/lib/ui-classes";
import type { ArticleSuggestion, PopularCategory, SearchSuggestion } from "./search/types";
import {
  sClose,
  sForm,
  sIcon,
  sInput,
  sLayer,
  sLayerOpen,
  sOverlay,
  sOverlayOpen,
  sPanel,
} from "./search/styles";
import { PreSuggestions } from "./search/PreSuggestions";
import { SuggestionResults } from "./search/SuggestionResults";
import { MobileSearchBody } from "./search/MobileSearchBody";

type SearchToggleProps = {
  popularCategories?: PopularCategory[];
  // Khi false: chỉ dựng panel/overlay, KHÔNG render nút trigger riêng. Dùng cho
  // route storefront — nút bấm là HeaderSearchButton trong header, SearchToggle chỉ là "panel host".
  renderTrigger?: boolean;
};

export function SearchToggle({
  popularCategories: categoriesFromApi = [],
  renderTrigger = true,
}: SearchToggleProps) {
  const t = useTranslations("Search");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wasOpenRef = useRef(false);
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
    if (open && !wasOpenRef.current) {
      setQuery(currentSearchQuery);
    }
    wasOpenRef.current = open;
  }, [open, currentSearchQuery]);

  useMediaQueryChange("(min-width: 1261px)", closePanel);

  useEffect(() => {
    if (!open || debouncedQuery.length < 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear suggestions state synchronously on empty query or closed panel
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setSuggestLoading(true);

    fetch(`/api/search-suggest?q=${encodeURIComponent(debouncedQuery)}&lang=${encodeURIComponent(locale)}`, { signal })
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
  }, [debouncedQuery, open, locale]);

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
    router.push(`${toSearchPath(locale)}?s=${encodeURIComponent(trimmed)}`);
  }

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
        !renderTrigger && "md:[--bb-header-height:80px]",
      )}
    >
      {renderTrigger && (
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
          <Search size={20} aria-hidden />
        </Button>
      )}

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
              enterKeyHint="search"
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
            <PreSuggestions
              recentSearches={recentSearches}
              trendingSearches={trendingSearches}
              resolvedCategories={resolvedCategories}
              runSearch={runSearch}
              removeSearch={removeSearch}
              clearAll={clearAll}
              handleClose={handleClose}
            />
          )}

          {showSuggestions && (
            <SuggestionResults
              suggestions={suggestions}
              articleSuggestions={articleSuggestions}
              trimmedQuery={trimmedQuery}
              addSearch={addSearch}
              handleClose={handleClose}
            />
          )}

          {!showSuggestions && (
            <MobileSearchBody
              recentSearches={recentSearches}
              quickSearches={quickSearches}
              trendingSearches={trendingSearches}
              resolvedCategories={resolvedCategories}
              runSearch={runSearch}
              removeSearch={removeSearch}
              clearAll={clearAll}
              handleClose={handleClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
