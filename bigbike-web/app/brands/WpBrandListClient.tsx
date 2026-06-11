"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { WpCategoryPagination } from "@/components/wp/WpCategoryPagination";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublicBrandList } from "@/lib/api/client-api";
import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { buildQueryString } from "@/lib/utils/query";
import { toBrandListPath, toBrandPath } from "@/lib/utils/routes";

/* eslint-disable @next/next/no-img-element */

const DEFAULT_PAGE_SIZE = 12;
const DEFAULT_SORT = "name:asc";

/**
 * Lưới thương hiệu CSR — trang /brands render shell tĩnh (hero), danh sách hãng
 * (phân trang/sắp xếp theo searchParams) fetch ở CLIENT → trang không SSR.
 */
export function WpBrandListClient() {
  const searchParams = useSearchParams();
  const locale = useLocale();

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

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["public-brands", { page, size, sort, lang: locale }],
    queryFn: () => fetchPublicBrandList({ page, size, sort, lang: locale }),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const brands = data?.data ?? [];
  const pagination = data?.pagination ?? null;

  const paginationBaseHref = `${toBrandListPath()}${buildQueryString({
    size: size !== DEFAULT_PAGE_SIZE ? size : undefined,
    sort: sort !== DEFAULT_SORT ? sort : undefined,
  })}`;

  if (isLoading && brands.length === 0) {
    // Skeleton lần tải đầu — giữ lưới, tránh layout shift.
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex h-full flex-col items-center justify-between gap-4 border border-neutral-200 bg-white p-5">
            <Skeleton className="h-16 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ))}
      </div>
    );
  }

  if (brands.length === 0) {
    const notice = isError
      ? (error instanceof Error ? error.message : "Không tải được danh sách thương hiệu.")
      : "Danh sách thương hiệu hiện đang rỗng.";
    return <p className="woocommerce-info">{notice}</p>;
  }

  return (
    <>
      {/* Lưới card đồng đều: ô bằng nhau, logo căn giữa trong khung cố định 64px
          (object-contain), tên hãng dưới đáy. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {brands.map((brand) => {
          const name = safeText(brand.name, "Thương hiệu");
          const logoUrl = toLegacyWpMediaUrl(resolveMediaUrl(brand.logo?.url?.trim()));
          const href = toBrandPath(brand.slug);
          const initials = name.replace(/[^A-Za-zÀ-ỹ]/g, "").slice(0, 2).toUpperCase();
          return (
            <Link
              key={brand.id}
              href={href}
              title={name}
              className="group flex h-full flex-col items-center justify-between gap-4 border border-neutral-200 bg-white p-5 no-underline transition-colors hover:border-neutral-900"
            >
              <span className="flex h-16 w-full items-center justify-center">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={brand.logo?.alt ?? name}
                    className="max-h-16 w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <span className="text-2xl font-bold tracking-wide text-neutral-300">{initials}</span>
                )}
              </span>
              <span className="text-center text-sm font-semibold uppercase tracking-wide text-neutral-800">
                {name}
              </span>
            </Link>
          );
        })}
      </div>
      {pagination ? (
        <WpCategoryPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          baseHref={paginationBaseHref}
        />
      ) : null}
    </>
  );
}
