"use client";

import Link from "@/i18n/StorefrontLink";
import { useTranslations } from "next-intl";

export function SearchKeyboardHints({
  browseHref,
  handleClose,
}: {
  browseHref?: string;
  handleClose?: () => void;
}) {
  const t = useTranslations("Search");

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border bg-background px-3 py-2 font-body text-b5-label text-muted-foreground"
      data-search-keyboard-hints
    >
      <span>
        <kbd className="font-cta text-foreground">↑↓</kbd> {t("footerMove")}
      </span>
      <span>
        <kbd className="font-cta text-foreground">↵</kbd> {t("footerSelect")}
      </span>
      <span>
        <kbd className="font-cta text-foreground">{t("footerEscapeKey")}</kbd> {t("footerClose")}
      </span>
      {browseHref ? (
        <Link
          href={browseHref}
          className="text-brand-on-dark no-underline hover:underline"
          onClick={handleClose}
        >
          {t("footerBrowse")}
        </Link>
      ) : null}
    </div>
  );
}
