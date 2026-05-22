"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { BBTooltip } from "@/components/ui/BBTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toProductListPath } from "@/lib/utils/routes";

export function SearchToggle() {
  const t = useTranslations("Search");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const { isPanelOpen, togglePanel, closePanel } = useHeaderUi();
  const open = isPanelOpen("search");

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

    togglePanel("search");
  }

  function handleSearchSubmit() {
    const trimmed = query.trim();
    if (!trimmed) return;

    handleClose();
    router.push(`${toProductListPath()}?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="bb-header-search">
      <BBTooltip content={t("toggleTooltip")}>
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
      </BBTooltip>

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

        <div className="bb-header-search-panel">
          <form
            role="search"
            className="bb-header-search-form"
            onSubmit={(event) => {
              event.preventDefault();
              handleSearchSubmit();
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
        </div>
      </div>
    </div>
  );
}
