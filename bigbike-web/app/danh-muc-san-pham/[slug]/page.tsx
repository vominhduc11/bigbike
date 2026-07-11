import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHero, type PageHeroCrumb } from "@/components/layout/PageHero";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import { CatalogDefault } from "@/components/catalog/CatalogDefault";
import { AltSlugRegistrar } from "@/components/i18n/AltSlugProvider";
import { LHtml, LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import { Tr } from "@/components/i18n/Tr";
import { getCatalogFacets, getCategoryBySlug, listBrands, listCategories, listProducts } from "@/lib/api/public-api";
import { DEFAULT_PRODUCT_PAGE_SIZE, DEFAULT_PRODUCT_SORT } from "@/lib/constants/catalog";
import { buildCategoryBreadcrumbJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toCategoryPath, toHomePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import { richContentClassName } from "@/components/layout/RichContent";

// ISR on-demand: danh mục là dữ liệu admin quản lý → KHÔNG prebuild lúc build. Shell
// (thông tin danh mục, sidebar) + lưới sản phẩm view MẶC ĐỊNH (page 1, sort mặc định,
// chưa lọc) đều render ở SERVER + revalidate theo tag category:{slug}/categories/products
// → nội dung danh mục nằm trong HTML server (SEO). Lọc/sắp xếp/phân trang do client
// tiếp quản theo searchParams.
export async function generateStaticParams() {
  return [];
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
};

export async function generateMetadata({ params }: CategoryDetailPageProps): Promise<Metadata> {
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

  // Metadata base (trang tĩnh) — canonical về danh mục. View đã lọc/phân trang dùng chung
  // canonical này nên không cần per-filter noIndex; tham số lọc xử lý ở client.
  const defaultDescription = tCatalog("categoryDefaultDescription");
  return buildPublicMetadata({
    title: category.seo?.title ?? category.name,
    description:
      category.seo?.description ??
      (category.description
        ? category.description.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 160) || defaultDescription
        : defaultDescription),
    canonicalPath: toCategoryPath(category.slug),
    ogImage: category.seo?.ogImage?.url ?? (category.image ?? category.icon)?.url ?? undefined,
    // hreflang vi/en khi danh mục có slug tiếng Anh riêng (CATEGORY_RULE_003).
    languageAlternates: category.slugEn
      ? { vi: toCategoryPath(category.slug), en: toCategoryPath(category.slugEn, "en", true) }
      : undefined,
  });
}

export default async function CategoryDetailPage({ params }: CategoryDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    notFound();
  }

  const tCatalog = await getTranslations("Catalog");
  const locale = await getLocale();
  const categoryResult = await getCategoryByRouteSlug(slug, locale);

  if (!categoryResult.data && categoryResult.error?.status === 404) {
    notFound();
  }

  if (!categoryResult.data) {
    return (
      <div id="main-content">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
          <p className="border border-border bg-card p-4 text-a4-content text-muted-foreground"><Tr ns="Catalog" k="categoryLoadFailed" /></p>
        </div>
      </div>
    );
  }

  const category = categoryResult.data;
  // Shell tĩnh theo slug — KHÔNG đọc searchParams (lưới lọc/phân trang nằm ở client).
  // Facets fetch theo category (không kèm q) làm base; lựa chọn "current" tính ở client.
  const [brandsResult, allCategoriesResult, facetsResult, productsResult] = await Promise.all([
    listBrands({ page: 1, size: 100, sort: "name:asc", lang: locale }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
    getCatalogFacets({ category: category.slug, lang: locale }),
    listProducts({ page: 1, size: DEFAULT_PRODUCT_PAGE_SIZE, sort: DEFAULT_PRODUCT_SORT, category: category.slug, lang: locale }),
  ]);

  const canonicalPath = toCategoryPath(category.slug);
  const allCategories = allCategoriesResult.data ?? [];
  const parentCategory = category.parentId
    ? (allCategories.find((c) => c.id === category.parentId) ?? null)
    : null;
  const filterCategories = allCategories.filter((c) => c.isVisible);

  const breadcrumbJsonLd = serializeJsonLd(buildCategoryBreadcrumbJsonLd(category, parentCategory));
  const categoryName = safeText(category.name, tCatalog("categoryFallback"));
  const categoryIntroHtml = category.introContent?.trim()
    ? sanitizeRichHtml(category.introContent, { rewriteMediaUrls: true })
    : null;
  const beforeGridNode = categoryIntroHtml ? (
    <LHtml
      field="introContent"
      viHtml={categoryIntroHtml}
      className={richContentClassName}
      rewriteMediaUrls
    />
  ) : undefined;

  const heroBreadcrumb: PageHeroCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    ...(parentCategory
      ? [
          {
            label: safeText(parentCategory.name, "Danh mục"),
            href: toCategoryPath(parentCategory.slug),
            altHref: parentCategory.slugEn ? toCategoryPath(parentCategory.slugEn, "en", true) : undefined,
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

      <LocalizedContentProvider kind="category" slug={category.slug}>
        <AltSlugRegistrar kind="category" viSlug={category.slug} enSlug={category.slugEn ?? null} />
        <div>
          <PageHero
            title={categoryName}
            titleNode={<LText field="name">{categoryName}</LText>}
            breadcrumb={heroBreadcrumb}
            bgUrl={heroBgUrl}
            illustrationUrl={heroIllustrationUrl}
            illustrationAlt={category.icon?.alt ?? categoryName}
          />

          <div id="main-content">
            <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
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
                  routeCategorySlug={category.slug}
                  initialProducts={productsResult.data}
                  initialPagination={productsResult.pagination}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </LocalizedContentProvider>
    </>
  );
}
