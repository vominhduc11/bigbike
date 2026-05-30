import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ProductArchiveHero } from "@/components/catalog/ProductArchiveHero";
import { ProductArchiveLayout } from "@/components/catalog/ProductArchiveLayout";
import { ProductCard } from "@/components/catalog/ProductCard";
import { PaginationNav } from "@/components/ui/PaginationNav";
import {
  PRODUCT_SORT_VALUES,
  getCatalogFacets,
  getCategoryBySlug,
  listBrands,
  listCategories,
  listProducts,
  listPublicSettings,
} from "@/lib/api/public-api";
import { readDefaultHeroAssets } from "@/lib/utils/page-hero";
import { buildCatalogTitle } from "@/lib/utils/catalog";
import {
  DEFAULT_WP_ORDERBY,
  isWpOrderbyValue,
  productSortToWpOrderby,
  wpOrderbyToProductSort,
} from "@/lib/utils/catalog-sort";
import { buildCategoryBreadcrumbJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
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
import { toCategoryPath, toHomePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const result = await listCategories({ page: 1, size: 100 });
  return (result.data ?? []).map((c) => ({ slug: c.slug }));
}

const DEFAULT_SORT = "createdAt:desc";
const DEFAULT_PAGE_SIZE = 24;

async function getCategoryByRouteSlug(slug: string, locale: string) {
  const result = await getCategoryBySlug(slug, locale);
  if (result.data || result.error?.status !== 404 || slug.endsWith("-1")) {
    return result;
  }

  const legacyDuplicateResult = await getCategoryBySlug(`${slug}-1`, locale);
  return legacyDuplicateResult.data ? legacyDuplicateResult : result;
}

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
  const categoryResult = await getCategoryByRouteSlug(slug, locale);
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
  const orderby = readSingleSearchParam(query.orderby);
  const defaultDescription = tCatalog("categoryDefaultDescription");

  return buildPublicMetadata({
    title:
      category.seo?.title ??
      buildCatalogTitle(category.name, {
        page,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        colorName: color,
      }),
    description:
      category.seo?.description ??
      (category.description
        ? category.description.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 160) || defaultDescription
        : defaultDescription),
    canonicalPath: toCategoryPath(category.slug),
    noIndex:
      page > 1 ||
      Boolean(brand) ||
      Boolean(q) ||
      Boolean(color) ||
      Boolean(minPrice) ||
      Boolean(maxPrice) ||
      Boolean(orderby && orderby !== DEFAULT_WP_ORDERBY),
    ogImage: category.seo?.ogImage?.url ?? (category.image ?? category.icon)?.url ?? undefined,
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

  const tCatalog = await getTranslations("Catalog");
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
  const orderbyParam = readSingleSearchParam(pageParams.orderby);
  const orderbyError = orderbyParam && !isWpOrderbyValue(orderbyParam) ? "orderby không hợp lệ." : null;
  const sortParsed = parseSortParam(pageParams.sort, PRODUCT_SORT_VALUES, DEFAULT_SORT);
  const orderbyCurrent = isWpOrderbyValue(orderbyParam)
    ? orderbyParam
    : productSortToWpOrderby(sortParsed.value ?? DEFAULT_SORT);
  const productSort = isWpOrderbyValue(orderbyParam)
    ? wpOrderbyToProductSort(orderbyParam, DEFAULT_SORT)
    : sortParsed.value;

  const validationErrors = collectErrors(
    pageParsed.error,
    sizeParsed.error,
    brandParsed.error,
    qParsed.error,
    colorParsed.error,
    minPriceParsed.error,
    maxPriceParsed.error,
    orderbyError ? "orderby không hợp lệ." : null,
    orderbyParam ? null : sortParsed.error,
  );
  if (validationErrors.length > 0) {
    return (
      <div className="bb-product-archive archive tax-product_cat">
        <div id="main-content" className="bb-archive-main">
          <div className="container bb-wp-container">
            <p className="woocommerce-info">{validationErrors.join(" ")}</p>
          </div>
        </div>
      </div>
    );
  }

  const locale = await getLocale();
  const categoryResult = await getCategoryByRouteSlug(slug, locale);

  if (!categoryResult.data && categoryResult.error?.status === 404) {
    notFound();
  }

  if (!categoryResult.data) {
    return (
      <div className="bb-product-archive archive tax-product_cat">
        <div id="main-content" className="bb-archive-main">
          <div className="container bb-wp-container">
            <p className="woocommerce-info">{categoryResult.error?.message ?? "Không tải được thông tin danh mục."}</p>
          </div>
        </div>
      </div>
    );
  }

  const category = categoryResult.data;
  const [
    productsResult,
    brandsResult,
    allCategoriesResult,
    facetsResult,
    settingsResult,
  ] = await Promise.all([
    listProducts({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: productSort,
      category: category.slug,
      brand: brandParsed.value,
      q: qParsed.value,
      filterColor: colorParsed.value,
      minPrice: minPriceParsed.value,
      maxPrice: maxPriceParsed.value,
      lang: locale,
    }),
    listBrands({ page: 1, size: 100, sort: "name:asc" }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc" }),
    getCatalogFacets({ category: category.slug, q: qParsed.value }),
    listPublicSettings(),
  ]);
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
  const canonicalPath = toCategoryPath(category.slug);
  const allCategories = allCategoriesResult.data ?? [];
  const parentCategory = category.parentId
    ? (allCategories.find((c) => c.id === category.parentId) ?? null)
    : null;
  const filterCategories = allCategories.filter((c) => c.isVisible);

  const breadcrumbJsonLd = serializeJsonLd(buildCategoryBreadcrumbJsonLd(category, parentCategory));
  const categoryName = safeText(category.name, tCatalog("categoryFallback"));
  const pagination = productsResult.pagination;
  const currentFilters = {
    q: qParsed.value,
    brand: brandParsed.value,
    color: colorParsed.value,
    minPrice: minPriceParsed.value,
    maxPrice: maxPriceParsed.value,
  };
  const categoryDescriptionHtml = category.description?.trim()
    ? sanitizeRichHtml(category.description, { rewriteMediaUrls: true })
    : null;

  const heroBreadcrumb = [
    { label: "Trang chủ", href: toHomePath() },
    ...(parentCategory
      ? [{ label: safeText(parentCategory.name, "Danh mục"), href: toCategoryPath(parentCategory.slug) }]
      : []),
    { label: categoryName },
  ];

  return (
    <div className="bb-product-archive archive tax-product_cat">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <ProductArchiveHero
        title={categoryName}
        breadcrumb={heroBreadcrumb}
        imageUrl={category.bannerImage?.url}
        mobileImageUrl={category.mobileBannerImage?.url}
        imageAlt={category.bannerImage?.alt ?? categoryName}
        illustrationUrl={(category.image ?? category.icon)?.url}
        illustrationAlt={(category.image ?? category.icon)?.alt ?? categoryName}
        defaultBgUrl={defaultHero.defaultBgUrl}
        defaultIllustrationUrl={defaultHero.defaultIllustrationUrl}
      />

      <ProductArchiveLayout
        totalItems={pagination?.totalItems ?? null}
        sortCurrent={orderbyCurrent}
        filters={{
          brands: brandsResult.data,
          categories: filterCategories,
          facets: facetsResult.data,
          current: currentFilters,
          resetHref: canonicalPath,
          hiddenParams: {
            orderby: orderbyCurrent !== DEFAULT_WP_ORDERBY ? orderbyCurrent : undefined,
          },
        }}
      >
        {categoryDescriptionHtml ? (
          <div className="desc" dangerouslySetInnerHTML={{ __html: categoryDescriptionHtml }} />
        ) : null}
        {productsResult.error && productsResult.data.length === 0 ? (
          <p className="woocommerce-info">{productsResult.error.message}</p>
        ) : productsResult.data.length === 0 ? (
          <p className="woocommerce-info">Không tìm thấy sản phẩm phù hợp.</p>
        ) : (
          <>
            <div className="row bb-wp-row bb-product-grid">
              {productsResult.data.map((product) => (
                <div key={product.id} className="col-md-3 col-6 bb-wp-col-md-3 bb-wp-col-6">
                  <ProductCard product={product} variant="archive" />
                </div>
              ))}
            </div>
            {pagination ? (
              <PaginationNav
                page={pagination.page}
                totalPages={pagination.totalPages}
                baseHref={`${canonicalPath}${buildQueryString({
                    size: sizeParsed.value !== DEFAULT_PAGE_SIZE ? sizeParsed.value : undefined,
                    orderby: orderbyCurrent !== DEFAULT_WP_ORDERBY ? orderbyCurrent : undefined,
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
