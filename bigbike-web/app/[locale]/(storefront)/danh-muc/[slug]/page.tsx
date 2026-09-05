import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHero, type PageHeroCrumb } from "@/components/layout/PageHero";
import { Container } from "@/components/layout/Container";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import { CatalogDefault } from "@/components/catalog/CatalogDefault";
import { CollapsibleContent } from "@/components/ui/collapsible-content";
import { AltSlugRegistrar } from "@/components/i18n/AltSlugProvider";
import { LHtml, LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import { Tr } from "@/components/i18n/Tr";
import { getCatalogFacets, listCategories, listProducts } from "@/lib/api/public-api";
import { getCategoryByRouteSlug } from "./resolve-category";
import {
  buildCategoryBreadcrumbJsonLd,
  buildCategoryCollectionJsonLd,
  buildFaqPageJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { extractCategoryFaqs } from "@/lib/seo/category-intro";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { stripHtmlToText } from "@/lib/utils/text";
import { toCategoryPath, toHomePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import { richContentClassName } from "@/components/layout/RichContent";
import type { Locale } from "@/i18n/locale";
import { parseCatalogListParams } from "@/lib/utils/catalog-list-params";
import { hasPriceRangeFilter, type RouteSearchParams } from "@/lib/utils/query";

// ISR on-demand: danh mục là dữ liệu admin quản lý → KHÔNG prebuild lúc build. Shell
// (thông tin danh mục, sidebar) + lưới sản phẩm đúng theo URL hiện tại đều render ở
// SERVER + revalidate theo tag category:{slug}/categories/products. Sau hydrate,
// lọc/sắp xếp/phân trang do client tiếp quản.
export async function generateStaticParams() {
  return [];
}

// Trang này đọc bộ lọc và phân trang từ URL. Ép dựng động để Next.js không
// cố dùng cache tĩnh cho từng tổ hợp searchParams (SEO_RULE_007).
export const dynamic = "force-dynamic";

type CategoryDetailPageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<RouteSearchParams>;
};

export async function generateMetadata({ params, searchParams }: CategoryDetailPageProps): Promise<Metadata> {
  const { slug, locale } = await params as Awaited<typeof params> & { locale: Locale };
  const priceFiltered = hasPriceRangeFilter(await searchParams);
  setRequestLocale(locale);
  const tCatalog = await getTranslations("Catalog");
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: tCatalog("categoryInvalidTitle"),
      description: tCatalog("categoryInvalidDescription"),
      canonicalPath: toCategoryPath("invalid", locale),
      noIndex: true,
    });
  }

  const categoryResult = await getCategoryByRouteSlug(slug, locale);
  const category = categoryResult.data;
  if (!category) {
    return buildPublicMetadata({
      title: tCatalog("categoryNotFoundTitle"),
      description: tCatalog("categoryNotFoundDescription"),
      canonicalPath: toCategoryPath(slug, locale),
      noIndex: true,
    });
  }

  // Price-filter views remain usable for customers, but must not become separate Google
  // landing pages. Canonical stays on the base category and hreflang is omitted with noindex.
  const defaultDescription = tCatalog("categoryDefaultDescription");
  const noIndex = priceFiltered || category.seo?.noIndex === true;
  return buildPublicMetadata({
    title: category.seo?.title ?? category.name,
    description:
      category.seo?.description ??
      (category.description
        ? category.description.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 160) || defaultDescription
        : defaultDescription),
    canonicalPath: toCategoryPath(locale === "en" ? category.slugEn?.trim() || category.slug : category.slug, locale),
    locale,
    ogImage: category.seo?.ogImage?.url ?? (category.image ?? category.icon)?.url ?? undefined,
    // Cờ đã resolve theo locale ở backend (SeoIndexPolicy) — SEO_RULE_001/002.
    noIndex,
    // hreflang vi/en khi danh mục có slug tiếng Anh riêng (CATEGORY_RULE_003).
    // Trang noindex thì không khai hreflang — xem ghi chú ở trang sản phẩm.
    ...(noIndex
      ? {}
      : {
          languageAlternates: {
            vi: toCategoryPath(category.slug, "vi"),
            en: toCategoryPath(category.slugEn?.trim() || category.slug, "en"),
          },
        }),
  });
}

export default async function CategoryDetailPage({ params, searchParams }: CategoryDetailPageProps) {
  const { slug, locale } = await params as Awaited<typeof params> & { locale: Locale };
  const catalog = parseCatalogListParams(await searchParams);
  setRequestLocale(locale);
  if (!isValidSlug(slug)) {
    notFound();
  }

  const tCatalog = await getTranslations("Catalog");
  const categoryResult = await getCategoryByRouteSlug(slug, locale);

  if (!categoryResult.data && categoryResult.error?.status === 404) {
    notFound();
  }

  if (!categoryResult.data) {
    const fallbackTitle = tCatalog("categoryFallback");
    return (
      <div>
        <PageHero
          title={fallbackTitle}
          breadcrumb={[{ label: locale === "en" ? "Home" : "Trang chủ", href: toHomePath(locale) }, { label: fallbackTitle }]}
        />
        <div id="main-content">
          <Container>
            <p className="border border-border bg-card p-4 text-a4-content text-muted-foreground"><Tr ns="Catalog" k="categoryLoadFailed" /></p>
          </Container>
        </div>
      </div>
    );
  }

  const category = categoryResult.data;
  const preferredSlug = locale === "en" ? category.slugEn?.trim() || category.slug : category.slug;
  if (slug !== preferredSlug) permanentRedirect(toCategoryPath(preferredSlug, locale));
  // Shell theo slug; lưới và facets đọc đầy đủ searchParams để lần hiển thị đầu tiên
  // khớp chính xác URL đã lọc.
  const [allCategoriesResult, facetsResult, productsResult] = await Promise.all([
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
    getCatalogFacets({
      category: category.slug, brand: catalog.filters.brand, q: catalog.filters.q,
      filterColor: catalog.filters.color, filterFinish: catalog.filters.finish,
      filterGender: catalog.filters.gender, sizeFilter: catalog.filters.size,
      minPrice: catalog.filters.minPrice, maxPrice: catalog.filters.maxPrice,
      inStock: catalog.filters.inStock, lang: locale,
    }),
    listProducts({
      page: catalog.page, size: catalog.size, sort: catalog.productSort,
      category: category.slug, brand: catalog.filters.brand, q: catalog.filters.q,
      filterColor: catalog.filters.color, filterFinish: catalog.filters.finish,
      filterGender: catalog.filters.gender, sizeFilter: catalog.filters.size,
      minPrice: catalog.filters.minPrice, maxPrice: catalog.filters.maxPrice,
      inStock: catalog.filters.inStock, lang: locale,
    }),
  ]);

  const canonicalPath = toCategoryPath(preferredSlug, locale);
  const allCategories = allCategoriesResult.data ?? [];
  const parentCategory = category.parentId
    ? (allCategories.find((c) => c.id === category.parentId) ?? null)
    : null;
  const categoryName = safeText(category.name, tCatalog("categoryFallback"));
  const categoryIntroHtml = category.introContent?.trim()
    ? sanitizeRichHtml(category.introContent, { allowInlineStyles: true, rewriteMediaUrls: true, locale })
    : null;
  const categoryDescription = stripHtmlToText(categoryIntroHtml ?? category.description ?? "").slice(0, 500);
  const breadcrumbJsonLd = serializeJsonLd(
    buildCategoryBreadcrumbJsonLd(category, parentCategory, canonicalPath),
  );
  const collectionJsonLd = serializeJsonLd(
    buildCategoryCollectionJsonLd(
      category,
      productsResult.data,
      productsResult.pagination?.page ?? catalog.page,
      productsResult.pagination?.pageSize ?? catalog.size,
      canonicalPath,
      categoryDescription,
    ),
  );
  const categoryFaqs = extractCategoryFaqs(categoryIntroHtml);
  const faqJsonLd = categoryFaqs.length > 0
    ? serializeJsonLd(buildFaqPageJsonLd(categoryFaqs))
    : null;
  const beforeGridNode = categoryIntroHtml ? (
    <CollapsibleContent className="mb-8">
      <LHtml
        field="introContent"
        viHtml={categoryIntroHtml}
        className={richContentClassName}
        rewriteMediaUrls
      />
    </CollapsibleContent>
  ) : undefined;

  const heroBreadcrumb: PageHeroCrumb[] = [
    { label: locale === "en" ? "Home" : "Trang chủ", href: toHomePath(locale) },
    ...(parentCategory
      ? [
          {
            label: safeText(parentCategory.name, tCatalog("categoryFallback")),
            href: toCategoryPath(locale === "en" ? parentCategory.slugEn?.trim() || parentCategory.slug : parentCategory.slug, locale),
          },
        ]
      : []),
    { label: categoryName, labelNode: <LText field="name">{categoryName}</LText> },
  ];

  const heroBgUrl = toLegacyWpMediaUrl(resolveMediaUrl(category.bannerImage?.url?.trim()));
  // WP used ACF "image_left" for the hero illustration (not the WC grid thumbnail).
  // image_left is migrated to category.icon; category.image is the grid thumbnail and must not be used here.
  const heroIllustrationUrl = toLegacyWpMediaUrl(resolveMediaUrl(category.icon?.url?.trim()));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: collectionJsonLd }} />
      {faqJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} /> : null}

      <LocalizedContentProvider kind="category" slug={category.slug}>
        <AltSlugRegistrar kind="category" viSlug={category.slug} enSlug={category.slugEn ?? null} />
        <div>
          <PageHero
            className="mb-4 md:mb-22.5"
            title={categoryName}
            titleNode={<LText field="name">{categoryName}</LText>}
            breadcrumb={heroBreadcrumb}
            bgUrl={heroBgUrl}
            illustrationUrl={heroIllustrationUrl}
            illustrationImage={category.icon ? { ...category.icon, url: heroIllustrationUrl ?? undefined } : null}
            illustrationAlt={category.icon?.alt ?? categoryName}
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
                  routeCategorySlug={category.slug}
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
