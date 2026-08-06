"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { ArticleCard } from "@/components/content/ArticleCard";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchPublicArticleList, type PublicArticleListResult } from "@/lib/api/client-api";
import type { Article } from "@/lib/contracts/public";
import { buildQueryString } from "@/lib/utils/query";
import { toArticleListPath } from "@/lib/utils/routes";
import { type Locale } from "@/i18n/locale";

const DEFAULT_PAGE_SIZE = 12;

export function ArticleListClient({
  initialArticles,
  initialPagination = null,
}: {
  initialArticles?: Article[];
  initialPagination?: PublicArticleListResult["pagination"];
}) {
  const searchParams = useSearchParams();
  const locale = useLocale() as Locale;
  const t = useTranslations("Blog");

  const { page, size, q } = useMemo(() => {
    const pageNum = Number(searchParams.get("paged") ?? searchParams.get("page") ?? "1");
    const sizeNum = Number(searchParams.get("size") ?? `${DEFAULT_PAGE_SIZE}`);
    return {
      page: Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1,
      size: Number.isFinite(sizeNum) && sizeNum >= 1 ? Math.floor(sizeNum) : DEFAULT_PAGE_SIZE,
      q: searchParams.get("q")?.trim() || undefined,
    };
  }, [searchParams]);

  const isDefaultView = page === 1 && size === DEFAULT_PAGE_SIZE && !q;
  // Chỉ seed initialData cho key `vi` — seed cả key `en` sẽ ghim dữ liệu VI "fresh"
  // suốt staleTime và không refetch khi khách đổi ngôn ngữ (AUD-014).
  const initialData =
    isDefaultView && initialArticles
      ? { data: initialArticles, pagination: initialPagination }
      : undefined;

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["public-articles", { page, size, q, lang: locale }],
    queryFn: () => fetchPublicArticleList({ page, size, q, lang: locale }),
    staleTime: 60 * 1000,
    placeholderData: (previous) => previous,
    initialData,
    initialDataUpdatedAt: initialData ? () => Date.now() : undefined,
  });

  const articles = data?.data ?? [];
  const pagination = data?.pagination ?? null;
  const showCategoryIntro = !q;
  const firstLoading = isLoading && articles.length === 0;
  const isRefetching = isFetching && !firstLoading;
  const makeListHref = (overrides: { size?: number }) => {
    const nextSize = overrides.size && overrides.size !== DEFAULT_PAGE_SIZE ? overrides.size : undefined;
    return `${toArticleListPath(locale)}${buildQueryString({ size: nextSize, q })}`;
  };

  const emptyNotice = isError
    ? t("listLoadFailed")
    : isLoading
      ? t("listLoading")
      : t("listEmpty");

  return (
    <>
      {showCategoryIntro ? (
        <div className="pb-15 text-a4-content leading-relaxed text-foreground">
          <p className="m-0 text-justify">{t("contentTop")}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        <div className="min-w-0 md:col-span-12">
          {firstLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="border border-border bg-card">
                  <Skeleton className="aspect-video w-full rounded-none" />
                  <div className="space-y-3 p-5 pt-8">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-5 w-11/12" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <p className="border border-border bg-card p-4 text-a4-content text-muted-foreground">{emptyNotice}</p>
          ) : (
            <>
              <div className="relative">
                <div
                  className={cn(
                    "grid grid-cols-1 gap-6 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3",
                    isRefetching && "opacity-50",
                  )}
                  aria-busy={isRefetching || undefined}
                >
                  {articles.map((article) => <ArticleCard key={article.id} article={article} />)}
                </div>
                {isRefetching ? (
                  <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-16" role="status">
                    <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
                    <span className="sr-only">{t("listLoading")}</span>
                  </div>
                ) : null}
              </div>

              {pagination ? (
                <CatalogPagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  baseHref={makeListHref({ size })}
                />
              ) : null}
            </>
          )}
        </div>
      </div>

      {showCategoryIntro ? (
        <div className="pb-15 pt-25 text-a4-content leading-relaxed text-foreground">
          <p className="m-0 text-justify">{t("contentBottom")}</p>
        </div>
      ) : null}
    </>
  );
}
