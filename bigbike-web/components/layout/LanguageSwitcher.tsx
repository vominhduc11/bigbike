"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n/locale";
import { useSetLocale } from "@/components/providers/ClientIntlProvider";
import { useAltSlug, type AltSlugKind } from "@/components/i18n/AltSlugProvider";
import { toArticlePath, toBrandPath, toCategoryPath, toProductPath } from "@/lib/utils/routes";
import { iconBtn } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/**
 * Cookie-based locale switcher (writes NEXT_LOCALE + swaps the message bundle
 * client-side, no reload). On DETAIL pages that supply an `AltSlugProvider`, it
 * ALSO navigates to the language-appropriate URL slug
 * (PRODUCT/CATEGORY/BRAND/ARTICLE_RULE_003); listings/home keep the in-place swap.
 *
 * variant="icon"   → globe icon + hover/click dropdown (desktop header)
 * variant="inline" → VI|EN bordered button group (mobile drawer)
 */

function pathForKind(kind: AltSlugKind, slug: string): string {
  if (kind === "category") return toCategoryPath(slug);
  if (kind === "product") return toProductPath(slug);
  if (kind === "article") return toArticlePath(slug);
  return toBrandPath(slug);
}

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
  const setLocale = useSetLocale();
  const router = useRouter();
  const altSlug = useAltSlug();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setOpen(false);
    // Đổi ngôn ngữ ngay ở client (ghi cookie + swap message) — không reload/round-trip server.
    startTransition(() => setLocale(next));
    // Trên trang chi tiết có alt-slug: nhảy sang URL slug của ngôn ngữ đích nếu khác URL hiện tại.
    if (altSlug) {
      const slugFor = (lang: Locale) =>
        lang === DEFAULT_LOCALE ? altSlug.viSlug : altSlug.enSlug ?? altSlug.viSlug;
      const targetSlug = slugFor(next);
      if (targetSlug !== slugFor(locale)) {
        router.push(pathForKind(altSlug.kind, targetSlug));
      }
    }
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
        className="inline-flex h-11 self-center items-stretch rounded-none border border-white/15 bg-white/5 text-overline font-bold"
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
        <span className="font-cta text-ui-11 font-bold uppercase leading-none">{locale.toUpperCase()}</span>
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
              <span className="font-cta text-overline font-bold uppercase w-5 shrink-0">{code.toUpperCase()}</span>
              <span className="text-overline font-normal normal-case">{LOCALE_LABELS[code]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
