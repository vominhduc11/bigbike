"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  fetchPublicCatalogFacets,
  fetchPublicProductList,
  type PublicProductListResult,
} from "@/lib/api/client-api";
import { parseCatalogListParams } from "@/lib/utils/catalog-list-params";
import { DEFAULT_CATALOG_ORDERBY } from "@/lib/utils/catalog-sort";
import { normalizePriceSelection } from "@/lib/utils/catalog-price-filter";
import { buildQueryString } from "@/lib/utils/query";
import { CatalogResults } from "@/components/catalog/CatalogResults";
import { CatalogSidebar } from "@/components/catalog/CatalogSidebar";
import { CatalogFilterChips } from "@/components/catalog/CatalogFilterChips";
import type { CatalogFacets, Product } from "@/lib/contracts/public";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { useMediaQueryChange } from "@/lib/hooks/useMediaQueryChange";
import { BB_BREAKPOINTS } from "@/lib/ui/breakpoints";
import {
  clearCatalogFilters,
  countCatalogFilters,
  removeCatalogFilter,
  type CatalogFilterState,
} from "@/lib/utils/catalog-filter-state";

/**
 * Lưới sản phẩm CSR dùng chung cho các trang archive (/danh-muc/[slug],
 * /sp, /tim-kiem, /brands/[slug]). Trang chỉ render shell tĩnh (ISR theo
 * slug/tag); component này đọc searchParams ở CLIENT và fetch danh sách lọc/phân
 * trang qua React Query → đổi filter/sort/trang chỉ refetch client, KHÔNG SSR.
 *
 * Server truyền đúng dữ liệu của URL hiện tại để đường dẫn lọc mở thẳng không chớp
 * danh sách chưa lọc. Sau hydrate, sidebar/sort/pagination cập nhật URL tại client và
 * React Query gộp các thao tác liên tiếp bằng khoảng hoãn ngắn trước khi gọi lại.
 */
export type CatalogClientProps = {
  canonicalPath: string;
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
   * Lưới sản phẩm khớp chính xác URL hiện tại được fetch sẵn ở SERVER và truyền xuống
   * để nội dung đầu tiên luôn đúng. Khi khách lọc/sắp xếp/sang trang, client tiếp quản.
   */
  initialProducts?: Product[];
  initialPagination?: PublicProductListResult["pagination"];
};

export function CatalogClient({
  canonicalPath,
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
  const [mobileOpen, setMobileOpen] = useState(false);

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
  const [mobileDraft, setMobileDraft] = useState<CatalogFilterState>(catalog.currentFilters);
  const mobileDraftRef = useRef(mobileDraft);
  const mobileOpenRef = useRef(mobileOpen);
  const updateMobileDraft = useCallback((next: CatalogFilterState) => {
    mobileDraftRef.current = next;
    setMobileDraft(next);
  }, []);

  const productQuery = useMemo(
    () => ({
      page: catalog.page,
      size: catalog.size,
      sort: catalog.productSort,
      category: routeCategorySlug ?? catalog.filters.category,
      brand: routeBrandSlug ? [routeBrandSlug] : catalog.filters.brand,
      q: catalog.filters.q,
      filterColor: catalog.filters.color,
      filterFinish: catalog.filters.finish,
      filterGender: catalog.filters.gender,
      sizeFilter: catalog.filters.size,
      minPrice: catalog.filters.minPrice,
      maxPrice: catalog.filters.maxPrice,
      inStock: catalog.filters.inStock,
      lang: locale,
    }),
    [catalog, routeCategorySlug, routeBrandSlug, locale],
  );
  const debouncedProductQuery = useDebounce(productQuery, 250);

  const hasValidationErrors = catalog.validationErrors.length > 0;
  const hasQuery = Boolean(catalog.filters.q?.trim());
  const blockedByEmptyQuery = requireQuery && !hasQuery;

  const [initialProductKey] = useState(() => JSON.stringify(productQuery));
  const initialData = initialProducts && JSON.stringify(debouncedProductQuery) === initialProductKey
    ? { data: initialProducts, pagination: initialPagination }
    : undefined;

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["catalog-products", debouncedProductQuery],
    queryFn: ({ signal }) => fetchPublicProductList(debouncedProductQuery, signal),
    enabled: !hasValidationErrors && !blockedByEmptyQuery,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
    initialData,
    // Server vừa fetch xong → coi là tươi, tránh refetch lặp ngay sau khi hydrate.
    initialDataUpdatedAt: initialData ? () => Date.now() : undefined,
  });

  const facetState = mobileOpen ? mobileDraft : catalog.currentFilters;
  const facetQuery = useMemo(
    () => ({
      category: routeCategorySlug ?? facetState.category,
      brand: routeBrandSlug ? [routeBrandSlug] : facetState.brand,
      q: facetState.q,
      filterColor: facetState.color,
      filterFinish: facetState.finish,
      filterGender: facetState.gender,
      sizeFilter: facetState.size,
      minPrice: facetState.minPrice,
      maxPrice: facetState.maxPrice,
      inStock: facetState.inStock,
      lang: locale,
    }),
    [facetState, routeCategorySlug, routeBrandSlug, locale],
  );
  const debouncedFacetQuery = useDebounce(facetQuery, 250);
  const [initialFacetKey] = useState(() => JSON.stringify(facetQuery));
  const initialFacetData = facets && JSON.stringify(debouncedFacetQuery) === initialFacetKey
    ? { data: facets }
    : undefined;
  const { data: facetData } = useQuery({
    queryKey: ["catalog-facets", debouncedFacetQuery],
    queryFn: ({ signal }) => fetchPublicCatalogFacets(debouncedFacetQuery, signal),
    enabled: !hasValidationErrors && !blockedByEmptyQuery,
    staleTime: 60 * 1000,
    initialData: initialFacetData,
    initialDataUpdatedAt: initialFacetData ? () => Date.now() : undefined,
  });
  const activeFacets = facetData?.data ?? facets;

  useEffect(() => {
    // Server facets are only safe for the unfiltered initial view. A filtered
    // route waits for its own context before normalizing a legacy price URL.
    if (mobileOpen) return;
    const facetPayload = facetData?.data ?? facets;
    if (!facetPayload) return;

    const normalized = normalizePriceSelection(
      facetPayload.priceRange,
      catalog.filters.minPrice,
      catalog.filters.maxPrice,
    );
    const nextParams = new URLSearchParams(searchParams.toString());
    if (catalog.filters.color.length > 0 && Array.isArray(facetPayload.resolvedColorKeys)) {
      const requested = [...catalog.filters.color].sort().join(",");
      const resolved = [...facetPayload.resolvedColorKeys].sort().join(",");
      if (requested !== resolved) {
        nextParams.delete("filter_color");
        facetPayload.resolvedColorKeys.forEach((key) => nextParams.append("filter_color", key));
      }
    }
    if (!normalized) {
      nextParams.delete("min_price");
      nextParams.delete("max_price");
    } else {
      if (normalized.queryMinPrice == null) nextParams.delete("min_price");
      else nextParams.set("min_price", String(normalized.queryMinPrice));
      if (normalized.queryMaxPrice == null) nextParams.delete("max_price");
      else nextParams.set("max_price", String(normalized.queryMaxPrice));
    }

    const query = nextParams.toString();
    const target = `${canonicalPath}${query ? `?${query}` : ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (target !== currentUrl) window.history.replaceState(null, "", target);
  }, [canonicalPath, catalog.filters.color, catalog.filters.maxPrice, catalog.filters.minPrice, facetData?.data, facets, mobileOpen, searchParams]);

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
  const hasSizeEmptyState = catalog.filters.size.length > 0
    && !hasValidationErrors
    && !blockedByEmptyQuery
    && !isError
    && !firstLoading
    && products.length === 0;
  const resolvedNotice = hasSizeEmptyState
    ? tCat("sizeNoResults", { size: catalog.filters.size.join(", ") })
    : notice;

  const clearSizeHref = `${canonicalPath}${buildQueryString({
    orderby: catalog.orderbyCurrent !== DEFAULT_CATALOG_ORDERBY ? catalog.orderbyCurrent : undefined,
    ...(includeCategoryParam ? { category: catalog.filters.category } : {}),
    "pwb-brand": catalog.filters.brand,
    q: catalog.filters.q,
    filter_color: catalog.filters.color,
    filter_finish: catalog.filters.finish,
    filter_gender: catalog.filters.gender,
    min_price: catalog.filters.minPrice,
    max_price: catalog.filters.maxPrice,
    in_stock: catalog.filters.inStock ? "true" : undefined,
  })}`;

  const paginationBaseHref = catalog.buildPaginationHref(canonicalPath);

  const hrefForState = useCallback((state: CatalogFilterState) => {
    return `${canonicalPath}${buildQueryString({
      size: catalog.size,
      orderby: catalog.orderbyCurrent !== DEFAULT_CATALOG_ORDERBY ? catalog.orderbyCurrent : undefined,
      ...(includeCategoryParam ? { category: state.category } : {}),
      "pwb-brand": state.brand.length ? state.brand : undefined,
      q: state.q,
      filter_color: state.color.length ? state.color : undefined,
      filter_finish: state.finish.length ? state.finish : undefined,
      filter_gender: state.gender,
      "kich-co": state.size.length ? state.size : undefined,
      min_price: state.minPrice,
      max_price: state.maxPrice,
      in_stock: state.inStock ? "true" : undefined,
    })}`;
  }, [canonicalPath, catalog.orderbyCurrent, catalog.size, includeCategoryParam]);

  const commitState = useCallback((state: CatalogFilterState) => {
    const target = hrefForState(state);
    const current = `${window.location.pathname}${window.location.search}`;
    if (target !== current) window.history.pushState(null, "", target);
  }, [hrefForState]);

  function handleMobileOpenChange(open: boolean) {
    if (open) updateMobileDraft(catalog.currentFilters);
    mobileOpenRef.current = open;
    setMobileOpen(open);
  }

  const handleMobileApply = useCallback(() => {
    const scrollY = window.scrollY;
    commitState(mobileDraftRef.current);
    mobileOpenRef.current = false;
    setMobileOpen(false);
    requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
  }, [commitState]);

  const applyMobileFiltersAtDesktop = useCallback(() => {
    if (mobileOpenRef.current) handleMobileApply();
  }, [handleMobileApply]);

  useMediaQueryChange(`(min-width: ${BB_BREAKPOINTS.md}px)`, applyMobileFiltersAtDesktop);

  const activeFilterCount = countCatalogFilters(catalog.currentFilters);
  const activeFilterChips = (
    <CatalogFilterChips
      current={catalog.currentFilters}
      facets={activeFacets}
      onRemove={(token) => commitState(removeCatalogFilter(catalog.currentFilters, token))}
      onClear={() => commitState(clearCatalogFilters(catalog.currentFilters))}
    />
  );

  return (
    // pb-40: chừa khoảng thở trước footer cho CẢ hai cột. Cột kết quả vốn có pb-40 nội
    // bộ (lưới→phân trang) nhưng sau phân trang/sidebar không có đệm; khi cột bộ lọc cao
    // hơn lưới (vd trang lọc ít sản phẩm) nó dính sát footer. Đặt ở .row dùng chung nên
    // áp cho cả 4 trang archive (san-pham/tim-kiem/danh-muc/brands).
    <div className="grid gap-8 pb-10 md:grid-cols-[minmax(220px,1fr)_3fr]">
      <CatalogSidebar
        facets={activeFacets}
        current={catalog.currentFilters}
        mobileCurrent={mobileDraft}
        resetHref={canonicalPath}
        hiddenParams={{
          orderby: catalog.orderbyCurrent !== DEFAULT_CATALOG_ORDERBY ? catalog.orderbyCurrent : undefined,
        }}
        mobileOpen={mobileOpen}
        onMobileOpenChange={handleMobileOpenChange}
        onMobileChange={updateMobileDraft}
        onMobileApply={handleMobileApply}
        hideBrandFilter={Boolean(routeBrandSlug)}
      />
      <CatalogResults
        orderbyCurrent={catalog.orderbyCurrent}
        pagination={pagination}
        products={products}
        notice={resolvedNotice}
        emptyActionHref={hasSizeEmptyState ? clearSizeHref : null}
        emptyActionLabel={hasSizeEmptyState ? tCat("clearFilters") : null}
        isLoading={firstLoading}
        isRefetching={isRefetching}
        activeFilterCount={activeFilterCount}
        activeFilters={activeFilterChips}
        beforeGrid={
          beforeGridNode ??
            (beforeGridHtml ? <div className="mb-8 [&_p]:mb-4" dangerouslySetInnerHTML={{ __html: beforeGridHtml }} /> : null)
        }
        paginationBaseHref={paginationBaseHref}
      />
    </div>
  );
}
