"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, X, Clock, ArrowRight, ImageIcon } from "lucide-react";
import { BBTooltip } from "@/components/ui/BBTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import { toProductListPath, toProductPath } from "@/lib/utils/routes";
import { formatVnd, resolveMediaUrl } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "bb_recent_searches";
const MAX_RECENT = 6;

type SuggestProduct = {
  id: string;
  slug: string;
  name: string;
  price?: { retailPrice?: number; salePrice?: number } | null;
  image?: { url?: string } | null;
};

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveSearch(query: string): void {
  if (query.trim().length < 2) return;
  try {
    const prev = getRecentSearches().filter((s) => s !== query);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([query, ...prev].slice(0, MAX_RECENT)),
    );
  } catch {
    // ignore
  }
}

type ActiveItem =
  | { kind: "suggest"; product: SuggestProduct }
  | { kind: "recent"; term: string };

export function SearchToggle() {
  const t = useTranslations("Search");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestProduct[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const listboxId = useId();
  const optionIdPrefix = useId();

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecent(getRecentSearches());
    } else {
      setQuery("");
      setSuggestions([]);
      setActiveIndex(-1);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    debounceRef.current = setTimeout(async () => {
      if (trimmed.length < 2) {
        setSuggestions([]);
        return;
      }
      setSuggestLoading(true);
      try {
        const res = await fetch(`/api/search-suggest?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const json = (await res.json()) as { products?: SuggestProduct[] };
          setSuggestions(json.products ?? []);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, trimmed.length < 2 ? 0 : 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hasSuggestions = suggestions.length > 0;
  const queryShort = query.trim().length < 2;
  const showRecent = recent.length > 0 && queryShort;
  const showHistoryBlock = queryShort && !hasSuggestions && !suggestLoading;
  const showEmpty = query.trim().length >= 2 && !suggestLoading && suggestions.length === 0;

  const activeList: ActiveItem[] = useMemo(() => {
    if (hasSuggestions) {
      return suggestions.map((p) => ({ kind: "suggest" as const, product: p }));
    }
    if (showRecent) {
      return recent.map((term) => ({ kind: "recent" as const, term }));
    }
    return [];
  }, [hasSuggestions, suggestions, showRecent, recent]);

  const [prevActiveList, setPrevActiveList] = useState(activeList);
  if (prevActiveList !== activeList) {
    setPrevActiveList(activeList);
    setActiveIndex(-1);
  }

  const doSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      saveSearch(trimmed);
      setOpen(false);
      router.push(`${toProductListPath()}?q=${encodeURIComponent(trimmed)}`);
    },
    [router],
  );

  const selectItem = useCallback(
    (item: ActiveItem) => {
      if (item.kind === "suggest") {
        saveSearch(item.product.name);
        setOpen(false);
        router.push(toProductPath(item.product.slug));
      } else {
        doSearch(item.term);
      }
    },
    [doSearch, router],
  );

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        if (activeList.length === 0) return;
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % activeList.length);
      } else if (e.key === "ArrowUp") {
        if (activeList.length === 0) return;
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? activeList.length - 1 : i - 1));
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && activeList[activeIndex]) {
          e.preventDefault();
          selectItem(activeList[activeIndex]);
        }
      } else if (e.key === "Home") {
        if (activeList.length === 0) return;
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === "End") {
        if (activeList.length === 0) return;
        e.preventDefault();
        setActiveIndex(activeList.length - 1);
      }
    },
    [activeIndex, activeList, selectItem],
  );

  function clearRecent() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setRecent([]);
  }

  const optionId = (index: number) => `${optionIdPrefix}-opt-${index}`;
  const activeDescendant = activeIndex >= 0 ? optionId(activeIndex) : undefined;

  return (
    <>
      <BBTooltip content={t("toggleTooltip")}>
        <Button
          ref={triggerRef}
          variant="ghost"
          className="bb-icon-btn"
          aria-label={t("toggleAriaLabel")}
          aria-haspopup="dialog"
          aria-expanded={open}
          type="button"
          onClick={() => setOpen((o) => !o)}
        >
          <Search size={20} aria-hidden />
        </Button>
      </BBTooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          {/* Overlay bắt đầu từ dưới header — giữ logo/nav hiển thị (z-overlay 400 > z-header 200) */}
          <DialogPrimitive.Overlay className="fixed left-0 right-0 bottom-0 top-[var(--bb-header-stack)] z-[var(--bb-z-overlay)] bg-black/80 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-200" />

          {/* Panel tìm kiếm: khung nổi hẹp, canh giữa dưới header */}
          <DialogPrimitive.Content
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
            className="fixed left-1/2 top-[calc(var(--bb-header-stack)+1rem)] z-[var(--bb-z-modal)] flex max-h-[calc(100dvh-var(--bb-header-stack)-2rem)] w-[min(calc(100vw-2rem),960px)] -translate-x-1/2 flex-col overflow-hidden border border-border bg-background text-foreground shadow-[var(--bb-shadow-lg)] data-[state=open]:animate-in data-[state=open]:slide-in-from-top-2 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top-2 data-[state=closed]:fade-out-0 duration-300"
          >
            <DialogPrimitive.Title className="sr-only">{t("dialogAriaLabel")}</DialogPrimitive.Title>

            {/* Thanh tìm kiếm */}
            <form
              role="search"
              className="flex w-full items-center gap-3.5 border-b border-border bg-background py-3.5 pl-5 pr-5 sm:pl-6 sm:pr-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (activeIndex >= 0 && activeList[activeIndex]) {
                  selectItem(activeList[activeIndex]);
                } else {
                  doSearch(query);
                }
              }}
            >
              <Search size={20} className="shrink-0 text-brand" aria-hidden />

              <Input
                ref={inputRef}
                type="text"
                placeholder={t("inputPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                autoComplete="off"
                role="combobox"
                aria-expanded={activeList.length > 0}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={activeDescendant}
                aria-label={t("inputAriaLabel")}
                className="flex-1 min-h-0 border-0 bg-transparent px-0 py-0 shadow-none text-17 font-medium text-foreground placeholder:text-muted-foreground hover:border-0 focus:border-0 focus:shadow-none"
              />

              {suggestLoading && (
                <span
                  className="size-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-brand"
                  aria-hidden="true"
                />
              )}

              {query && !suggestLoading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 rounded-none text-muted-foreground hover:bg-brand hover:text-primary-foreground"
                  aria-label={t("clearAriaLabel")}
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                >
                  <X size={14} aria-hidden />
                </Button>
              )}
            </form>

            {/* Gợi ý sản phẩm */}
            {hasSuggestions && (
              <div className="w-full min-h-0 overflow-y-auto">
                <div className="px-[clamp(1rem,4vw,2.5rem)] py-4 bg-background">
                  <div className="mb-5 last:mb-0">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        {t("suggestionsLabel")}
                      </span>
                      <span className="text-sm font-bold px-1.5 py-0.5 bg-brand/15 text-brand">
                        {suggestions.length}
                      </span>
                    </div>
                    <ul
                      className="flex flex-col gap-0.5 list-none p-0 m-0"
                      id={listboxId}
                      role="listbox"
                      aria-label={t("suggestAriaLabel")}
                    >
                      {suggestions.map((p, idx) => {
                        const price = p.price?.salePrice ?? p.price?.retailPrice;
                        const isActive = idx === activeIndex;
                        const thumb = resolveMediaUrl(p.image?.url ?? undefined);
                        return (
                          <li key={p.id} className="list-none">
                            <Link
                              href={toProductPath(p.slug)}
                              id={optionId(idx)}
                              role="option"
                              aria-selected={isActive}
                              data-active={isActive ? "true" : undefined}
                              className={cn(
                                "flex items-center gap-3 px-2.5 py-2 text-sm no-underline transition-colors duration-[120ms]",
                                "text-foreground hover:bg-accent hover:text-foreground",
                                "data-[active=true]:bg-accent data-[active=true]:text-foreground",
                              )}
                              onClick={() => {
                                saveSearch(p.name);
                                setOpen(false);
                              }}
                              onMouseEnter={() => setActiveIndex(idx)}
                            >
                              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden border border-border bg-secondary">
                                {thumb ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={thumb} alt="" width={40} height={40} loading="lazy" className="h-full w-full object-cover" />
                                ) : (
                                  <ImageIcon size={18} className="text-muted-foreground" aria-hidden />
                                )}
                              </span>
                              <span className="flex-1 min-w-0 truncate">{p.name}</span>
                              {price != null && price > 0 && (
                                <span className="shrink-0 text-sm font-bold text-brand">{formatVnd(price)}</span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="px-2.5 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto p-0 text-sm text-brand bg-transparent hover:underline"
                        onClick={() => doSearch(query)}
                      >
                        {t("viewAllResultsBtn", { query: query.trim() })}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Không có kết quả */}
            {showEmpty && (
              <div className="w-full min-h-0 overflow-y-auto">
                <div className="px-[clamp(1rem,4vw,2.5rem)] py-4 bg-background">
                  <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                    <Search size={36} className="text-muted-foreground" aria-hidden />
                    <p className="text-sm text-foreground">
                      {t("noMatchText", { query: query.trim() })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("noResultDescription")}{" "}
                      <Link
                        href={toProductListPath()}
                        onClick={() => setOpen(false)}
                        className="text-brand hover:underline"
                      >
                        {t("noMatchBrowse")}
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Lịch sử tìm kiếm */}
            {showHistoryBlock && (
              <div className="w-full min-h-0 overflow-y-auto">
                <div className="px-[clamp(1rem,4vw,2.5rem)] py-4 bg-background">
                  <div className="mb-5 last:mb-0">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                        {t("recentLabel")}
                      </span>
                      {recent.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto p-0 text-sm font-bold uppercase tracking-widest bg-transparent text-muted-foreground hover:text-brand"
                          onClick={clearRecent}
                        >
                          {t("recentClear")}
                        </Button>
                      )}
                    </div>
                    {recent.length === 0 ? (
                      <p className="m-0 px-2.5 py-3 text-sm text-muted-foreground">
                        {t("recentEmpty")}
                      </p>
                    ) : (
                      <ul
                        className="flex flex-col gap-0.5 list-none p-0 m-0"
                        id={listboxId}
                        role="listbox"
                        aria-label={t("recentAriaLabel")}
                      >
                        {recent.map((s, idx) => {
                          const isActive = idx === activeIndex;
                          return (
                            <li key={s} className="list-none">
                              <Button
                                type="button"
                                variant="ghost"
                                id={optionId(idx)}
                                role="option"
                                aria-selected={isActive}
                                data-active={isActive ? "true" : undefined}
                                className={cn(
                                  "group w-full justify-start gap-2.5 rounded-none px-2.5 py-2 text-sm text-foreground hover:bg-accent hover:text-foreground",
                                  "data-[active=true]:bg-accent data-[active=true]:text-foreground",
                                )}
                                onClick={() => doSearch(s)}
                                onMouseEnter={() => setActiveIndex(idx)}
                              >
                                <Clock size={14} className="shrink-0 text-muted-foreground" aria-hidden />
                                <span className="flex-1 min-w-0 truncate text-left">{s}</span>
                                <ArrowRight size={14} className="shrink-0 text-muted-foreground opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 group-hover:text-brand" aria-hidden />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </>
  );
}
