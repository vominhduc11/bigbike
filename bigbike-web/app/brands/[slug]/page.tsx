import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { ProductArchiveHero } from "@/components/catalog/ProductArchiveHero";
import { ProductArchiveLayout } from "@/components/catalog/ProductArchiveLayout";
import { ProductArchiveResults } from "@/components/catalog/ProductArchiveResults";
import { ErrorState } from "@/components/ui/ErrorState";
import { PRODUCT_SORT_VALUES, getBrandBySlug, listBrands, listCategories, listProducts, listPublicSettings } from "@/lib/api/public-api";
import { readDefaultHeroAssets } from "@/lib/utils/page-hero";
import { buildCatalogTitle } from "@/lib/utils/catalog";
import {
  DEFAULT_PRODUCT_PAGE_SIZE as DEFAULT_PAGE_SIZE,
  DEFAULT_PRODUCT_SORT as DEFAULT_SORT,
  PRICE_PARAM_MAX,
} from "@/lib/constants/catalog";
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
import { toBrandListPath, toBrandPath, toHomePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import { Container } from "@/components/layout/Container";

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
    max: PRICE_PARAM_MAX,
    field: "min_price",
  });
  const maxPriceParsed = parseOptionalPositiveIntParam(query.max_price, {
    min: 0,
    max: PRICE_PARAM_MAX,
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
        <Container>
          <ErrorState message={validationErrors.join(" ")} />
        </Container>
      </section>
    );
  }

  const locale = await getLocale();
  const [brandResult, productsResult, categoriesResult, settingsResult] = await Promise.all([
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
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
    listPublicSettings(locale),
  ]);
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);

  if (!brandResult.data && brandResult.error?.status === 404) {
    notFound();
  }
  if (!brandResult.data) {
    return (
      <section className="bb-page">
        <Container>
          <ErrorState message={brandResult.error?.message ?? "Không tải được thông tin thương hiệu."} />
        </Container>
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
        mobileImageUrl={brand.mobileBannerImage?.url}
        imageAlt={brand.bannerImage?.alt ?? brandName}
        title={brandName}
        defaultBgUrl={defaultHero.defaultBgUrl}
        defaultIllustrationUrl={defaultHero.defaultIllustrationUrl}
        breadcrumb={[
          { label: "Trang chủ", href: toHomePath() },
          { label: "Thương hiệu", href: toBrandListPath() },
          { label: brandName },
        ]}
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
        <ProductArchiveResults
          products={productsResult.data}
          hasError={!!productsResult.error}
          pagination={pagination}
          baseHref={`${canonicalPath}${buildQueryString({
            size: sizeParsed.value !== DEFAULT_PAGE_SIZE ? sizeParsed.value : undefined,
            orderby: orderbyCurrent !== DEFAULT_WP_ORDERBY ? orderbyCurrent : undefined,
            "pwb-brand": brandFilterParsed.value,
            q: qParsed.value,
            filter_color: colorParsed.value,
            min_price: minPriceParsed.value,
            max_price: maxPriceParsed.value,
          })}`}
          emptyContent={<p className="woocommerce-info">Không tìm thấy sản phẩm phù hợp.</p>}
          errorContent={
            <ErrorState message={productsResult.error?.message ?? ""} retryHref={canonicalPath} />
          }
        />
      </ProductArchiveLayout>
    </div>
  );
}
