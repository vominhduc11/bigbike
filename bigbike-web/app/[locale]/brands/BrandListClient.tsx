"use client";

import { useMemo } from "react";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/locale";
import { fetchPublicBrandList, type PublicBrandListResult } from "@/lib/api/client-api";
import type { Brand } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { buildQueryString } from "@/lib/utils/query";
import { toBrandListPath } from "@/lib/utils/routes";

/* eslint-disable @next/next/no-img-element */

const DEFAULT_PAGE_SIZE = 12;
const DEFAULT_SORT = "name:asc";

/**
 * Lưới thương hiệu — view mặc định (trang 1, sắp xếp mặc định) fetch sẵn ở server và
 * truyền xuống làm initialData → nằm trong HTML server (SEO). Khi khách sang trang/đổi
 * sắp xếp (searchParams) hoặc đổi ngôn ngữ, client tiếp quản fetch.
 */
export function BrandListClient({
  initialBrands,
  initialPagination = null,
}: {
  initialBrands?: Brand[];
  initialPagination?: PublicBrandListResult["pagination"];
} = {}) {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations("Catalog");

  const { page, size, sort } = useMemo(() => {
    const pageNum = Number(searchParams.get("paged") ?? searchParams.get("page") ?? "1");
    const sizeNum = Number(searchParams.get("size") ?? `${DEFAULT_PAGE_SIZE}`);
    const sortRaw = searchParams.get("sort")?.trim();
    return {
      page: Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1,
      size: Number.isFinite(sizeNum) && sizeNum >= 1 ? Math.floor(sizeNum) : DEFAULT_PAGE_SIZE,
      sort: sortRaw || DEFAULT_SORT,
    };
  }, [searchParams]);

  const isDefaultView = page === 1 && size === DEFAULT_PAGE_SIZE && sort === DEFAULT_SORT;
  // Chỉ seed initialData cho key `vi` — seed cả key `en` sẽ ghim dữ liệu VI "fresh"
  // suốt staleTime và không refetch khi khách đổi ngôn ngữ (AUD-014).
  const initialData =
    isDefaultView && initialBrands
      ? { data: initialBrands, pagination: initialPagination }
      : undefined;

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["public-brands", { page, size, sort, lang: locale }],
    queryFn: () => fetchPublicBrandList({ page, size, sort, lang: locale }),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
    initialData,
    initialDataUpdatedAt: initialData ? () => Date.now() : undefined,
  });

  const brands = data?.data ?? [];
  const pagination = data?.pagination ?? null;
  const firstLoading = isLoading && brands.length === 0;
  // Đã có thương hiệu (trang cũ) hiển thị nhưng đang fetch trang/sắp xếp mới — làm mờ +
  // báo hiệu thay vì im lặng đợi rồi tự đổi (giống lưới sản phẩm).
  const isRefetching = isFetching && !firstLoading;

  const paginationBaseHref = `${toBrandListPath(locale as Locale)}${buildQueryString({
    size: size !== DEFAULT_PAGE_SIZE ? size : undefined,
    sort: sort !== DEFAULT_SORT ? sort : undefined,
  })}`;

  if (firstLoading) {
    // Skeleton lần tải đầu — giữ lưới, tránh layout shift.
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex h-full flex-col items-center justify-between gap-4 border border-border bg-white p-5">
            <Skeleton className="h-16 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ))}
      </div>
    );
  }

  if (brands.length === 0) {
    const notice = isError
      ? t("brandListLoadFailed")
      : t("brandListEmpty");
    return <p className="border border-border bg-card p-4 text-a4-content text-muted-foreground">{notice}</p>;
  }

  return (
    <>
      {/* Lưới card đồng đều: ô bằng nhau, logo căn giữa trong khung cố định 64px
          (object-contain), tên hãng dưới đáy. */}
      <div className="relative">
        <div
          className={cn(
            "grid grid-cols-2 gap-3 transition-opacity duration-200 sm:grid-cols-3 lg:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7",
            isRefetching && "opacity-50",
          )}
          aria-busy={isRefetching || undefined}
        >
          {brands.map((brand) => {
            const name = safeText(brand.name, t("brandsTitle"));
            // Logo từ MinIO (same-origin), không hotlink web cũ (AGENTS.md §14.3).
            const logoUrl = resolveMediaUrl(brand.logo?.url?.trim());
            const initials = name.replace(/[^A-Za-zÀ-ỹ]/g, "").slice(0, 2).toUpperCase();
            return (
              <LocalizedLink
                key={brand.id}
                kind="brand"
                viSlug={brand.slug}
                title={name}
                className="group flex h-full flex-col items-center justify-between gap-4 border border-border bg-white p-5 no-underline transition-colors hover:border-foreground"
              >
                <span className="flex h-16 w-full items-center justify-center">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={brand.logo?.alt ?? name}
                      className="max-h-16 w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-a2-page font-bold tracking-wide text-muted-foreground">{initials}</span>
                  )}
                </span>
                <span className="text-center font-body text-a5-meta font-semibold text-foreground">
                  {name}
                </span>
              </LocalizedLink>
            );
          })}
        </div>
        {isRefetching ? (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-16" role="status">
            <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
            <span className="sr-only">{t("updating")}</span>
          </div>
        ) : null}
      </div>
      {pagination ? (
        <CatalogPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          baseHref={paginationBaseHref}
        />
      ) : null}
    </>
  );
}
