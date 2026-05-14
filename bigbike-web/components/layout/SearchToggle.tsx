"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BBTooltip } from "@/components/ui/BBTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFocusTrap } from "@/lib/ui/focus-trap";
import { toProductListPath, toProductPath } from "@/lib/utils/routes";
import { formatVnd } from "@/lib/utils/format";

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

export function SearchToggle() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestProduct[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

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

  function doSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    saveSearch(trimmed);
    setOpen(false);
    router.push(`${toProductListPath()}?q=${encodeURIComponent(trimmed)}`);
  }

  function clearRecent() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setRecent([]);
  }

  const hasSuggestions = suggestions.length > 0;
  const showRecent = recent.length > 0 && query.trim().length < 2;

  return (
    <>
      <BBTooltip content="Tìm kiếm">
      <Button
        ref={triggerRef}
        variant="ghost"
        className="bb-icon-btn"
        aria-label="Tìm kiếm"
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
              onSubmit={(e) => {
                e.preventDefault();
                doSearch(query);
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
                autoComplete="off"
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
                  onClick={() => setQuery("")}
                >
                  ✕
                </Button>
              )}
            </form>

            {/* Instant suggestions */}
            {hasSuggestions && (
              <div className="bb-search-body">
                <div className="bb-search-main col-span-full">
                  <div className="bb-search-block">
                    <div className="bb-search-block-head">
                      <span className="label">Sản phẩm gợi ý</span>
                    </div>
                    <ul className="bb-search-suggest-list">
                      {suggestions.map((p) => {
                        const price = p.price?.salePrice ?? p.price?.retailPrice;
                        return (
                          <li key={p.id}>
                            <Link
                              href={toProductPath(p.slug)}
                              className="bb-search-suggest-item"
                              onClick={() => {
                                saveSearch(p.name);
                                setOpen(false);
                              }}
                            >
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

            {/* Recent searches (when no query yet) */}
            {showRecent && (
              <div className="bb-search-body">
                <div className="bb-search-main col-span-full">
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
                    <ul className="bb-search-recent">
                      {recent.map((s) => (
                        <li key={s}>
                          <Button type="button" variant="ghost" onClick={() => doSearch(s)}>
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
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="bb-search-footer">
              <span className="bb-search-shortcut">
                <kbd>↵</kbd> Tìm kiếm
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
