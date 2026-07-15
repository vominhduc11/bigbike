"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useTransition } from "react";

import { useAltSlug } from "@/components/i18n/AltSlugProvider";
import { useSetLocale } from "@/components/providers/ClientIntlProvider";
import { Button } from "@/components/ui/button";
import { LOCALES, type Locale } from "@/i18n/locale";
import { cn } from "@/lib/utils";
import {
  toArticlePath,
  toBrandPath,
  toCategoryPath,
  toProductPath,
  translatePath,
} from "@/lib/utils/routes";

export function LanguageSwitch() {
  const locale = useLocale() as Locale;
  const setLocale = useSetLocale();
  const altSlug = useAltSlug();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  if (pathname?.startsWith("/preview")) return null;

  function selectLocale(next: Locale) {
    if (next === locale || isPending) return;
    startTransition(() => {
      setLocale(next);
      if (altSlug) {
        const slug = next === "en" ? altSlug.enSlug || altSlug.viSlug : altSlug.viSlug;
        if (altSlug.kind === "product") router.push(toProductPath(slug));
        else if (altSlug.kind === "category") router.push(toCategoryPath(slug, next, next === "en" && !!altSlug.enSlug));
        else if (altSlug.kind === "brand") router.push(toBrandPath(slug));
        else if (altSlug.kind === "article") router.push(toArticlePath(slug, next, next === "en" && !!altSlug.enSlug));
      } else if (pathname) {
        const targetPath = translatePath(pathname, next);
        if (targetPath !== pathname) router.push(targetPath);
      }
    });
  }

  return (
    <div className="flex h-20 items-center px-5">
      {LOCALES.map((code, index) => (
        <span key={code} className="inline-flex items-center">
          {index > 0 ? <span className="select-none px-1 text-b5-label text-white/40">/</span> : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => selectLocale(code)}
            disabled={isPending}
            aria-pressed={code === locale}
            className={cn(
              "min-h-11 px-1 py-0 text-b5-label text-white hover:bg-transparent hover:text-white hover:not-disabled:scale-100",
              code === locale ? "font-bold opacity-100" : "opacity-60",
            )}
          >
            {code.toUpperCase()}
          </Button>
        </span>
      ))}
    </div>
  );
}
