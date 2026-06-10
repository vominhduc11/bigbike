import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { WpCategorySidebar } from "@/components/wp/WpCategorySidebar";
import { WpCatalogResults } from "@/components/wp/WpCatalogResults";
import {
  getCatalogFacets,
  getCategoryBySlug,
  listBrands,
  listCategories,
  listProducts,
  listPublicSettings,
} from "@/lib/api/public-api";
import { buildCatalogTitle } from "@/lib/utils/catalog";
import { DEFAULT_WP_ORDERBY } from "@/lib/utils/catalog-sort";
import { buildCategoryBreadcrumbJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { parseCatalogListParams } from "@/lib/utils/catalog-list-params";
import { readSearchParamAlias, readSingleSearchParam } from "@/lib/utils/query";
import { toCategoryPath, toHomePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const result = await listCategories({ page: 1, size: 100 });
  return (result.data ?? []).map((c) => ({ slug: c.slug }));
}

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
  const catalog = parseCatalogListParams(pageParams);
  const { filters, validationErrors, orderbyCurrent } = catalog;

  if (validationErrors.length > 0) {
    return (
      <div id="main-content">
        <div className="container">
          <p className="woocommerce-info">{validationErrors.join(" ")}</p>
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
      <div id="main-content">
        <div className="container">
          <p className="woocommerce-info">{categoryResult.error?.message ?? "Không tải được thông tin danh mục."}</p>
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
      page: catalog.page,
      size: catalog.size,
      sort: catalog.productSort,
      category: category.slug,
      brand: filters.brand,
      q: filters.q,
      filterColor: filters.color,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      lang: locale,
    }),
    listBrands({ page: 1, size: 100, sort: "name:asc", lang: locale }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
    getCatalogFacets({ category: category.slug, q: filters.q, lang: locale }),
    listPublicSettings(locale),
  ]);
  void settingsResult;

  const canonicalPath = toCategoryPath(category.slug);
  const allCategories = allCategoriesResult.data ?? [];
  const parentCategory = category.parentId
    ? (allCategories.find((c) => c.id === category.parentId) ?? null)
    : null;
  const filterCategories = allCategories.filter((c) => c.isVisible);

  const breadcrumbJsonLd = serializeJsonLd(buildCategoryBreadcrumbJsonLd(category, parentCategory));
  const categoryName = safeText(category.name, tCatalog("categoryFallback"));
  const products = productsResult.data;
  const pagination = productsResult.pagination;
  const categoryDescriptionHtml = category.description?.trim()
    ? sanitizeRichHtml(category.description, { rewriteMediaUrls: true })
    : null;

  const heroBreadcrumb: WpCategoryCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    ...(parentCategory
      ? [{ label: safeText(parentCategory.name, "Danh mục"), href: toCategoryPath(parentCategory.slug) }]
      : []),
    { label: categoryName },
  ];

  const heroBgUrl = toLegacyWpMediaUrl(resolveMediaUrl(category.bannerImage?.url?.trim()));
  const heroIllustration = category.image ?? category.icon;
  const heroIllustrationUrl = toLegacyWpMediaUrl(resolveMediaUrl(heroIllustration?.url?.trim()));

  const paginationBaseHref = catalog.buildPaginationHref(canonicalPath);

  const notice =
    productsResult.error && products.length === 0
      ? productsResult.error.message
      : products.length === 0
        ? "Không tìm thấy sản phẩm phù hợp."
        : null;

  return (
    <>
      <link
        rel="stylesheet"
        href="/wp-content/themes/bigbike/css/wp-theme-category.css?v=2"
        precedence="default"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <div className="archive tax-product_cat post-type-archive-product">
        <WpCategoryHero
          title={categoryName}
          breadcrumb={heroBreadcrumb}
          bgUrl={heroBgUrl}
          illustrationUrl={heroIllustrationUrl}
          illustrationAlt={heroIllustration?.alt ?? categoryName}
        />

        <div id="main-content">
          <div className="container">
            <div className="row">
              <div className="col-md-3">
                <WpCategorySidebar
                  brands={brandsResult.data}
                  categories={filterCategories}
                  facets={facetsResult.data}
                  current={catalog.currentFilters}
                  resetHref={canonicalPath}
                  hiddenParams={{
                    orderby: orderbyCurrent !== DEFAULT_WP_ORDERBY ? orderbyCurrent : undefined,
                  }}
                />
              </div>

              <WpCatalogResults
                orderbyCurrent={orderbyCurrent}
                pagination={pagination}
                products={products}
                notice={notice}
                beforeGrid={
                  categoryDescriptionHtml ? (
                    <div className="desc" dangerouslySetInnerHTML={{ __html: categoryDescriptionHtml }} />
                  ) : null
                }
                paginationBaseHref={paginationBaseHref}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
