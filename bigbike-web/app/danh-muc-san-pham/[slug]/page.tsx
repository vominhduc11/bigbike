import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ProductArchiveHero } from "@/components/catalog/ProductArchiveHero";
import { ProductArchiveLayout } from "@/components/catalog/ProductArchiveLayout";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { PaginationNav } from "@/components/ui/PaginationNav";
import {
  PRODUCT_SORT_VALUES,
  getCatalogFacets,
  getCategoryBySlug,
  listBrands,
  listCategories,
  listProducts,
} from "@/lib/api/public-api";
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
  const tCatalog = await getTranslations("Catalog");
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: tCatalog("categoryInvalidTitle"),
      description: tCatalog("categoryInvalidDescription"),
      canonicalPath: toCategoryPath("invalid"),
      noIndex: true,
    });
  }

  const locale = await getLocale();
  const categoryResult = await getCategoryBySlug(slug, locale);
  const category = categoryResult.data;
  if (!category) {
    return buildPublicMetadata({
      title: tCatalog("categoryNotFoundTitle"),
      description: tCatalog("categoryNotFoundDescription"),
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
  const defaultDescription = tCatalog("categoryDefaultDescription");

  return buildPublicMetadata({
    title: buildCatalogTitle(category.name, {
      page,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      colorName: color,
    }),
    description: category.description
      ? category.description.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 160) || defaultDescription
      : defaultDescription,
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

  const [tCatalog, tBreadcrumb] = await Promise.all([
    getTranslations("Catalog"),
    getTranslations("Breadcrumb"),
  ]);
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
          <ErrorState title={tCatalog("filterInvalidTitle")} message={validationErrors.join(" ")} />
        </div>
      </section>
    );
  }

  const locale = await getLocale();
  const [
    categoryResult,
    productsResult,
    brandsResult,
    allCategoriesResult,
    facetsResult,
  ] = await Promise.all([
    getCategoryBySlug(slug, locale),
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
      lang: locale,
    }),
    listBrands({ page: 1, size: 100, sort: "name:asc" }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc" }),
    getCatalogFacets({ category: slug, q: qParsed.value }),
  ]);

  if (!categoryResult.data && categoryResult.error?.status === 404) {
    notFound();
  }

  if (!categoryResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={categoryResult.error?.message ?? tCatalog("categoryLoadFailed")} />
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
  const siblingCategories = (
    category.parentId
      ? allCategories.filter((c) => c.parentId === category.parentId)
      : allCategories.filter((c) => !c.parentId)
  ).filter((c) => c.isVisible);
  const filterCategories = childCategories.length > 0 ? childCategories : siblingCategories;

  const breadcrumbJsonLd = serializeJsonLd(buildCategoryBreadcrumbJsonLd(category, parentCategory));
  const categoryName = safeText(category.name, tCatalog("categoryFallback"));
  const pagination = productsResult.pagination;
  const currentFilters = {
    q: qParsed.value,
    brand: brandParsed.value,
    color: colorParsed.value,
    minPrice: minPriceParsed.value,
    maxPrice: maxPriceParsed.value,
    sort: sortParsed.value,
  };

  const heroBreadcrumb = [
    { label: tBreadcrumb("home"), href: toHomePath() },
    { label: tCatalog("title"), href: toProductListPath() },
    ...(parentCategory
      ? [{
          label: safeText(parentCategory.name, tCatalog("parentCategoryFallback")),
          href: toCategoryPath(parentCategory.slug),
        }]
      : []),
    { label: categoryName },
  ];

  return (
    <div className="bb-product-archive archive tax-product_cat">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <ProductArchiveHero title={categoryName} breadcrumb={heroBreadcrumb} />

      <ProductArchiveLayout
        totalItems={pagination?.totalItems ?? null}
        sortCurrent={sortParsed.value ?? DEFAULT_SORT}
        filters={{
          brands: brandsResult.data,
          categories: filterCategories,
          facets: facetsResult.data,
          current: currentFilters,
          resetHref: canonicalPath,
        }}
      >
        {productsResult.error && productsResult.data.length === 0 ? (
          <ErrorState message={productsResult.error.message} retryHref={canonicalPath} />
        ) : productsResult.data.length === 0 ? (
          <p className="woocommerce-info">{tCatalog("noResults")}</p>
        ) : (
          <>
            <div className="bb-product-grid">
              {productsResult.data.map((product) => (
                <ProductCard key={product.id} product={product} variant="archive" />
              ))}
            </div>
            {pagination ? (
              <PaginationNav
                page={pagination.page}
                totalPages={pagination.totalPages}
                baseHref={`${canonicalPath}${buildQueryString({
                    size: sizeParsed.value !== DEFAULT_PAGE_SIZE ? sizeParsed.value : undefined,
                    sort: sortParsed.value !== DEFAULT_SORT ? sortParsed.value : undefined,
                    "pwb-brand": brandParsed.value,
                    q: qParsed.value,
                    filter_color: colorParsed.value,
                    min_price: minPriceParsed.value,
                    max_price: maxPriceParsed.value,
                  })}`}
                variant="archive"
              />
            ) : null}
          </>
        )}
      </ProductArchiveLayout>
    </div>
  );
}
