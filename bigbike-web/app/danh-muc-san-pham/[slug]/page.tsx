import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { WpCatalogClient } from "@/components/wp/WpCatalogClient";
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
        <div className="container">
          <p className="woocommerce-info">{categoryResult.error?.message ?? <Tr ns="Catalog" k="categoryLoadFailed" />}</p>
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
  const categoryDescriptionHtml = category.description?.trim()
    ? sanitizeRichHtml(category.description, { rewriteMediaUrls: true })
    : null;

  const heroBreadcrumb: WpCategoryCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    ...(parentCategory
      ? [{ label: safeText(parentCategory.name, "Danh mục"), href: toCategoryPath(parentCategory.slug) }]
      : []),
    { label: categoryName, labelNode: <LText field="name">{categoryName}</LText> },
  ];

  const heroBgUrl = toLegacyWpMediaUrl(resolveMediaUrl(category.bannerImage?.url?.trim()));
  const heroIllustration = category.image ?? category.icon;
  const heroIllustrationUrl = toLegacyWpMediaUrl(resolveMediaUrl(heroIllustration?.url?.trim()));

  return (
    <>
      <link
        rel="stylesheet"
        href="/wp-content/themes/bigbike/css/wp-theme-category.css?v=2"
        precedence="default"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <LocalizedContentProvider kind="category" slug={category.slug}>
        <div className="archive tax-product_cat post-type-archive-product">
          <WpCategoryHero
            title={categoryName}
            titleNode={<LText field="name">{categoryName}</LText>}
            breadcrumb={heroBreadcrumb}
            bgUrl={heroBgUrl}
            illustrationUrl={heroIllustrationUrl}
            illustrationAlt={heroIllustration?.alt ?? categoryName}
          />

          <div id="main-content">
            <div className="container">
              <WpCatalogClient
                canonicalPath={canonicalPath}
                brands={brandsResult.data}
                categories={filterCategories}
                facets={facetsResult.data}
                beforeGridNode={
                  categoryDescriptionHtml ? (
                    <LHtml
                      field="description"
                      viHtml={categoryDescriptionHtml}
                      className="desc"
                      rewriteMediaUrls
                    />
                  ) : undefined
                }
                routeCategorySlug={category.slug}
                initialProducts={productsResult.data}
                initialPagination={productsResult.pagination}
              />
            </div>
          </div>
        </div>
      </LocalizedContentProvider>
    </>
  );
}
