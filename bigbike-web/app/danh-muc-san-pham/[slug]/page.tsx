import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { CatalogSortSelect } from "@/components/catalog/CatalogSortSelect";
import { PageHero, type PageHeroBreadcrumbItem } from "@/components/layout/PageHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { PRODUCT_SORT_VALUES, getCategoryBySlug, listBrands, listCategories, listProducts } from "@/lib/api/public-api";
import { buildCatalogTitle } from "@/lib/utils/catalog";
import { buildCategoryBreadcrumbJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
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
import { sanitizeRichHtml } from "@/lib/utils/html";

// searchParams (filters, pagination, sort) make this page per-request dynamic.
// Data caching is handled at the fetch level in public-api.ts (revalidate: 3600 + tags).
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const result = await listCategories({ page: 1, size: 100 });
  return (result.data ?? []).map((c) => ({ slug: c.slug }));
}

const DEFAULT_SORT = "createdAt:desc";
const DEFAULT_PAGE_SIZE = 24;

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
  const color = readSingleSearchParam(query.filter_color);
  const minPrice = readSingleSearchParam(query.min_price);
  const maxPrice = readSingleSearchParam(query.max_price);

  return buildPublicMetadata({
    title: buildCatalogTitle(category.name, {
      page,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      colorName: color,
    }),
    description: category.description ?? "Chi tiết danh mục sản phẩm BigBike.",
    canonicalPath: toCategoryPath(category.slug),
    noIndex:
      page > 1 ||
      Boolean(brand) ||
      Boolean(q) ||
      Boolean(color) ||
      Boolean(minPrice) ||
      Boolean(maxPrice),
    ogImage: (category.image ?? category.icon)?.url ?? undefined,
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
    defaultValue: DEFAULT_PAGE_SIZE,
    min: 1,
    max: 100,
    field: "size",
  });
  const brandParsed = parseSlugParam(readSearchParamAlias(pageParams, "pwb-brand", "brand"), "pwb-brand");
  const qParsed = parseTextParam(pageParams.q, 100);
  const colorParsed = parseSlugParam(pageParams.filter_color, "filter_color");
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
  const sortParsed = parseSortParam(pageParams.sort, PRODUCT_SORT_VALUES, DEFAULT_SORT);

  const validationErrors = collectErrors(
    pageParsed.error,
    sizeParsed.error,
    brandParsed.error,
    qParsed.error,
    colorParsed.error,
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

  const [categoryResult, productsResult, brandsResult, allCategoriesResult] = await Promise.all([
    getCategoryBySlug(slug),
    listProducts({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: sortParsed.value,
      category: slug,
      brand: brandParsed.value,
      q: qParsed.value,
      filterColor: colorParsed.value,
      minPrice: minPriceParsed.value,
      maxPrice: maxPriceParsed.value,
    }),
    listBrands({ page: 1, size: 100, sort: "name:asc" }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc" }),
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
  const canonicalPath = toCategoryPath(category.slug);

  const allCategories = allCategoriesResult.data ?? [];
  const parentCategory = category.parentId
    ? (allCategories.find((c) => c.id === category.parentId) ?? null)
    : null;
  const childCategories = allCategories.filter((c) => c.parentId === category.id && c.isVisible);

  const breadcrumbJsonLd = serializeJsonLd(buildCategoryBreadcrumbJsonLd(category, parentCategory));

  const categoryName = safeText(category.name, "Danh mục");
  const pagination = productsResult.pagination;
  const currentFilters = {
    q: qParsed.value,
    brand: brandParsed.value,
    color: colorParsed.value,
    minPrice: minPriceParsed.value,
    maxPrice: maxPriceParsed.value,
    sort: sortParsed.value,
  };

  const heroImgAsset = category.image ?? category.icon;

  const rawDescription = category.description ?? null;
  const isHtmlDescription = rawDescription ? /<[a-z][\s\S]*>/i.test(rawDescription) : false;
  const heroDescription = isHtmlDescription
    ? rawDescription!.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim()
    : rawDescription;

  const heroBreadcrumb: PageHeroBreadcrumbItem[] = [
    { label: "Trang chủ", href: toHomePath() },
    { label: "Sản phẩm", href: toProductListPath() },
    ...(parentCategory
      ? [{
          label: safeText(parentCategory.name, "Danh mục cha"),
          href: toCategoryPath(parentCategory.slug),
        }]
      : []),
    { label: categoryName },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <PageHero
        imageUrl={heroImgAsset?.url}
        imageAlt={heroImgAsset?.alt}
        kicker="DANH MỤC SẢN PHẨM"
        title={categoryName}
        description={heroDescription}
        breadcrumb={heroBreadcrumb}
        meta={pagination ? `${pagination.totalItems} sản phẩm` : undefined}
      />

      {/* ── Sub-categories ────────────────────────────────────── */}
      {childCategories.length > 0 && (
        <div className="bb-cat-children">
          <div className="bb-container bb-cat-children-inner">
            <span className="bb-cat-children-label">Danh mục con:</span>
            <div className="bb-cat-children-chips">
              {childCategories.map((child) => (
                <Link
                  key={child.id}
                  href={toCategoryPath(child.slug)}
                  className="bb-cat-child-chip"
                >
                  {safeText(child.name, child.slug)}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Catalog body ──────────────────────────────────────── */}
      <div className="bb-cat-layout">
        <CatalogFilters
          key={[currentFilters.brand, currentFilters.color, currentFilters.minPrice, currentFilters.maxPrice, currentFilters.q].join(",")}
          brands={brandsResult.data}
          current={currentFilters}
          resetHref={canonicalPath}
        />

        <div>
          <div className="bb-catalog-head">
            <div className="bb-catalog-count">
              {productsResult.data.length > 0 && pagination ? (
                <>
                  Hiển thị{" "}
                  <b>
                    {(pagination.page - 1) * pagination.pageSize + 1}–
                    {Math.min(
                      pagination.page * pagination.pageSize,
                      pagination.totalItems,
                    )}
                  </b>{" "}
                  / {pagination.totalItems} sản phẩm
                </>
              ) : null}
            </div>
            <Suspense
              fallback={
                <span
                  className="bb-skel w-40 h-9"
                  aria-hidden="true"
                />
              }
            >
              <CatalogSortSelect current={sortParsed.value ?? "createdAt:desc"} />
            </Suspense>
          </div>

          {productsResult.error && productsResult.data.length === 0 ? (
            <ErrorState
              message={productsResult.error.message}
              retryHref={canonicalPath}
            />
          ) : productsResult.data.length === 0 ? (
            <EmptyState
              title="Danh mục chưa có sản phẩm"
              description="Danh mục này hiện tại chưa có sản phẩm được đăng."
            />
          ) : (
            <>
              <div className="bb-product-grid">
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
                      size: sizeParsed.value !== DEFAULT_PAGE_SIZE ? sizeParsed.value : undefined,
                      sort: sortParsed.value !== DEFAULT_SORT ? sortParsed.value : undefined,
                      "pwb-brand": brandParsed.value,
                      q: qParsed.value,
                      filter_color: colorParsed.value,
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

      {/* ── SEO description (full HTML) ────────────────────────── */}
      {isHtmlDescription && rawDescription && (
        <div className="bb-cat-seo">
          <div
            className="bb-cat-seo-prose"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(rawDescription) }}
          />
        </div>
      )}
    </>
  );
}
