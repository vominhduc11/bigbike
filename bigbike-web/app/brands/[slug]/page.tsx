import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { WpCatalogClient } from "@/components/wp/WpCatalogClient";
import { WpThemeStylesheet } from "@/components/wp/WpThemeStylesheet";
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

// ISR on-demand: thương hiệu là dữ liệu admin quản lý → KHÔNG prebuild lúc build. Trả [] để
// sinh khi truy cập lần đầu + revalidate theo tag brand:{slug}/brands khi admin sửa.
export async function generateStaticParams() {
  return [];
}

type BrandDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: BrandDetailPageProps): Promise<Metadata> {
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

  // Metadata base (trang tĩnh) — canonical về thương hiệu; tham số lọc xử lý ở client.
  return buildPublicMetadata({
    title: brand.seo?.title ?? brand.name,
    description: brand.seo?.description ?? brand.description ?? "Chi tiết thương hiệu BigBike.",
    canonicalPath: toBrandPath(brand.slug),
    ogImage: brand.seo?.ogImage?.url ?? brand.logo?.url ?? undefined,
  });
}

export default async function BrandDetailPage({ params }: BrandDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    notFound();
  }

  const locale = await getLocale();
  // Shell tĩnh theo slug — KHÔNG đọc searchParams (lưới lọc/phân trang nằm ở client).
  // Lưới sản phẩm view MẶC ĐỊNH (page 1, sort mặc định) của thương hiệu fetch sẵn ở
  // server → nằm trong HTML server cho SEO, đồng bộ cách trang danh mục seed lưới.
  const [brandResult, brandsResult, categoriesResult, facetsResult, productsResult] = await Promise.all([
    getBrandBySlug(slug, locale),
    listBrands({ page: 1, size: 100, sort: "name:asc", lang: locale }),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
    getCatalogFacets({ lang: locale }),
    listProducts({ page: 1, size: DEFAULT_PRODUCT_PAGE_SIZE, sort: DEFAULT_PRODUCT_SORT, brand: slug, lang: locale }),
  ]);

  if (!brandResult.data && brandResult.error?.status === 404) {
    notFound();
  }
  if (!brandResult.data) {
    return (
      <div id="main-content">
        <div className="container">
          <p className="woocommerce-info"><Tr ns="Catalog" k="brandDetailLoadFailed" /></p>
        </div>
      </div>
    );
  }

  const brand = brandResult.data;
  const canonicalPath = toBrandPath(brand.slug);
  const filterCategories = (categoriesResult.data ?? []).filter((c) => c.isVisible);
  const breadcrumbJsonLd = serializeJsonLd(buildBrandBreadcrumbJsonLd(brand));
  const brandName = safeText(brand.name, "Thương hiệu");
  // Mô tả thương hiệu (admin nhập rich-HTML) — render trên lưới sản phẩm như trang
  // danh mục; chỉ khi có nội dung. Cùng sanitize + markup .desc để style nhất quán.
  const brandDescriptionHtml = brand.description?.trim()
    ? sanitizeRichHtml(brand.description, { rewriteMediaUrls: true })
    : null;

  const heroBreadcrumb: WpCategoryCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    { label: "Thương hiệu", href: toBrandListPath() },
    { label: brandName, labelNode: <LText field="name">{brandName}</LText> },
  ];

  const heroBgUrl = toLegacyWpMediaUrl(resolveMediaUrl(brand.bannerImage?.url?.trim()));
  const heroIllustrationUrl = toLegacyWpMediaUrl(resolveMediaUrl(brand.logo?.url?.trim()));

  return (
    <>
      <WpThemeStylesheet href="/wp-content/themes/bigbike/css/wp-theme-category.css?v=2" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <LocalizedContentProvider kind="brand" slug={brand.slug}>
        <div className="archive tax-pwb-brand post-type-archive-product">
          <WpCategoryHero
            title={brandName}
            titleNode={<LText field="name">{brandName}</LText>}
            breadcrumb={heroBreadcrumb}
            bgUrl={heroBgUrl}
            illustrationUrl={heroIllustrationUrl}
            illustrationAlt={brand.logo?.alt ?? brandName}
          />

          <div id="main-content">
            <div className="container">
              <WpCatalogClient
                canonicalPath={canonicalPath}
                brands={brandsResult.data}
                categories={filterCategories}
                facets={facetsResult.data}
                beforeGridNode={
                  brandDescriptionHtml ? (
                    <LHtml
                      field="description"
                      viHtml={brandDescriptionHtml}
                      className="desc"
                      rewriteMediaUrls
                    />
                  ) : undefined
                }
                routeBrandSlug={brand.slug}
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
