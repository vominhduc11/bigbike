"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toProductListPath } from "@/lib/utils/routes";

const STORAGE_KEY = "bb_recent_searches";
const MAX_RECENT = 6;

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
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecent(getRecentSearches());
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    } else {
      setQuery("");
    }
  }, [open]);

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

  return (
    <>
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

              {query && (
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

            {recent.length > 0 && (
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
