"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";

import { useAltSlug } from "@/components/i18n/AltSlugProvider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOCALES, type Locale } from "@/i18n/locale";
import { useMediaQueryChange } from "@/lib/hooks/useMediaQueryChange";
import { cn } from "@/lib/utils";
import {
  toArticlePath,
  toBrandPath,
  toCategoryPath,
  toProductPath,
  translatePath,
} from "@/lib/utils/routes";

const languageNames: Record<Locale, string> = { vi: "Tiếng Việt", en: "English" };

export function LanguageSwitch() {
  const t = useTranslations("Header");
  const locale = useLocale() as Locale;
  const altSlug = useAltSlug();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const closeOptions = useCallback(() => setOpen(false), []);

  useMediaQueryChange("(min-width: 768px)", closeOptions);

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
      if (targetPath) {
        const targetUrl = `${targetPath.split(/[?#]/)[0]}${suffix}`;
        // Điều hướng tài liệu giữ nguyên điểm neo khi đổi ngôn ngữ qua lại;
        // cache điều hướng có thể nối hash lần hai vào URL đã từng mở.
        if (window.location.hash) window.location.assign(targetUrl);
        else router.push(targetUrl);
      }
    });
  }

  return (
    <div
      data-language-switch
      role="group"
      aria-label={t("languageLabel")}
      aria-busy={isPending}
      className="flex h-full shrink-0 items-center md:px-1"
    >
      <Select
        value={locale}
        onValueChange={(value) => selectLocale(value as Locale)}
        open={open}
        onOpenChange={setOpen}
        disabled={isPending}
      >
        <SelectTrigger
          aria-label={t("languageLabel")}
          className="h-full min-h-11 w-16 gap-1 border-0 bg-transparent px-2 py-0 font-cta text-b4-action font-bold uppercase text-primary-foreground hover:bg-white/5 focus:shadow-none focus-visible:outline-2 focus-visible:outline-brand-on-dark focus-visible:-outline-offset-2 md:hidden [&>svg]:opacity-100"
        >
          <SelectValue>{locale.toUpperCase()}</SelectValue>
        </SelectTrigger>
        <SelectContent
          align="end"
          collisionPadding={16}
          aria-label={t("languageLabel")}
          className="border-white/20 bg-surface-dark text-primary-foreground"
        >
          {LOCALES.map((code) => (
            <SelectItem
              key={code}
              value={code}
              className="min-h-11 text-primary-foreground focus:bg-white/10 focus:text-primary-foreground [&_svg]:text-current"
            >
              <span lang={code}>{languageNames[code]}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="hidden h-full items-center md:flex">
        {LOCALES.map((code, index) => (
          <span key={code} className="inline-flex h-full items-center">
            {index > 0 ? (
              <span
                aria-hidden
                className="select-none px-0.5 font-cta text-b5-label text-[var(--bb-text-inverse-muted)]"
              >
                /
              </span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => selectLocale(code)}
              disabled={isPending}
              aria-label={languageNames[code]}
              aria-pressed={code === locale}
              className={cn(
                "h-full min-h-11 w-11 px-0 py-0 font-cta text-b4-action uppercase hover:bg-white/5 hover:text-primary-foreground hover:not-disabled:scale-100 focus-visible:outline-brand-on-dark focus-visible:-outline-offset-2",
                code === locale
                  ? "font-bold text-primary-foreground"
                  : "text-[var(--bb-text-inverse-muted)]",
              )}
            >
              {code.toUpperCase()}
            </Button>
          </span>
        ))}
      </div>
    </div>
  );
}
