"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
  const [queuedLocale, setQueuedLocale] = useState<Locale | null>(null);

  useEffect(() => {
    if (!queuedLocale) return;
    if (queuedLocale === locale) return;

    document.cookie = `${LOCALE_COOKIE}=${queuedLocale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }, [locale, queuedLocale, router, startTransition]);

  function selectLocale(next: Locale) {
    if (next === locale) return;
    setQueuedLocale(next);
  }

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
            className={
              "min-w-11 px-2.5 font-cta uppercase transition-colors disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px] " +
              (active
                ? "bg-brand text-white"
                : "text-white/70 hover:bg-white/5 hover:text-white focus-visible:bg-white/10 focus-visible:text-white")
            }
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
