"use client";

import Link from "@/i18n/StorefrontLink";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toArticleListPath, toHomePath, toProductListPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

/**
 * Form tìm kiếm + các nút điều hướng của trang 404 — client vì href/action phải
 * theo đúng locale hiện tại của khách (`useLocale()`); `NotFoundPage` là Server
 * Component luôn render "vi" tĩnh (xem i18n/request.ts) nên không tự đổi được.
 */
export function NotFoundActions() {
  const t = useTranslations("NotFound");
  const locale = useLocale() as Locale;

  return (
    <>
      <form
        action={toProductListPath(locale)}
        method="get"
        className="flex flex-col sm:flex-row w-full max-w-140 mx-auto border border-border overflow-hidden bg-card"
        role="search"
        aria-label={t("searchAriaLabel")}
      >
        <Input
          type="search"
          name="q"
          placeholder={t("searchPlaceholder")}
          className="flex-1 border-0 rounded-none bg-transparent h-12 min-h-0 text-a5-meta focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label={t("searchInputAriaLabel")}
        />
        <Button type="submit" variant="primary" className="rounded-none h-12 shrink-0 w-full sm:w-auto">
          {t("searchButton")}
        </Button>
      </form>

      <div className="flex flex-wrap gap-3 justify-center">
        <Button asChild variant="primary">
          <Link href={toHomePath(locale)}>{t("goHome")}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={toProductListPath(locale)}>{t("browseProducts")}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={toArticleListPath(locale)}>{t("readNews")}</Link>
        </Button>
      </div>
    </>
  );
}
