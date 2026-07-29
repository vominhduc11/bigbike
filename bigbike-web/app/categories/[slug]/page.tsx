import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHero, type PageHeroCrumb } from "@/components/layout/PageHero";
import { Container } from "@/components/layout/Container";
import { CatalogClient } from "@/components/catalog/CatalogClient";
import { CatalogDefault } from "@/components/catalog/CatalogDefault";
import { CollapsibleContent } from "@/components/ui/collapsible-content";
import { AltSlugRegistrar } from "@/components/i18n/AltSlugProvider";
import { LHtml, LText } from "@/components/i18n/LocalizedContent";
import { getCatalogFacets, getCategoryBySlug, listBrands, listCategories, listProducts } from "@/lib/api/public-api";
import { DEFAULT_PRODUCT_PAGE_SIZE, DEFAULT_PRODUCT_SORT } from "@/lib/constants/catalog";
import { buildCategoryBreadcrumbJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toCategoryPath, toHomePath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import { richContentClassName } from "@/components/layout/RichContent";

// English category detail — real server-rendered page at its own URL. Chỉ tồn tại cho
// danh mục có `slugEn`; guard bên dưới 404 nếu param không khớp đúng slugEn
// (CATEGORY_RULE_003). Khuôn giống hệt app/danh-muc/[slug]/page.tsx (bản VI),
// chỉ khác locale cố định "en" và canonical tự trỏ về chính URL này.
export async function generateStaticParams() {
  return [];
}

type CategoryDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: CategoryDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tCatalog = await getTranslations({ locale: "en", namespace: "Catalog" });
  if (!isValidSlug(slug)) return {};

  const categoryResult = await getCategoryBySlug(slug, "en");
  const category = categoryResult.data;
  if (!category || !category.slugEn || category.slugEn !== slug) return {};

  const defaultDescription = tCatalog("categoryDefaultDescription");
  const canonicalPath = toCategoryPath(category.slugEn, "en", true);
  return buildPublicMetadata({
    title: category.seo?.title ?? category.name,
    description:
      category.seo?.description ??
      (category.description
        ? category.description.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 160) || defaultDescription
        : defaultDescription),
    canonicalPath,
    locale: "en",
    ogImage: category.seo?.ogImage?.url ?? (category.image ?? category.icon)?.url ?? undefined,
    languageAlternates: { vi: toCategoryPath(category.slug), en: canonicalPath },
  });
}

export default async function CategoryDetailPageEn({ params }: CategoryDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const tCatalog = await getTranslations({ locale: "en", namespace: "Catalog" });
  const categoryResult = await getCategoryBySlug(slug, "en");
  const category = categoryResult.data;
  // Không khớp đúng slugEn của chính danh mục này → không có trang EN cho bản ghi
  // này — 404, không hiển thị trùng nội dung qua OR-resolve của backend.
  if (!category || !category.slugEn || category.slugEn !== slug) notFound();

  const [brandsResult, allCategoriesResult, facetsResult, productsResult] = await Promise.all([
    listBrands({ page: 1, size: 100, sort: "name:asc", lang: "en" }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: "en" }),
    getCatalogFacets({ category: category.slug, lang: "en" }),
    listProducts({ page: 1, size: DEFAULT_PRODUCT_PAGE_SIZE, sort: DEFAULT_PRODUCT_SORT, category: category.slug, lang: "en" }),
  ]);

  const canonicalPath = toCategoryPath(category.slugEn, "en", true);
  const allCategories = allCategoriesResult.data ?? [];
  const parentCategory = category.parentId
    ? (allCategories.find((c) => c.id === category.parentId) ?? null)
    : null;
  const filterCategories = allCategories.filter((c) => c.isVisible);

  const breadcrumbJsonLd = serializeJsonLd(buildCategoryBreadcrumbJsonLd(category, parentCategory, canonicalPath));
  const categoryName = safeText(category.name, tCatalog("categoryFallback"));
  const categoryIntroHtml = category.introContent?.trim()
    ? sanitizeRichHtml(category.introContent, { rewriteMediaUrls: true })
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
    { label: "Bigbike.vn", href: toHomePath() },
    ...(parentCategory
      ? [
          {
            label: safeText(parentCategory.name, "Category"),
            href: toCategoryPath(parentCategory.slug),
            altHref: parentCategory.slugEn ? toCategoryPath(parentCategory.slugEn, "en", true) : undefined,
          },
        ]
      : []),
    { label: categoryName, labelNode: <LText field="name">{categoryName}</LText> },
  ];

  const heroBgUrl = toLegacyWpMediaUrl(resolveMediaUrl(category.bannerImage?.url?.trim()));
  const heroIllustrationUrl = toLegacyWpMediaUrl(resolveMediaUrl(category.icon?.url?.trim()));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      {/* Không bọc LocalizedContentProvider như bản VI: trang này đã fetch category
          bằng lang="en" ngay ở server, nên children truyền cho LText/LHtml đã là
          nội dung tiếng Anh thật — bọc provider chỉ tạo thêm 1 lần refetch client
          thừa (theo category.slug, lang=en) để lấy lại đúng dữ liệu đã có sẵn. */}
      <AltSlugRegistrar kind="category" viSlug={category.slug} enSlug={category.slugEn} />
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
                routeCategorySlug={category.slug}
                initialProducts={productsResult.data}
                initialPagination={productsResult.pagination}
              />
            </Suspense>
          </Container>
        </div>
      </div>
    </>
  );
}
