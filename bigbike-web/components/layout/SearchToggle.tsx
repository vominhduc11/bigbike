"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BBTooltip } from "@/components/ui/BBTooltip";
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecent(getRecentSearches());
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
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
      if (e.key === "Escape") setOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
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
      <button
        className="wp-icon-btn"
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
      </button>
      </BBTooltip>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="wp-search-overlay"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Search shell */}
          <div className="wp-search-shell" role="dialog" aria-label="Tìm kiếm">
            <button
              type="button"
              className="wp-search-close"
              aria-label="Đóng tìm kiếm"
              onClick={() => setOpen(false)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              <span>ESC</span>
            </button>

            <form
              className="wp-search-bar"
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

              <input
                ref={inputRef}
                type="text"
                placeholder="Tìm sản phẩm, thương hiệu..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />

              {suggestLoading && (
                <span className="wp-search-spinner" aria-hidden="true" />
              )}

              {query && !suggestLoading && (
                <button
                  type="button"
                  className="wp-search-clear"
                  aria-label="Xoá"
                  onClick={() => setQuery("")}
                >
                  ✕
                </button>
              )}
            </form>

            {/* Instant suggestions */}
            {hasSuggestions && (
              <div className="wp-search-body">
                <div className="wp-search-main" style={{ gridColumn: "1 / -1" }}>
                  <div className="wp-search-block">
                    <div className="wp-search-block-head">
                      <span className="label">Sản phẩm gợi ý</span>
                    </div>
                    <ul className="wp-search-suggest-list">
                      {suggestions.map((p) => {
                        const price = p.price?.salePrice ?? p.price?.retailPrice;
                        return (
                          <li key={p.id}>
                            <Link
                              href={toProductPath(p.slug)}
                              className="wp-search-suggest-item"
                              onClick={() => {
                                saveSearch(p.name);
                                setOpen(false);
                              }}
                            >
                              <span className="wp-search-suggest-name">{p.name}</span>
                              {price != null && price > 0 && (
                                <span className="wp-search-suggest-price">{formatVnd(price)}</span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="wp-search-suggest-all">
                      <button
                        type="button"
                        className="tiny"
                        onClick={() => doSearch(query)}
                      >
                        Xem tất cả kết quả cho &ldquo;{query.trim()}&rdquo; →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent searches (when no query yet) */}
            {showRecent && (
              <div className="wp-search-body">
                <div className="wp-search-main" style={{ gridColumn: "1 / -1" }}>
                  <div className="wp-search-block">
                    <div className="wp-search-block-head">
                      <span className="label">Tìm kiếm gần đây</span>
                      <button
                        type="button"
                        className="tiny"
                        onClick={clearRecent}
                      >
                        Xoá tất cả
                      </button>
                    </div>
                    <ul className="wp-search-recent">
                      {recent.map((s) => (
                        <li key={s}>
                          <button type="button" onClick={() => doSearch(s)}>
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
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="wp-search-footer">
              <span className="wp-search-shortcut">
                <kbd>↵</kbd> Tìm kiếm
              </span>
              <span className="wp-search-shortcut">
                <kbd>ESC</kbd> Đóng
              </span>
              <span className="wp-search-footer-spacer" />
              <span className="wp-search-hint">
                Hoặc{" "}
                <a
                  href={toProductListPath()}
                  onClick={(e) => {
                    e.preventDefault();
                    setOpen(false);
                    router.push(toProductListPath());
                  }}
                >
                  xem tất cả sản phẩm →
                </a>
              </span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
