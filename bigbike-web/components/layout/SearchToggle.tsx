"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X, Zap } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SEARCH_PATH = "/tim-kiem/";
const QUICK_SEARCHES = [
  "mũ bảo hiểm fullface",
  "áo giáp touring",
  "găng tay carbon",
  "giày moto",
];
const TRENDING_SEARCHES = [
  "Shoei",
  "Alpinestars",
  "Dainese",
  "AGV",
  "touring chống nước",
];
const POPULAR_CATEGORIES = [
  "Mũ bảo hiểm",
  "Áo giáp",
  "Găng tay",
  "Phụ kiện",
];

export function SearchToggle() {
  const t = useTranslations("Search");
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const { isPanelOpen, togglePanel, closePanel } = useHeaderUi();
  const open = isPanelOpen("search");
  const currentSearchQuery = searchParams.get("s") ?? searchParams.get("q") ?? "";

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  function handleClose() {
    setQuery("");
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

    handleClose();
    router.push(`${SEARCH_PATH}?s=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="bb-header-search">
      <Button
        variant="ghost"
        className={cn(
          "bb-icon-btn bb-header-search-trigger",
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
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("inputPlaceholder")}
              autoComplete="off"
              aria-label={t("inputAriaLabel")}
              className="bb-header-search-input"
            />

            <Button
              type="button"
              variant="ghost"
              className="bb-header-search-close"
              aria-label={t("closeAriaLabel")}
              onClick={handleClose}
            >
              <X size={20} aria-hidden />
            </Button>
          </form>

          <div className="bb-mobile-search-body">
            <section className="bb-mobile-search-section">
              <p>GỢI Ý TÌM KIẾM</p>
              <div className="bb-mobile-search-list">
                {QUICK_SEARCHES.map((item) => (
                  <button key={item} type="button" onClick={() => runSearch(item)}>
                    <Search size={16} aria-hidden />
                    <span>{item}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="bb-mobile-search-section">
              <p>XU HƯỚNG</p>
              <div className="bb-mobile-search-chips">
                {TRENDING_SEARCHES.map((item) => (
                  <button key={item} type="button" onClick={() => runSearch(item)}>
                    <Zap size={13} aria-hidden />
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="bb-mobile-search-section">
              <p>DANH MỤC PHỔ BIẾN</p>
              <div className="bb-mobile-search-grid">
                {POPULAR_CATEGORIES.map((item) => (
                  <button key={item} type="button" onClick={() => runSearch(item)}>
                    <span>{item}</span>
                    <small>BIGBIKE</small>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
