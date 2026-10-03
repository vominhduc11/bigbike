"use client";

import Link from "@/i18n/StorefrontLink";
import { useLocale, useTranslations } from "next-intl";
import { NotFoundRecovery } from "@/components/layout/NotFoundRecovery";
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
    <NotFoundRecovery
      title={t("pageTitle")}
      description={t("description")}
      search={{
        action: toProductListPath(locale),
        fieldName: "q",
        formLabel: t("searchAriaLabel"),
        inputId: "storefront-404-search",
        inputLabel: t("searchInputAriaLabel"),
        placeholder: t("searchPlaceholder"),
        searchLabel: t("searchButton"),
      }}
      navigationLabel={t("navigationAriaLabel")}
      homeLink={<Link href={toHomePath(locale)}>{t("goHome")}</Link>}
      productsLink={<Link href={toProductListPath(locale)}>{t("browseProducts")}</Link>}
      articlesLink={<Link href={toArticleListPath(locale)}>{t("readNews")}</Link>}
    />
  );
}
