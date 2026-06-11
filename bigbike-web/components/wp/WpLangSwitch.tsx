"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { LOCALES, type Locale } from "@/i18n/locale";
import { useSetLocale } from "@/components/providers/ClientIntlProvider";

/**
 * Đổi ngôn ngữ — control bigbike-web giữ lại nhưng style hợp theme WP
 * (cụm VI|EN nằm trong .user-control của header WP). Đổi ngôn ngữ ngay ở CLIENT
 * qua ClientIntlProvider (ghi cookie NEXT_LOCALE + swap message), KHÔNG router.refresh
 * — vì server render tĩnh locale `vi` để giữ kiến trúc ISR/SSG.
 */
export function WpLangSwitch() {
  const locale = useLocale() as Locale;
  const setLocale = useSetLocale();
  const [isPending, startTransition] = useTransition();

  function selectLocale(next: Locale) {
    if (next === locale || isPending) return;
    startTransition(() => setLocale(next));
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
