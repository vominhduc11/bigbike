"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toSearchPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

export function DiscontinuedSearchForm() {
  const t = useTranslations("Product");
  const locale = useLocale() as Locale;

  return (
    <section aria-labelledby="discontinued-search-title" className="border-t border-border pt-8 md:pt-10">
      <h2 id="discontinued-search-title" className="m-0 font-body text-a3-section font-semibold leading-title text-foreground">
        {t("discontinuedSearchHeading")}
      </h2>
      <form action={toSearchPath(locale)} method="get" role="search" className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="discontinued-product-search" className="sr-only">{t("discontinuedSearchAriaLabel")}</label>
        <Input
          id="discontinued-product-search"
          name="s"
          type="search"
          required
          enterKeyHint="search"
          placeholder={t("discontinuedSearchPlaceholder")}
          aria-label={t("discontinuedSearchAriaLabel")}
          className="h-11 rounded-none border-border bg-white px-4 text-a4-content"
        />
        <Button type="submit" variant="primary" className="min-h-11 rounded-none px-6 font-cta text-b4-action font-bold uppercase">
          <Search className="size-4" aria-hidden="true" />
          {t("discontinuedSearchButton")}
        </Button>
      </form>
    </section>
  );
}
