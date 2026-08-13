"use client";

import { useMemo, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { fetchPublicProductList, type PublicProductListResult } from "@/lib/api/client-api";
import { DEFAULT_PRODUCT_PAGE_SIZE, DEFAULT_PRODUCT_SORT } from "@/lib/constants/catalog";
import { parseCatalogListParams } from "@/lib/utils/catalog-list-params";
import { DEFAULT_CATALOG_ORDERBY } from "@/lib/utils/catalog-sort";
import { CatalogResults } from "@/components/catalog/CatalogResults";
import { CatalogSidebar } from "@/components/catalog/CatalogSidebar";
import type { Brand, CatalogFacets, Category, Product } from "@/lib/contracts/public";

/**
 * Lưới sản phẩm CSR dùng chung cho các trang archive (/danh-muc/[slug],
 * /sp, /tim-kiem, /brands/[slug]). Trang chỉ render shell tĩnh (ISR theo
 * slug/tag); component này đọc searchParams ở CLIENT và fetch danh sách lọc/phân
 * trang qua React Query → đổi filter/sort/trang chỉ refetch client, KHÔNG SSR.
 *
 * Sidebar (facets) + sort + pagination vẫn dùng href-based (đổi URL) → điều hướng
 * client-side cùng route → useSearchParams cập nhật → query refetch.
 */
export type CatalogClientProps = {
  canonicalPath: string;
  brands: Brand[];
  categories: Category[];
  facets?: CatalogFacets | null;
  /** HTML mô tả (đã sanitize) render ngay trên lưới — vd mô tả danh mục. */
  beforeGridHtml?: string | null;
  /** Node mô tả render trên lưới — ưu tiên hơn beforeGridHtml; dùng cho mô tả dịch được (LHtml). */
  beforeGridNode?: ReactNode;
  /** Trang danh mục: cố định category theo route (sidebar không đọc category param). */
  routeCategorySlug?: string;
  /** Trang thương hiệu: cố định brand theo route. */
  routeBrandSlug?: string;
  /** Trang /sp, /tim-kiem: cho phép đọc category từ query param. */
  includeCategoryParam?: boolean;
  /** Khoá đọc từ khoá tìm kiếm (vd /tim-kiem dùng ["s","q"]). */
  queryParamKeys?: string[];
  emptyNotice?: string;
  /** Trang /tim-kiem: chỉ fetch khi có từ khoá hợp lệ (tránh liệt kê toàn bộ sản phẩm). */
  requireQuery?: boolean;
  /** Thông báo khi requireQuery nhưng chưa nhập từ khoá. */
  emptyQueryNotice?: string;
  /**
   * Lưới sản phẩm trang mặc định (page 1, sort mặc định, chưa lọc) fetch sẵn ở SERVER
   * và truyền xuống → seed React Query để view mặc định nằm trong HTML server (SEO/ISR).
   * Khi khách lọc/sắp xếp/sang trang, query key đổi → client tự fetch như cũ.
   */
  initialProducts?: Product[];
  initialPagination?: PublicProductListResult["pagination"];
};

export function CatalogClient({
  canonicalPath,
  brands,
  categories,
  facets = null,
  beforeGridHtml = null,
  beforeGridNode,
  routeCategorySlug,
  routeBrandSlug,
  includeCategoryParam = false,
  queryParamKeys,
  emptyNotice,
  requireQuery = false,
  emptyQueryNotice,
  initialProducts,
  initialPagination = null,
}: CatalogClientProps) {
  const searchParams = useSearchParams();
  const tCat = useTranslations("Catalog");
  // Thông báo rỗng/chưa nhập từ khoá: ưu tiên prop (nếu trang truyền), nếu không tự dịch
  // ở client để đổi ngôn ngữ — tránh phụ thuộc chuỗi `vi` render sẵn ở server.
  const emptyText = emptyNotice ?? tCat("noResults");
  const emptyQueryText = emptyQueryNotice ?? tCat("enterKeywordToSearch");
  // Ngôn ngữ nội dung hiện tại — khi khách đổi sang EN, đưa lang vào query (và query key)
  // để React Query refetch lưới theo ngôn ngữ. Server vẫn render tĩnh vi (ISR).
  const locale = useLocale();

  const catalog = useMemo(() => {
    const params: Record<string, string | string[]> = {};
    searchParams.forEach((value, key) => {
      const previous = params[key];
      params[key] = previous === undefined
        ? value
        : Array.isArray(previous)
          ? [...previous, value]
          : [previous, value];
    });
    return parseCatalogListParams(params, { includeCategoryParam, queryParamKeys });
  }, [searchParams, includeCategoryParam, queryParamKeys]);

  const productQuery = useMemo(
    () => ({
      page: catalog.page,
      size: catalog.size,
      sort: catalog.productSort,
      category: routeCategorySlug ?? catalog.filters.category,
      brand: routeBrandSlug ?? catalog.filters.brand,
      q: catalog.filters.q,
      filterColor: catalog.filters.color,
      filterGender: catalog.filters.gender,
      minPrice: catalog.filters.minPrice,
      maxPrice: catalog.filters.maxPrice,
      lang: locale,
    }),
    [catalog, routeCategorySlug, routeBrandSlug, locale],
  );

  const hasValidationErrors = catalog.validationErrors.length > 0;
  const hasQuery = Boolean(catalog.filters.q?.trim());
  const blockedByEmptyQuery = requireQuery && !hasQuery;

  // View mặc định = page 1, sort mặc định, chưa áp filter nào (route category/brand
  // cố định theo trang nên không tính). Chỉ khi đó mới seed initialProducts từ server
  // — query key khớp lần render đầu nên HTML server có sẵn lưới, không lệch hydrate.
  // CHỈ seed cho key `vi` (bản server render): nếu seed cả key `en`, react-query coi
  // dữ liệu VI là "fresh" suốt staleTime và không refetch → lưới kẹt tiếng Việt sau
  // khi khách đổi ngôn ngữ (AUD-014, cùng pattern ProductView).
  const isDefaultView =
    !hasValidationErrors &&
    catalog.page === 1 &&
    catalog.size === DEFAULT_PRODUCT_PAGE_SIZE &&
    catalog.productSort === DEFAULT_PRODUCT_SORT &&
    !catalog.filters.q &&
    !catalog.filters.category &&
    !catalog.filters.brand &&
    !catalog.filters.color &&
    catalog.filters.gender.length === 0 &&
    catalog.filters.minPrice === undefined &&
    catalog.filters.maxPrice === undefined;
  const initialData =
    isDefaultView && initialProducts
      ? { data: initialProducts, pagination: initialPagination }
      : undefined;

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["catalog-products", productQuery],
    queryFn: () => fetchPublicProductList(productQuery),
    enabled: !hasValidationErrors && !blockedByEmptyQuery,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
    initialData,
    // Server vừa fetch xong → coi là tươi, tránh refetch lặp ngay sau khi hydrate.
    initialDataUpdatedAt: initialData ? () => Date.now() : undefined,
  });

  const products = blockedByEmptyQuery ? [] : (data?.data ?? []);
  const pagination = blockedByEmptyQuery ? null : (data?.pagination ?? null);

  // Lần tải đầu (chưa có data) → để CatalogResults hiện skeleton (tránh layout shift),
  // không hiện notice "Đang tải". Các lần đổi filter/trang giữ data cũ (placeholderData)
  // nên không bị nháy.
  const firstLoading = isLoading && !hasValidationErrors && !blockedByEmptyQuery;
  // Đã có data cũ hiển thị (placeholderData) nhưng vẫn đang fetch bản mới sau khi
  // đổi filter/sort/trang → báo hiệu "đang cập nhật" thay vì im lặng đợi rồi tự đổi.
  const isRefetching = isFetching && !firstLoading;
  const notice = hasValidationErrors
    ? catalog.validationErrors.join(" ")
    : blockedByEmptyQuery
      ? emptyQueryText
      : isError
        ? tCat("categoryLoadFailed")
        : firstLoading
          ? null
          : products.length === 0
            ? emptyText
            : null;

  const paginationBaseHref = catalog.buildPaginationHref(canonicalPath);

  return (
    // pb-40: chừa khoảng thở trước footer cho CẢ hai cột. Cột kết quả vốn có pb-40 nội
    // bộ (lưới→phân trang) nhưng sau phân trang/sidebar không có đệm; khi cột bộ lọc cao
    // hơn lưới (vd trang lọc ít sản phẩm) nó dính sát footer. Đặt ở .row dùng chung nên
    // áp cho cả 4 trang archive (san-pham/tim-kiem/danh-muc/brands).
    <div className="grid gap-8 pb-10 md:grid-cols-[minmax(220px,1fr)_3fr]">
      <CatalogSidebar
        brands={brands}
        categories={categories}
        facets={facets}
        current={catalog.currentFilters}
        resetHref={canonicalPath}
        hiddenParams={{
          orderby: catalog.orderbyCurrent !== DEFAULT_CATALOG_ORDERBY ? catalog.orderbyCurrent : undefined,
        }}
      />
      <CatalogResults
        orderbyCurrent={catalog.orderbyCurrent}
        pagination={pagination}
        products={products}
        notice={notice}
        isLoading={firstLoading}
        isRefetching={isRefetching}
        beforeGrid={
          beforeGridNode ??
          (beforeGridHtml ? <div className="mb-8 [&_p]:mb-4" dangerouslySetInnerHTML={{ __html: beforeGridHtml }} /> : null)
        }
        paginationBaseHref={paginationBaseHref}
      />
    </div>
  );
}
