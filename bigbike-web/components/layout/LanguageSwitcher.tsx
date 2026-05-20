"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/i18n/locale";

/**
 * Cookie-based locale switcher (Đợt 2A). URLs stay shared across languages —
 * see `docs/business/BUSINESS_RULES.md` PRODUCT_RULE_003. Switching writes the
 * `NEXT_LOCALE` cookie and triggers `router.refresh()` so server components
 * re-render with the new locale + product `?lang=` query.
 */
export function LanguageSwitcher() {
  const t = useTranslations("Language");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectLocale(next: Locale) {
    if (next === locale) return;
    // 1 year — opt-in preference; same-site by default so it travels on every nav.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-none border border-border bg-background text-xs font-medium"
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
            className={
              "px-2.5 py-1 uppercase transition-colors " +
              (active
                ? "bg-foreground text-background"
                : "text-foreground/70 hover:bg-foreground/5")
            }
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
