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
import { Tr } from "@/components/i18n/Tr";
import { getBrandBySlug, getCatalogFacets, listBrands, listCategories, listProducts } from "@/lib/api/public-api";
import { DEFAULT_PRODUCT_PAGE_SIZE, DEFAULT_PRODUCT_SORT } from "@/lib/constants/catalog";
import { buildBrandBreadcrumbJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toBrandListPath, toBrandPath, toHomePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import { richContentClassName } from "@/components/layout/RichContent";
import type { Locale } from "@/i18n/locale";

// ISR on-demand: thương hiệu là dữ liệu admin quản lý → KHÔNG prebuild lúc build. Trả [] để
// sinh khi truy cập lần đầu + revalidate theo tag brand:{slug}/brands khi admin sửa.
export async function generateStaticParams() {
  return [];
}

type BrandDetailPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: BrandDetailPageProps): Promise<Metadata> {
  const { slug, locale } = await params as Awaited<typeof params> & { locale: Locale };
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

  // Metadata base (trang tĩnh) — canonical về thương hiệu; tham số lọc xử lý ở client.
  return buildPublicMetadata({
    title: brand.seo?.title ?? brand.name,
    description: brand.seo?.description ?? brand.description ?? t("brandDefaultDescription"),
    canonicalPath: toBrandPath(brand.slug, locale),
    locale,
    ogImage: brand.seo?.ogImage?.url ?? brand.logo?.url ?? undefined,
    // Cờ đã resolve theo locale ở backend (SeoIndexPolicy) — SEO_RULE_001/002. Với thương hiệu,
    // ngưỡng EN chỉ xét `description_en` vì bảng brands không có name_en/slug_en (DROP ở V352).
    noIndex: brand.seo?.noIndex ?? false,
    // BRAND_RULE_003: brand slug is shared across VI/EN; no separate hreflang URL.
    // Trang noindex thì không khai hreflang — xem ghi chú ở trang sản phẩm.
    ...(brand.seo?.noIndex
      ? {}
      : { languageAlternates: { vi: toBrandPath(brand.slug, "vi"), en: toBrandPath(brand.slug, "en") } }),
  });
}

export default async function BrandDetailPage({ params }: BrandDetailPageProps) {
  const { slug, locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  if (!isValidSlug(slug)) {
    notFound();
  }

  const t = await getTranslations("Catalog");
  // Shell tĩnh theo slug — KHÔNG đọc searchParams (lưới lọc/phân trang nằm ở client).
  // Lưới sản phẩm view MẶC ĐỊNH (page 1, sort mặc định) của thương hiệu fetch sẵn ở
  // server → nằm trong HTML server cho SEO, đồng bộ cách trang danh mục seed lưới.
  const [brandResult, brandsResult, categoriesResult, facetsResult] = await Promise.all([
    getBrandBySlug(slug, locale),
    listBrands({ page: 1, size: 100, sort: "name:asc", lang: locale }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
    getCatalogFacets({ lang: locale }),
  ]);

  if (!brandResult.data && brandResult.error?.status === 404) {
    notFound();
  }
  if (!brandResult.data) {
    return (
      <div>
        <PageHero
          title={t("brandsTitle")}
          breadcrumb={[
            { label: "Bigbike.vn", href: toHomePath(locale) },
            { label: t("brandsTitle"), href: toBrandListPath(locale) },
          ]}
        />
        <div id="main-content">
          <Container>
            <p className="border border-border bg-card p-4 text-a4-content text-muted-foreground"><Tr ns="Catalog" k="brandDetailLoadFailed" /></p>
          </Container>
        </div>
      </div>
    );
  }

  const brand = brandResult.data;
  const productsResult = await listProducts({
    page: 1,
    size: DEFAULT_PRODUCT_PAGE_SIZE,
    sort: DEFAULT_PRODUCT_SORT,
    brand: brand.slug,
    lang: locale,
  });
  const canonicalPath = toBrandPath(brand.slug, locale);
  const filterCategories = (categoriesResult.data ?? []).filter((c) => c.isVisible);
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
                    brands={brandsResult.data}
                    categories={filterCategories}
                    facets={facetsResult.data}
                    beforeGridNode={beforeGridNode}
                    products={productsResult.data}
                    pagination={productsResult.pagination}
                  />
                }
              >
                <CatalogClient
                  canonicalPath={canonicalPath}
                  brands={brandsResult.data}
                  categories={filterCategories}
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
