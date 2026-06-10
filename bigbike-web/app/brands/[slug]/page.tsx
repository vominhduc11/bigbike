import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { WpCategorySidebar } from "@/components/wp/WpCategorySidebar";
import { WpCatalogResults } from "@/components/wp/WpCatalogResults";
import {
  getBrandBySlug,
  getCatalogFacets,
  listBrands,
  listCategories,
  listProducts,
} from "@/lib/api/public-api";
import { buildCatalogTitle } from "@/lib/utils/catalog";
import { DEFAULT_WP_ORDERBY } from "@/lib/utils/catalog-sort";
import { buildBrandBreadcrumbJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { parseCatalogListParams } from "@/lib/utils/catalog-list-params";
import { readSearchParamAlias, readSingleSearchParam } from "@/lib/utils/query";
import { toBrandListPath, toBrandPath, toHomePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const result = await listBrands({ page: 1, size: 1000, sort: "name:asc" });
  return (result.data ?? []).map((b) => ({ slug: b.slug }));
}

type BrandDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: BrandDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: "Thương hiệu không hợp lệ",
      description: "Slug thương hiệu không hợp lệ.",
      canonicalPath: toBrandPath("invalid"),
      noIndex: true,
    });
  }

  const locale = await getLocale();
  const brandResult = await getBrandBySlug(slug, locale);
  const brand = brandResult.data;
  if (!brand) {
    return buildPublicMetadata({
      title: "Không tìm thấy thương hiệu",
      description: "Không tìm thấy thông tin thương hiệu yêu cầu.",
      canonicalPath: toBrandPath(slug),
      noIndex: true,
    });
  }

  const query = await searchParams;
  const page = Number(readSearchParamAlias(query, "page", "paged") ?? "1");
  const brandFilter = readSearchParamAlias(query, "pwb-brand", "brand");
  const q = readSingleSearchParam(query.q);
  const color = readSingleSearchParam(query.filter_color);
  const minPrice = readSingleSearchParam(query.min_price);
  const maxPrice = readSingleSearchParam(query.max_price);
  const orderby = readSingleSearchParam(query.orderby);

  return buildPublicMetadata({
    title:
      brand.seo?.title ??
      buildCatalogTitle(brand.name, {
        page,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        colorName: color,
      }),
    description: brand.seo?.description ?? brand.description ?? "Chi tiết thương hiệu BigBike.",
    canonicalPath: toBrandPath(brand.slug),
    noIndex:
      page > 1 ||
      Boolean(brandFilter) ||
      Boolean(q) ||
      Boolean(color) ||
      Boolean(minPrice) ||
      Boolean(maxPrice) ||
      Boolean(orderby && orderby !== DEFAULT_WP_ORDERBY),
    ogImage: brand.seo?.ogImage?.url ?? brand.logo?.url ?? undefined,
  });
}

export default async function BrandDetailPage({ params, searchParams }: BrandDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    notFound();
  }

  const query = await searchParams;
  const catalog = parseCatalogListParams(query);
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
  const [
    brandResult,
    productsResult,
    brandsResult,
    categoriesResult,
    facetsResult,
  ] = await Promise.all([
    getBrandBySlug(slug, locale),
    listProducts({
      page: catalog.page,
      size: catalog.size,
      sort: catalog.productSort,
      brand: slug,
      q: filters.q,
      filterColor: filters.color,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      lang: locale,
    }),
    listBrands({ page: 1, size: 100, sort: "name:asc", lang: locale }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
    getCatalogFacets({ q: filters.q, lang: locale }),
  ]);

  if (!brandResult.data && brandResult.error?.status === 404) {
    notFound();
  }
  if (!brandResult.data) {
    return (
      <div id="main-content">
        <div className="container">
          <p className="woocommerce-info">{brandResult.error?.message ?? "Không tải được thông tin thương hiệu."}</p>
        </div>
      </div>
    );
  }

  const brand = brandResult.data;

  const canonicalPath = toBrandPath(brand.slug);
  const filterCategories = (categoriesResult.data ?? []).filter((c) => c.isVisible);

  const breadcrumbJsonLd = serializeJsonLd(buildBrandBreadcrumbJsonLd(brand));
  const brandName = safeText(brand.name, "Thương hiệu");
  const products = productsResult.data;
  const pagination = productsResult.pagination;

  const heroBreadcrumb: WpCategoryCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    { label: "Thương hiệu", href: toBrandListPath() },
    { label: brandName },
  ];

  const heroBgUrl = toLegacyWpMediaUrl(resolveMediaUrl(brand.bannerImage?.url?.trim()));
  const heroIllustrationUrl = toLegacyWpMediaUrl(resolveMediaUrl(brand.logo?.url?.trim()));

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

      <div className="archive tax-pwb-brand post-type-archive-product">
        <WpCategoryHero
          title={brandName}
          breadcrumb={heroBreadcrumb}
          bgUrl={heroBgUrl}
          illustrationUrl={heroIllustrationUrl}
          illustrationAlt={brand.logo?.alt ?? brandName}
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
                paginationBaseHref={paginationBaseHref}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
