"use client";

import { useLocale, useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { ZaloIcon } from "@/components/ui/ZaloIcon";
import type { BrandSummary } from "@/lib/contracts/public";
import type { Locale } from "@/i18n/locale";
import { toHomePath } from "@/lib/utils/routes";
import { zaloHref } from "@/lib/utils/format";

type DiscontinuedStatusPanelProps = {
  name: string;
  categorySlug?: string;
  categorySlugEn?: string | null;
  categoryName?: string;
  brand?: BrandSummary | null;
  brandName?: string | null;
  hasSuggestions: boolean;
  zaloUrl?: string;
};

export function DiscontinuedStatusPanel({
  name,
  categorySlug,
  categorySlugEn,
  categoryName,
  brand,
  brandName,
  hasSuggestions,
  zaloUrl,
}: DiscontinuedStatusPanelProps) {
  const t = useTranslations("Product");
  const locale = useLocale() as Locale;
  const displayBrandName = brand?.name ?? brandName ?? "";
  const equivalentHref = hasSuggestions
    ? "#discontinued-suggestions"
    : categorySlug
      ? undefined
      : toHomePath(locale);

  return (
    <section
      aria-labelledby="discontinued-product-title"
      className="space-y-5 border border-border bg-card p-5 md:p-8"
      data-discontinued-status
    >
      <p className="m-0 inline-flex min-h-8 items-center border border-brand px-3 py-1.5 font-cta text-b5-label font-bold uppercase tracking-wide text-brand">
        {t("discontinuedLabel")}
      </p>
      <h1 id="discontinued-product-title" className="m-0 font-body text-a1-title font-semibold leading-title text-foreground">
        {name}
      </h1>
      <p className="m-0 text-a4-content leading-relaxed text-muted-foreground">{t("discontinuedDescription")}</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {equivalentHref ? (
          <Button asChild variant="primary" className="min-h-11 rounded-none px-5 py-3 font-cta text-b4-action font-bold uppercase">
            <a href={equivalentHref}>{t("discontinuedEquivalentLink")}</a>
          </Button>
        ) : categorySlug ? (
          <Button asChild variant="primary" className="min-h-11 rounded-none px-5 py-3 font-cta text-b4-action font-bold uppercase">
            <LocalizedLink kind="category" viSlug={categorySlug} enSlug={categorySlugEn}>
              {t("discontinuedEquivalentLink")}
            </LocalizedLink>
          </Button>
        ) : null}

        {zaloUrl ? (
          <Button asChild variant="outline" className="min-h-11 rounded-none border-2 border-zalo px-5 py-3 font-cta text-b4-action font-bold uppercase text-zalo hover:bg-zalo-soft hover:text-zalo">
            <a href={zaloHref(zaloUrl)} target="_blank" rel="noopener noreferrer">
              <ZaloIcon className="size-5 shrink-0" />
              {t("contact.zaloLink")}
            </a>
          </Button>
        ) : (
          <span className="inline-flex min-h-11 items-center gap-2 border border-border px-5 py-3 text-a5-meta text-muted-foreground">
            <MessageCircle className="size-4" aria-hidden="true" />
            {t("discontinuedContactUnavailable")}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-a5-meta text-muted-foreground">
        {displayBrandName ? (
          <span>
            {t("brand")}: {brand?.slug ? <LocalizedLink kind="brand" viSlug={brand.slug} className="font-semibold text-foreground underline-offset-4 hover:text-brand hover:underline">{displayBrandName}</LocalizedLink> : displayBrandName}
          </span>
        ) : null}
        {categorySlug ? (
          <span>
            {t("category")}: <LocalizedLink kind="category" viSlug={categorySlug} enSlug={categorySlugEn} className="font-semibold text-foreground underline-offset-4 hover:text-brand hover:underline">{categoryName || categorySlug}</LocalizedLink>
          </span>
        ) : null}
      </div>

      {categorySlug ? (
        <LocalizedLink kind="category" viSlug={categorySlug} enSlug={categorySlugEn} className="inline-flex min-h-11 items-center text-a4-content font-semibold text-foreground underline-offset-4 hover:text-brand hover:underline">
          {t("discontinuedCategoryLink")}
        </LocalizedLink>
      ) : null}
    </section>
  );
}
