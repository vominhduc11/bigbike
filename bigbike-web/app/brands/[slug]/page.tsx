import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { ProductArchiveHero } from "@/components/catalog/ProductArchiveHero";
import { ProductArchiveLayout } from "@/components/catalog/ProductArchiveLayout";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { PRODUCT_SORT_VALUES, getBrandBySlug, listBrands, listCategories, listProducts } from "@/lib/api/public-api";
import { buildCatalogTitle } from "@/lib/utils/catalog";
import {
  DEFAULT_WP_ORDERBY,
  isWpOrderbyValue,
  productSortToWpOrderby,
  wpOrderbyToProductSort,
} from "@/lib/utils/catalog-sort";
import { buildBrandBreadcrumbJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
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
import { toBrandPath, toHomePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

export const dynamic = "force-dynamic";
const DEFAULT_SORT = "createdAt:desc";
const DEFAULT_PAGE_SIZE = 24;

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
      buildCatalogTitle(brand.name, {
        page,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        colorName: color,
      }),
    description: brand.description ?? "Chi tiết thương hiệu BigBike.",
    canonicalPath: toBrandPath(brand.slug),
    noIndex:
      page > 1 ||
      Boolean(brandFilter) ||
      Boolean(q) ||
      Boolean(color) ||
      Boolean(minPrice) ||
      Boolean(maxPrice) ||
      Boolean(orderby && orderby !== DEFAULT_WP_ORDERBY),
    ogImage: brand.logo?.url ?? undefined,
  });
}

export default async function BrandDetailPage({ params, searchParams }: BrandDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    notFound();
  }

  const query = await searchParams;
  const pageParsed = parsePositiveIntParam(readSearchParamAlias(query, "page", "paged"), {
    defaultValue: 1,
    min: 1,
    max: 999,
    field: "page",
  });
  const sizeParsed = parsePositiveIntParam(query.size, {
    defaultValue: DEFAULT_PAGE_SIZE,
    min: 1,
    max: 100,
    field: "size",
  });
  const brandFilterParsed = parseSlugParam(readSearchParamAlias(query, "pwb-brand", "brand"), "pwb-brand");
  const qParsed = parseTextParam(query.q, 100);
  const colorParsed = parseSlugParam(query.filter_color, "filter_color");
  const minPriceParsed = parseOptionalPositiveIntParam(query.min_price, {
    min: 0,
    max: 1_000_000_000,
    field: "min_price",
  });
  const maxPriceParsed = parseOptionalPositiveIntParam(query.max_price, {
    min: 0,
    max: 1_000_000_000,
    field: "max_price",
  });
  const orderbyParam = readSingleSearchParam(query.orderby);
  const orderbyError = orderbyParam && !isWpOrderbyValue(orderbyParam) ? "orderby không hợp lệ." : null;
  const sortParsed = parseSortParam(query.sort, PRODUCT_SORT_VALUES, DEFAULT_SORT);
  const orderbyCurrent = isWpOrderbyValue(orderbyParam)
    ? orderbyParam
    : productSortToWpOrderby(sortParsed.value ?? DEFAULT_SORT);
  const productSort = isWpOrderbyValue(orderbyParam)
    ? wpOrderbyToProductSort(orderbyParam, DEFAULT_SORT)
    : sortParsed.value;
  const validationErrors = collectErrors(
    pageParsed.error,
    sizeParsed.error,
    brandFilterParsed.error,
    qParsed.error,
    colorParsed.error,
    minPriceParsed.error,
    maxPriceParsed.error,
    orderbyError,
    orderbyParam ? null : sortParsed.error,
  );

  if (validationErrors.length > 0) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={validationErrors.join(" ")} />
        </div>
      </section>
    );
  }

  const locale = await getLocale();
  const [brandResult, productsResult, categoriesResult] = await Promise.all([
    getBrandBySlug(slug, locale),
    listProducts({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: productSort,
      brand: slug,
      q: qParsed.value,
      filterColor: colorParsed.value,
      minPrice: minPriceParsed.value,
      maxPrice: maxPriceParsed.value,
      lang: locale,
    }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc" }),
  ]);

  if (!brandResult.data && brandResult.error?.status === 404) {
    notFound();
  }
  if (!brandResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={brandResult.error?.message ?? "Không tải được thông tin thương hiệu."} />
        </div>
      </section>
    );
  }

  const brand = brandResult.data;
  const canonicalPath = toBrandPath(brand.slug);
  const breadcrumbJsonLd = serializeJsonLd(buildBrandBreadcrumbJsonLd(brand));
  const brandName = safeText(brand.name, "Thương hiệu");
  const pagination = productsResult.pagination;
  const currentFilters = {
    q: qParsed.value,
    brand: brandFilterParsed.value,
    color: colorParsed.value,
    minPrice: minPriceParsed.value,
    maxPrice: maxPriceParsed.value,
  };

  return (
    <div className="bb-product-archive archive tax-pwb-brand">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <ProductArchiveHero
        imageUrl={brand.bannerImage?.url}
        imageAlt={brand.bannerImage?.alt ?? brandName}
        title={brandName}
        breadcrumb={[{ label: "Bigbike.vn", href: toHomePath() }]}
      />

      <ProductArchiveLayout
        totalItems={pagination?.totalItems ?? null}
        sortCurrent={orderbyCurrent}
        filters={{
          brands: [],
          categories: categoriesResult.data,
          current: currentFilters,
          resetHref: canonicalPath,
          hiddenParams: {
            orderby: orderbyCurrent !== DEFAULT_WP_ORDERBY ? orderbyCurrent : undefined,
          },
        }}
      >
        {productsResult.error && productsResult.data.length === 0 ? (
          <ErrorState message={productsResult.error.message} retryHref={canonicalPath} />
        ) : productsResult.data.length === 0 ? (
          <p className="woocommerce-info">No products were found matching your selection.</p>
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
                    "pwb-brand": brandFilterParsed.value,
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
