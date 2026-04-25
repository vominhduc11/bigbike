import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { CatalogSortSelect } from "@/components/catalog/CatalogSortSelect";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { PRODUCT_SORT_VALUES, getCategoryBySlug, listBrands, listProducts } from "@/lib/api/public-api";
import { buildCatalogTitle } from "@/lib/utils/catalog";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import {
  buildQueryString,
  collectErrors,
  parseOptionalPositiveIntParam,
  parsePositiveIntParam,
  parseSlugParam,
  parseSortParam,
  parseTextParam,
  readSearchParamAlias,
  readSingleSearchParam,
} from "@/lib/utils/query";
import { toCategoryPath, toHomePath, toProductListPath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

type CategoryDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: CategoryDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: "Danh mục không hợp lệ",
      description: "Slug danh mục không hợp lệ.",
      canonicalPath: toCategoryPath("invalid"),
      noIndex: true,
    });
  }

  const categoryResult = await getCategoryBySlug(slug);
  const category = categoryResult.data;
  if (!category) {
    return buildPublicMetadata({
      title: "Không tìm thấy danh mục",
      description: "Không tìm thấy danh mục sản phẩm yêu cầu.",
      canonicalPath: toCategoryPath(slug),
      noIndex: true,
    });
  }

  const query = await searchParams;
  const page = Number(readSearchParamAlias(query, "page", "paged") ?? "1");
  const brand = readSearchParamAlias(query, "pwb-brand", "brand");
  const q = readSingleSearchParam(query.q);
  const gender = readSingleSearchParam(query.filter_gender);
  const color = readSingleSearchParam(query.filter_color);
  const minPrice = readSingleSearchParam(query.min_price);
  const maxPrice = readSingleSearchParam(query.max_price);

  return buildPublicMetadata({
    title: buildCatalogTitle(category.seo?.title ?? category.name, {
      page,
      gender,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      colorName: color,
    }),
    description: category.seo?.description ?? category.description ?? "Chi tiết danh mục sản phẩm BigBike.",
    canonicalPath: category.seo?.canonicalUrl ?? toCategoryPath(category.slug),
    noIndex:
      (category.seo?.noIndex ?? false) ||
      page > 1 ||
      Boolean(brand) ||
      Boolean(q) ||
      Boolean(gender) ||
      Boolean(color) ||
      Boolean(minPrice) ||
      Boolean(maxPrice),
  });
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: CategoryDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    notFound();
  }

  const pageParams = await searchParams;
  const pageParsed = parsePositiveIntParam(readSearchParamAlias(pageParams, "page", "paged"), {
    defaultValue: 1,
    min: 1,
    max: 999,
    field: "page",
  });
  const sizeParsed = parsePositiveIntParam(pageParams.size, {
    defaultValue: 24,
    min: 1,
    max: 100,
    field: "size",
  });
  const brandParsed = parseSlugParam(readSearchParamAlias(pageParams, "pwb-brand", "brand"), "pwb-brand");
  const qParsed = parseTextParam(pageParams.q, 100);
  const colorParsed = parseSlugParam(pageParams.filter_color, "filter_color");
  const genderParsed = parseSlugParam(pageParams.filter_gender, "filter_gender");
  const minPriceParsed = parseOptionalPositiveIntParam(pageParams.min_price, {
    min: 0,
    max: 1_000_000_000,
    field: "min_price",
  });
  const maxPriceParsed = parseOptionalPositiveIntParam(pageParams.max_price, {
    min: 0,
    max: 1_000_000_000,
    field: "max_price",
  });
  const sortParsed = parseSortParam(pageParams.sort, PRODUCT_SORT_VALUES, "createdAt:desc");

  const validationErrors = collectErrors(
    pageParsed.error,
    sizeParsed.error,
    brandParsed.error,
    qParsed.error,
    colorParsed.error,
    genderParsed.error,
    minPriceParsed.error,
    maxPriceParsed.error,
    sortParsed.error,
  );
  if (validationErrors.length > 0) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState title="Bộ lọc không hợp lệ" message={validationErrors.join(" ")} />
        </div>
      </section>
    );
  }

  const [categoryResult, productsResult, brandsResult] = await Promise.all([
    getCategoryBySlug(slug),
    listProducts({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: sortParsed.value,
      category: slug,
      brand: brandParsed.value,
      q: qParsed.value,
      filterColor: colorParsed.value,
      filterGender: genderParsed.value,
      minPrice: minPriceParsed.value,
      maxPrice: maxPriceParsed.value,
    }),
    listBrands({ page: 1, size: 100, sort: "name:asc" }),
  ]);

  if (!categoryResult.data && categoryResult.error?.status === 404) {
    notFound();
  }

  if (!categoryResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={categoryResult.error?.message ?? "Không tải được thông tin danh mục."} />
        </div>
      </section>
    );
  }

  const category = categoryResult.data;
  const canonicalPath = category.seo?.canonicalUrl ?? toCategoryPath(category.slug);

  const categoryName = safeText(category.name, "Danh mục");
  const pagination = productsResult.pagination;
  const currentFilters = {
    q: qParsed.value,
    brand: brandParsed.value,
    color: colorParsed.value,
    gender: genderParsed.value,
    minPrice: minPriceParsed.value,
    maxPrice: maxPriceParsed.value,
    sort: sortParsed.value,
  };

  return (
    <>
      <div className="wp-breadcrumb">
        <Link href={toHomePath()}>Trang chủ</Link>
        <span className="sep">/</span>
        <Link href={toProductListPath()}>Sản phẩm</Link>
        <span className="sep">/</span>
        <span>{categoryName}</span>
      </div>

      <div className="wp-page-head">
        <span className="kicker">Danh mục sản phẩm</span>
        <h1>{categoryName}</h1>
        {category.description && (
          <p style={{ color: "var(--bb-text-muted)", marginTop: 8, fontSize: 14 }}>{category.description}</p>
        )}
      </div>

      <div className="wp-cat-layout">
        <CatalogFilters
          brands={brandsResult.data}
          current={currentFilters}
          resetHref={canonicalPath}
        />

        <div>
          <div className="wp-catalog-head">
            <div className="wp-catalog-count">
              {productsResult.data.length > 0 && pagination ? (
                <>
                  Hiển thị{" "}
                  <b>
                    {(pagination.page - 1) * pagination.pageSize + 1}–
                    {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)}
                  </b>{" "}
                  / {pagination.totalItems} sản phẩm
                </>
              ) : null}
            </div>
            <CatalogSortSelect current={sortParsed.value ?? "createdAt:desc"} />
          </div>

          {productsResult.error && productsResult.data.length === 0 ? (
            <ErrorState message={productsResult.error.message} retryHref={canonicalPath} />
          ) : productsResult.data.length === 0 ? (
            <EmptyState
              title="Danh mục chưa có sản phẩm"
              description="Danh mục này hiện tại chưa có sản phẩm được đăng."
            />
          ) : (
            <>
              <div className="wp-product-grid">
                {productsResult.data.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {pagination ? (
                <PaginationNav
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  makeHref={(nextPage) =>
                    `${canonicalPath}${buildQueryString({
                      page: nextPage,
                      size: sizeParsed.value,
                      sort: sortParsed.value,
                      "pwb-brand": brandParsed.value,
                      q: qParsed.value,
                      filter_color: colorParsed.value,
                      filter_gender: genderParsed.value,
                      min_price: minPriceParsed.value,
                      max_price: maxPriceParsed.value,
                    })}`
                  }
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
