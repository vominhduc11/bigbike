"use client";

import { useLocale } from "next-intl";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, type Locale } from "@/i18n/locale";
import { useSetLocale } from "@/components/providers/ClientIntlProvider";
import { useAltSlug } from "@/components/i18n/AltSlugProvider";
import { toProductPath, toCategoryPath, toBrandPath, toArticlePath } from "@/lib/utils/routes";

/**
 * Đổi ngôn ngữ — control bigbike-web giữ lại nhưng style hợp theme WP
 * (cụm VI|EN nằm trong .user-control của header WP). Đổi ngôn ngữ ngay ở CLIENT
 * qua ClientIntlProvider (ghi cookie NEXT_LOCALE + swap message). Khi ở các trang
 * chi tiết có đăng ký Alt Slug, tự động điều hướng sang URL đúng ngôn ngữ (V213/214/215).
 */
export function WpLangSwitch() {
  const locale = useLocale() as Locale;
  const setLocale = useSetLocale();
  const altSlug = useAltSlug();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectLocale(next: Locale) {
    if (next === locale || isPending) return;
    startTransition(() => {
      setLocale(next);
      if (altSlug) {
        const slug = next === "en" ? (altSlug.enSlug || altSlug.viSlug) : altSlug.viSlug;
        let targetPath = "/";
        if (altSlug.kind === "product") {
          targetPath = toProductPath(slug);
        } else if (altSlug.kind === "category") {
          targetPath = toCategoryPath(slug);
        } else if (altSlug.kind === "brand") {
          targetPath = toBrandPath(slug);
        } else if (altSlug.kind === "article") {
          targetPath = toArticlePath(slug);
        }
        router.push(targetPath);
      }
    });
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

