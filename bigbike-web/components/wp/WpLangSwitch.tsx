"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/i18n/locale";

/**
 * Đổi ngôn ngữ — control bigbike-web giữ lại nhưng style hợp theme WP
 * (cụm VI|EN nằm trong .user-control của header WP). Logic cookie-based
 * giống LanguageSwitcher: ghi NEXT_LOCALE + refresh để server re-render.
 */
export function WpLangSwitch() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectLocale(next: Locale) {
    if (next === locale || isPending) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div className="user-control--item lang wp-lang" style={{ display: "inline-flex", alignItems: "center" }}>
      {LOCALES.map((code, i) => (
        <span key={code} className="inline-flex items-center">
          {i > 0 && <span className="!text-white opacity-40 px-1 text-xs select-none">/</span>}
          <button
            type="button"
            onClick={() => selectLocale(code)}
            disabled={isPending}
            aria-pressed={code === locale}
            className={`bg-transparent border-none cursor-pointer !text-white text-xs leading-none px-1 py-0 hover:opacity-100 ${code === locale ? "is-active opacity-100 font-bold" : "opacity-60"}`}
          >
            {code.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
