"use client";

import { useTranslations } from "next-intl";

import { sanitizeRichHtml } from "@/lib/utils/html";

export function DiscontinuedTrustStrip({ html }: { html?: string | null }) {
  const t = useTranslations("Product");
  const safeHtml = html?.trim() ? sanitizeRichHtml(html, { allowInlineStyles: true }) : "";

  return (
    <div className="border-y border-border py-4 text-a5-meta text-muted-foreground" aria-label={t("discontinuedTrustAriaLabel")}>
      {safeHtml ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 [&_*]:m-0 [&_*]:leading-normal [&_a]:text-inherit!" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span>{t("discontinuedTrustNationwide")}</span>
          <span aria-hidden="true">·</span>
          <span>{t("discontinuedTrustCod")}</span>
          <span aria-hidden="true">·</span>
          <span>{t("discontinuedTrustGenuine")}</span>
          <span aria-hidden="true">·</span>
          <span>{t("discontinuedTrustWarranty")}</span>
          <span aria-hidden="true">·</span>
          <span>{t("discontinuedTrustFreeShipping")}</span>
        </div>
      )}
    </div>
  );
}

