"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BBTooltip } from "@/components/ui/BBTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFocusTrap } from "@/lib/ui/focus-trap";
import { toProductListPath, toProductPath } from "@/lib/utils/routes";
import { formatVnd, resolveMediaUrl } from "@/lib/utils/format";

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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestProduct[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const listboxId = useId();
  const optionIdPrefix = useId();

  useFocusTrap(shellRef, {
    active: open,
    initialFocusRef: inputRef,
    lockScroll: true,
    onEscape: () => setOpen(false),
  });

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

  // Debounced autocomplete fetch
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
        const res = await fetch(
          `/api/search-suggest?q=${encodeURIComponent(trimmed)}`,
        );
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
  const showRecent = recent.length > 0 && query.trim().length < 2;
  const showEmpty =
    query.trim().length >= 2 && !suggestLoading && suggestions.length === 0;

  const activeList: ActiveItem[] = useMemo(() => {
    if (hasSuggestions) {
      return suggestions.map((p) => ({ kind: "suggest" as const, product: p }));
    }
    if (showRecent) {
      return recent.map((t) => ({ kind: "recent" as const, term: t }));
    }
    return [];
  }, [hasSuggestions, suggestions, showRecent, recent]);

  // Reset highlight when list changes — setState during render is the React-approved
  // pattern for resetting derived state when a computed value changes identity.
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
  const activeDescendant =
    activeIndex >= 0 ? optionId(activeIndex) : undefined;

  return (
    <>
      <BBTooltip content="Tìm kiếm">
      <Button
        ref={triggerRef}
        variant="ghost"
        className="bb-icon-btn"
        aria-label="Tìm kiếm"
        aria-haspopup="dialog"
        aria-expanded={open}
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </Button>
      </BBTooltip>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="bb-search-overlay"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Search shell */}
          <div
            ref={shellRef}
            className="bb-search-shell"
            role="dialog"
            aria-modal="true"
            aria-label="Tìm kiếm"
          >
            <Button
              type="button"
              variant="ghost"
              className="bb-search-close"
              aria-label="Đóng tìm kiếm"
              onClick={() => setOpen(false)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              <span>ESC</span>
            </Button>

            <form
              className="bb-search-bar"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                if (activeIndex >= 0 && activeList[activeIndex]) {
                  selectItem(activeList[activeIndex]);
                } else {
                  doSearch(query);
                }
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>

              <Input
                ref={inputRef}
                type="text"
                placeholder="Tìm sản phẩm, thương hiệu..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                autoComplete="off"
                role="combobox"
                aria-expanded={activeList.length > 0}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={activeDescendant}
                aria-label="Tìm sản phẩm hoặc thương hiệu"
              />

              {suggestLoading && (
                <span className="bb-search-spinner" aria-hidden="true" />
              )}

              {query && !suggestLoading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="bb-search-clear"
                  aria-label="Xoá"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                >
                  ✕
                </Button>
              )}
            </form>

            {/* Instant suggestions */}
            {hasSuggestions && (
              <div className="bb-search-body">
                <div className="bb-search-main">
                  <div className="bb-search-block">
                    <div className="bb-search-block-head">
                      <span className="label">Sản phẩm gợi ý</span>
                      <span className="count">{suggestions.length}</span>
                    </div>
                    <ul
                      className="bb-search-suggest-list"
                      id={listboxId}
                      role="listbox"
                      aria-label="Gợi ý sản phẩm"
                    >
                      {suggestions.map((p, idx) => {
                        const price = p.price?.salePrice ?? p.price?.retailPrice;
                        const isActive = idx === activeIndex;
                        const thumb = resolveMediaUrl(p.image?.url ?? undefined);
                        return (
                          <li key={p.id}>
                            <Link
                              href={toProductPath(p.slug)}
                              id={optionId(idx)}
                              role="option"
                              aria-selected={isActive}
                              data-active={isActive ? "true" : undefined}
                              className="bb-search-suggest-item data-[active=true]:bg-white/10 data-[active=true]:text-white"
                              onClick={() => {
                                saveSearch(p.name);
                                setOpen(false);
                              }}
                              onMouseEnter={() => setActiveIndex(idx)}
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden bg-white/5">
                                {thumb ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={thumb}
                                    alt=""
                                    width={40}
                                    height={40}
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    className="text-white/50"
                                    aria-hidden="true"
                                  >
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <circle cx="9" cy="9" r="2" />
                                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                  </svg>
                                )}
                              </span>
                              <span className="bb-search-suggest-name">{p.name}</span>
                              {price != null && price > 0 && (
                                <span className="bb-search-suggest-price">{formatVnd(price)}</span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="bb-search-suggest-all">
                      <Button
                        type="button"
                        variant="ghost"
                        className="tiny"
                        onClick={() => doSearch(query)}
                      >
                        Xem tất cả kết quả cho &ldquo;{query.trim()}&rdquo; →
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state when no matches */}
            {showEmpty && (
              <div className="bb-search-body">
                <div className="bb-search-main">
                  <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                    <svg
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-white/50"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                      <path d="M8 11h6" />
                    </svg>
                    <p className="text-sm text-white/80">
                      Không tìm thấy sản phẩm phù hợp với &ldquo;{query.trim()}&rdquo;
                    </p>
                    <p className="text-sm text-white/40">
                      Thử từ khoá khác hoặc{" "}
                      <Link
                        href={toProductListPath()}
                        onClick={() => setOpen(false)}
                        className="text-[var(--bb-brand-primary)] hover:underline"
                      >
                        xem toàn bộ sản phẩm
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent searches (when no query yet) */}
            {showRecent && (
              <div className="bb-search-body">
                <div className="bb-search-main">
                  <div className="bb-search-block">
                    <div className="bb-search-block-head">
                      <span className="label">Tìm kiếm gần đây</span>
                      <Button
                        type="button"
                        variant="ghost"
                        className="tiny"
                        onClick={clearRecent}
                      >
                        Xoá tất cả
                      </Button>
                    </div>
                    <ul
                      className="bb-search-recent"
                      id={listboxId}
                      role="listbox"
                      aria-label="Tìm kiếm gần đây"
                    >
                      {recent.map((s, idx) => {
                        const isActive = idx === activeIndex;
                        return (
                          <li key={s}>
                            <Button
                              type="button"
                              variant="ghost"
                              id={optionId(idx)}
                              role="option"
                              aria-selected={isActive}
                              data-active={isActive ? "true" : undefined}
                              className="data-[active=true]:bg-white/10 data-[active=true]:text-white"
                              onClick={() => doSearch(s)}
                              onMouseEnter={() => setActiveIndex(idx)}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                              </svg>
                              <span>{s}</span>
                              <svg
                                className="arr"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="bb-search-footer">
              <span className="bb-search-shortcut">
                <kbd>↑↓</kbd> Di chuyển
              </span>
              <span className="bb-search-shortcut">
                <kbd>↵</kbd> Chọn
              </span>
              <span className="bb-search-shortcut">
                <kbd>ESC</kbd> Đóng
              </span>
              <span className="bb-search-footer-spacer" />
              <span className="bb-search-hint">
                Hoặc{" "}
                <Link href={toProductListPath()} onClick={() => setOpen(false)}>
                  xem tất cả sản phẩm →
                </Link>
              </span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
