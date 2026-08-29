"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useTransition } from "react";

import { useAltSlug } from "@/components/i18n/AltSlugProvider";
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

export function LanguageSwitch({
  variant = "storefront",
}: { variant?: "storefront" | "auth" } = {}) {
  const locale = useLocale() as Locale;
  const altSlug = useAltSlug();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  if (pathname?.startsWith("/preview")) return null;

  function selectLocale(next: Locale) {
    if (next === locale || isPending) return;
    startTransition(() => {
      const suffix = `${window.location.search}${window.location.hash}`;
      let targetPath: string | null = null;
      if (altSlug) {
        const slug = next === "en" ? altSlug.enSlug || altSlug.viSlug : altSlug.viSlug;
        if (altSlug.kind === "product") targetPath = toProductPath(slug, next);
        else if (altSlug.kind === "category") targetPath = toCategoryPath(slug, next);
        else if (altSlug.kind === "brand") targetPath = toBrandPath(altSlug.viSlug, next);
        else if (altSlug.kind === "article") targetPath = toArticlePath(slug, next);
      } else if (pathname) {
        targetPath = translatePath(pathname, next);
      }
      if (targetPath) router.push(`${targetPath.split(/[?#]/)[0]}${suffix}`);
    });
  }

  return (
    <div
      data-language-switch
      data-auth-language-switch={variant === "auth" ? true : undefined}
      className="flex h-full shrink-0 items-center px-1"
    >
      {LOCALES.map((code, index) => (
        <span key={code} className="inline-flex items-center">
          {index > 0 ? (
            <span className="select-none px-0.5 font-cta text-b5-label uppercase text-primary-foreground/40">
              /
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => selectLocale(code)}
            disabled={isPending}
            aria-pressed={code === locale}
            className={cn(
              "h-full! min-h-0! w-11! min-w-11! px-0! py-0 font-cta text-b4-action uppercase text-primary-foreground hover:bg-transparent hover:text-primary-foreground hover:not-disabled:scale-100",
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
