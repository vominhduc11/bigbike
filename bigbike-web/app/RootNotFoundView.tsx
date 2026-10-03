"use client";

/* Root 404 sits outside the locale provider, so full page-load anchors are intentional. */

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { SITE_CANVAS_CLASS } from "@/components/layout/Container";
import { NotFoundRecovery } from "@/components/layout/NotFoundRecovery";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/locale";
import { toArticleListPath, toHomePath, toProductListPath, toSearchPath } from "@/lib/utils/routes";

const COPY = {
  vi: {
    title: "Không tìm thấy trang",
    description:
      "Trang bạn đang tìm không tồn tại hoặc đã được chuyển đi. Hãy tìm sản phẩm hoặc chọn một lối đi bên dưới.",
    searchLabel: "Tìm kiếm",
    searchInputLabel: "Tìm sản phẩm hoặc thương hiệu",
    searchPlaceholder: "Tìm sản phẩm, thương hiệu…",
    navigationLabel: "Lối đi khác",
    home: "Về trang chủ",
    products: "Xem sản phẩm",
    articles: "Đọc tin tức",
    homeAriaLabel: "Trang chủ BigBike",
    switchLanguage: "Chuyển sang tiếng Anh",
  },
  en: {
    title: "Page not found",
    description:
      "The page you’re looking for doesn’t exist or has moved. Search for a product or choose a path below.",
    searchLabel: "Search",
    searchInputLabel: "Search for products or brands",
    searchPlaceholder: "Search products, brands…",
    navigationLabel: "Other destinations",
    home: "Go home",
    products: "Browse products",
    articles: "Read news",
    homeAriaLabel: "BigBike home",
    switchLanguage: "Switch to Vietnamese",
  },
} as const;

function localeFromPath(pathname: string): Locale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "vi";
}

export function RootNotFoundView() {
  const pathname = usePathname();
  const locale = localeFromPath(pathname);
  const copy = COPY[locale];
  const alternateLocale: Locale = locale === "en" ? "vi" : "en";

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `${copy.title} — BigBike`;
  }, [copy.title, locale]);

  const homePath = toHomePath(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="h-15 shrink-0 bg-black text-white md:h-20">
        <div
          className={`${SITE_CANVAS_CLASS} flex h-full items-center justify-between px-4 md:px-6`}
        >
          <a href={homePath} aria-label={copy.homeAriaLabel} className="flex min-h-11 items-center">
            <Image
              src="/brand/header-mark.png"
              alt="BigBike"
              width={120}
              height={44}
              priority
              className="h-auto w-28 md:w-37.5"
            />
          </a>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <a href={toHomePath(alternateLocale)} aria-label={copy.switchLanguage}>
              {alternateLocale.toUpperCase()}
            </a>
          </Button>
        </div>
      </header>

      <main id="main-content" className="flex flex-1 items-center px-6">
        <div className={SITE_CANVAS_CLASS}>
          <NotFoundRecovery
            title={copy.title}
            description={copy.description}
            search={{
              action: toSearchPath(locale),
              fieldName: "s",
              formLabel: copy.searchInputLabel,
              inputId: "root-404-search",
              inputLabel: copy.searchInputLabel,
              placeholder: copy.searchPlaceholder,
              searchLabel: copy.searchLabel,
            }}
            navigationLabel={copy.navigationLabel}
            homeLink={<a href={homePath}>{copy.home}</a>}
            productsLink={<a href={toProductListPath(locale)}>{copy.products}</a>}
            articlesLink={<a href={toArticleListPath(locale)}>{copy.articles}</a>}
          />
        </div>
      </main>

      <footer className="shrink-0 bg-black text-white">
        <div
          className={`${SITE_CANVAS_CLASS} flex min-h-16 items-center justify-center px-4 py-3 md:justify-start md:px-6`}
        >
          <a href={homePath} aria-label={copy.homeAriaLabel} className="flex min-h-11 items-center">
            <Image
              src="/brand/footer-wordmark.png"
              alt="BigBike"
              width={150}
              height={55}
              className="h-auto w-25 md:w-30"
            />
          </a>
        </div>
      </footer>
    </div>
  );
}
