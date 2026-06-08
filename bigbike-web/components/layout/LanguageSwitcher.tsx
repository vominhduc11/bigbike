"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/i18n/locale";
import { iconBtn } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/**
 * Cookie-based locale switcher — URLs stay shared across languages per
 * PRODUCT_RULE_003. Writing the NEXT_LOCALE cookie + router.refresh() causes
 * server components to re-render with the new locale.
 *
 * variant="icon"   → globe icon + hover/click dropdown (desktop header)
 * variant="inline" → VI|EN bordered button group (mobile drawer)
 */

const LOCALE_LABELS: Record<string, string> = {
  vi: "Tiếng Việt",
  en: "English",
};

const dropdownPanel =
  "absolute top-[var(--bb-header-height)] right-0 z-[var(--bb-z-dropdown)] w-[148px] py-1 bg-white " +
  "[box-shadow:0_4px_16px_rgba(0,0,0,0.18),0_0_6px_rgba(0,0,0,0.1)] " +
  "opacity-0 invisible pointer-events-none [transform:translateY(8px)] " +
  "[transition:opacity_var(--bb-duration-fast)_var(--bb-ease-standard),transform_var(--bb-duration-fast)_var(--bb-ease-standard),visibility_0s_linear_var(--bb-duration-fast),pointer-events_0s_linear_var(--bb-duration-fast)] " +
  "before:content-[''] before:absolute before:top-[-10px] before:right-4 before:w-0 before:h-0 " +
  "before:[border-left:10px_solid_transparent] before:[border-right:10px_solid_transparent] before:[border-bottom:10px_solid_#ffffff] " +
  "after:content-[''] after:absolute after:bottom-full after:left-0 after:right-0 after:h-3 " +
  "motion-reduce:[transform:none]";

const dropdownPanelOpen =
  "opacity-100 visible pointer-events-auto [transform:translateY(0px)] " +
  "[transition:opacity_var(--bb-duration-fast)_var(--bb-ease-standard),transform_var(--bb-duration-fast)_var(--bb-ease-standard),visibility_0s_linear_0s,pointer-events_0s_linear_0s]";

export function LanguageSwitcher({ variant = "icon" }: { variant?: "icon" | "inline" }) {
  const t = useTranslations("Language");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [queuedLocale, setQueuedLocale] = useState<Locale | null>(null);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!queuedLocale || queuedLocale === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${queuedLocale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }, [locale, queuedLocale, router]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function selectLocale(next: Locale) {
    if (next === locale || isPending) return;
    setQueuedLocale(next);
    setOpen(false);
  }

  function handleMouseEnter() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function handleMouseLeave() {
    closeTimer.current = setTimeout(() => setOpen(false), 100);
  }

  if (variant === "inline") {
    return (
      <div
        className="inline-flex h-11 self-center items-stretch rounded-none border border-white/15 bg-white/5 text-xs font-bold"
        role="group"
        aria-label={t("label")}
      >
        {LOCALES.map((code) => {
          const active = code === locale;
          return (
            <button
              key={code}
              type="button"
              onClick={() => selectLocale(code)}
              disabled={isPending}
              aria-pressed={active}
              className={cn(
                "min-w-11 px-2.5 font-cta uppercase transition-colors disabled:cursor-wait disabled:opacity-60",
                "focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px]",
                active
                  ? "bg-brand text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              {code.toUpperCase()}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative max-md:hidden h-full flex items-stretch">
      <button
        type="button"
        className={cn(iconBtn, "gap-1 disabled:opacity-50")}
        aria-label={t("label")}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={isPending}
      >
        <Globe size={18} aria-hidden className="shrink-0" />
        <span className="font-cta text-[11px] font-bold uppercase leading-none">{locale.toUpperCase()}</span>
      </button>

      <div
        className={cn(dropdownPanel, open && dropdownPanelOpen)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="listbox"
        aria-label={t("label")}
      >
        {LOCALES.map((code) => {
          const active = code === locale;
          return (
            <button
              key={code}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => selectLocale(code)}
              disabled={isPending}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-2.5 border-none bg-transparent cursor-pointer transition-colors",
                "focus-visible:outline-none focus-visible:bg-muted",
                active
                  ? "text-brand"
                  : "text-foreground hover:text-brand hover:bg-muted",
              )}
            >
              <span className="font-cta text-xs font-bold uppercase w-5 shrink-0">{code.toUpperCase()}</span>
              <span className="text-xs font-normal normal-case">{LOCALE_LABELS[code]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
