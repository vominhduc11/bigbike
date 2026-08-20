import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero, type PageHeroCrumb } from "@/components/layout/PageHero";
import { Container } from "@/components/layout/Container";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import { CatalogDefault } from "@/components/catalog/CatalogDefault";
import { CollapsibleContent } from "@/components/ui/collapsible-content";
import { AltSlugRegistrar } from "@/components/i18n/AltSlugProvider";
import { LHtml, LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import { getBrandBySlug, getCatalogFacets, listProducts } from "@/lib/api/public-api";
import { buildBrandBreadcrumbJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toBrandListPath, toBrandPath, toHomePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import { richContentClassName } from "@/components/layout/RichContent";
import type { Locale } from "@/i18n/locale";
import { parseCatalogListParams } from "@/lib/utils/catalog-list-params";
import { hasPriceRangeFilter, type RouteSearchParams } from "@/lib/utils/query";

// ISR on-demand: thương hiệu là dữ liệu admin quản lý → KHÔNG prebuild lúc build. Trả [] để
// sinh khi truy cập lần đầu + revalidate theo tag brand:{slug}/brands khi admin sửa.
export async function generateStaticParams() {
  return [];
}

// A missing brand must reach the server's 404 response instead of being cached
// as a successful ISR shell by the locale rewrite.
export const dynamic = "force-dynamic";

type BrandDetailPageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<RouteSearchParams>;
};

export async function generateMetadata({ params, searchParams }: BrandDetailPageProps): Promise<Metadata> {
  const { slug, locale } = await params as Awaited<typeof params> & { locale: Locale };
  const priceFiltered = hasPriceRangeFilter(await searchParams);
  setRequestLocale(locale);
  const t = await getTranslations("Catalog");
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: t("brandInvalidTitle"),
      description: t("brandInvalidDescription"),
      canonicalPath: toBrandPath("invalid", locale),
      noIndex: true,
    });
  }

  const brandResult = await getBrandBySlug(slug, locale);
  const brand = brandResult.data;
  if (!brand) {
    return buildPublicMetadata({
      title: t("brandNotFoundTitle"),
      description: t("brandNotFoundDescription"),
      canonicalPath: toBrandPath(slug, locale),
      noIndex: true,
    });
  }

  // Price-filter views remain usable for customers, but must not become separate Google
  // landing pages. Canonical stays on the base brand page and hreflang is omitted with noindex.
  const noIndex = priceFiltered || brand.seo?.noIndex === true;
  return buildPublicMetadata({
    title: brand.seo?.title ?? brand.name,
    description: brand.seo?.description ?? brand.description ?? t("brandDefaultDescription"),
    canonicalPath: toBrandPath(brand.slug, locale),
    locale,
    ogImage: brand.seo?.ogImage?.url ?? brand.logo?.url ?? undefined,
    // Cờ đã resolve theo locale ở backend (SeoIndexPolicy) — SEO_RULE_001/002. Với thương hiệu,
    // ngưỡng EN chỉ xét `description_en` vì bảng brands không có name_en/slug_en (DROP ở V352).
    noIndex,
    // BRAND_RULE_003: brand slug is shared across VI/EN; no separate hreflang URL.
    // Trang noindex thì không khai hreflang — xem ghi chú ở trang sản phẩm.
    ...(noIndex
      ? {}
      : { languageAlternates: { vi: toBrandPath(brand.slug, "vi"), en: toBrandPath(brand.slug, "en") } }),
  });
}

export default async function BrandDetailPage({ params, searchParams }: BrandDetailPageProps) {
  const { slug, locale } = await params as Awaited<typeof params> & { locale: Locale };
  const catalog = parseCatalogListParams(await searchParams);
  setRequestLocale(locale);
  if (!isValidSlug(slug)) {
    notFound();
  }

  const t = await getTranslations("Catalog");
  // Shell theo slug; lưới và facets của thương hiệu đọc đầy đủ searchParams để URL
  // đã lọc có dữ liệu đúng ngay từ lần hiển thị đầu tiên.
  const [brandResult, facetsResult] = await Promise.all([
    getBrandBySlug(slug, locale),
    getCatalogFacets({
      brand: [slug], q: catalog.filters.q,
      filterColor: catalog.filters.color, filterFinish: catalog.filters.finish,
      filterGender: catalog.filters.gender, sizeFilter: catalog.filters.size,
      minPrice: catalog.filters.minPrice, maxPrice: catalog.filters.maxPrice,
      inStock: catalog.filters.inStock, lang: locale,
    }),
  ]);

  if (!brandResult.data) notFound();

  const brand = brandResult.data;
  const productsResult = await listProducts({
    page: catalog.page,
    size: catalog.size,
    sort: catalog.productSort,
    brand: [brand.slug],
    q: catalog.filters.q,
    filterColor: catalog.filters.color,
    filterFinish: catalog.filters.finish,
    filterGender: catalog.filters.gender,
    sizeFilter: catalog.filters.size,
    minPrice: catalog.filters.minPrice,
    maxPrice: catalog.filters.maxPrice,
    inStock: catalog.filters.inStock,
    lang: locale,
  });
  const canonicalPath = toBrandPath(brand.slug, locale);
  const breadcrumbJsonLd = serializeJsonLd(buildBrandBreadcrumbJsonLd(brand, canonicalPath));
  const brandName = safeText(brand.name, t("brandsTitle"));
  // Mô tả thương hiệu (admin nhập rich-HTML) — render trên lưới sản phẩm như trang
  // danh mục; chỉ khi có nội dung. Cùng sanitize + markup .desc để style nhất quán.
  const brandDescriptionHtml = brand.description?.trim()
    ? sanitizeRichHtml(brand.description, { rewriteMediaUrls: true, locale })
    : null;
  const beforeGridNode = brandDescriptionHtml ? (
    <CollapsibleContent className="mb-8">
      <LHtml
        field="description"
        viHtml={brandDescriptionHtml}
        className={richContentClassName}
        rewriteMediaUrls
      />
    </CollapsibleContent>
  ) : undefined;

  const heroBreadcrumb: PageHeroCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath(locale) },
    { label: t("brandsTitle"), href: toBrandListPath(locale) },
    { label: brandName, labelNode: <LText field="name">{brandName}</LText> },
  ];

  const heroBgUrl = toLegacyWpMediaUrl(resolveMediaUrl(brand.bannerImage?.url?.trim()));
  // Logo hãng phục vụ từ MinIO (same-origin), không hotlink web cũ (AGENTS.md §14.3).
  const heroIllustrationUrl = resolveMediaUrl(brand.logo?.url?.trim());

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <LocalizedContentProvider kind="brand" slug={brand.slug}>
        <AltSlugRegistrar kind="brand" viSlug={brand.slug} enSlug={null} />
        <div>
          <PageHero
            className="mb-4 md:mb-22.5"
            title={brandName}
            titleNode={<LText field="name">{brandName}</LText>}
            breadcrumb={heroBreadcrumb}
            bgUrl={heroBgUrl}
            illustrationUrl={heroIllustrationUrl}
            illustrationAlt={brand.logo?.alt ?? brandName}
          />

          <div id="main-content">
            <Container>
              <Suspense
                fallback={
                  <CatalogDefault
                    canonicalPath={canonicalPath}
                    beforeGridNode={beforeGridNode}
                    products={productsResult.data}
                    pagination={productsResult.pagination}
                  />
                }
              >
                <CatalogClient
                  canonicalPath={canonicalPath}
                  facets={facetsResult.data}
                  beforeGridNode={beforeGridNode}
                  routeBrandSlug={brand.slug}
                  initialProducts={productsResult.data}
                  initialPagination={productsResult.pagination}
                />
              </Suspense>
            </Container>
          </div>
        </div>
      </LocalizedContentProvider>
    </>
  );
}
