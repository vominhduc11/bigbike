import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { AltSlugRegistrar } from "@/components/i18n/AltSlugProvider";
import { ProductView } from "@/components/catalog/ProductView";
import { getProductBySlug, listCategories, listPublicSettings } from "@/lib/api/public-api";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildProductJsonLd,
  buildVideoObjectsJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeArray } from "@/lib/utils/format";
import { toLegacyProductPath, toProductPath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import type { Locale } from "@/i18n/locale";
import { buildCategoryBreadcrumbCategories } from "@/lib/utils/product-breadcrumb";

// ISR on-demand: KHÔNG prebuild lúc build (sản phẩm là dữ liệu admin quản lý — không gọi
// API lấy list khi build). Trả [] để mỗi trang sinh khi truy cập lần đầu rồi cache; tồn
// kho/giá tươi qua revalidate theo tag product:{slug} (backend phát khi đổi giá/đặt đơn)
// + lớp CSR (giỏ hàng, đánh giá). dynamicParams mặc định = true.
export async function generateStaticParams() {
  return [];
}

type ProductDetailPageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug, locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  if (!isValidSlug(slug)) return {};
  const result = await getProductBySlug(slug, locale);
  const product = result.data;
  if (!product) return {};
  if (product.discontinued) {
    return buildPublicMetadata({
      title: product.seo?.title ?? product.name,
      description: product.seo?.description ?? product.name,
      canonicalPath: toLegacyProductPath(product.slug, locale),
      locale,
      noIndex: true,
    });
  }
  const preferredSlug = locale === "en" ? product.slugEn?.trim() || product.slug : product.slug;
  const canonicalPath = toProductPath(preferredSlug, locale);
  return buildPublicMetadata({
    title: product.seo?.title ?? product.name,
    description: product.seo?.description ?? product.shortDescription ?? product.name,
    canonicalPath,
    locale,
    ogImage: product.seo?.ogImage?.url ?? product.image?.url ?? undefined,
    // Cờ "cho Google hiển thị" đã resolve theo locale ở backend (SeoIndexPolicy):
    // lang=vi → cờ VI; lang=en → cờ EN HOẶC bản EN chưa đủ nội dung. SEO_RULE_001/002.
    noIndex: product.seo?.noIndex ?? false,
    // hreflang vi/en khi sản phẩm có slug tiếng Anh riêng (PRODUCT_RULE_003) — trang EN
    // thật nằm ở /en/product/{slugEn}/. Không khai hreflang khi trang này noindex: khai
    // một bản dịch mà mình vừa bảo Google đừng hiển thị là tín hiệu mâu thuẫn.
    ...(product.seo?.noIndex
      ? {}
      : {
          languageAlternates: {
            vi: toProductPath(product.slug, "vi"),
            en: toProductPath(product.slugEn?.trim() || product.slug, "en"),
          },
        }),
  });
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug, locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  if (!isValidSlug(slug)) notFound();

  const [result, settingsResult, categoriesResult] = await Promise.all([
    getProductBySlug(slug, locale),
    listPublicSettings(locale),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", lang: locale }),
  ]);

  const product = result.data;
  if (!product) notFound();
  if (product.discontinued) notFound();
  const preferredSlug = locale === "en" ? product.slugEn?.trim() || product.slug : product.slug;
  const canonicalPath = toProductPath(preferredSlug, locale);
  if (slug !== preferredSlug) permanentRedirect(canonicalPath);

  const settings = settingsResult.data ?? [];
  const breadcrumbCategories = buildCategoryBreadcrumbCategories(
    product.category ?? product.categories?.[0],
    categoriesResult.data ?? [],
  );
  const faqs = safeArray(product.faqs);

  // Bộ JSON-LD cho PDP (mỗi loại 1 thẻ <script>): Product (kèm aggregateRating
  // khi có review thật), BreadcrumbList, FAQPage (khi có FAQ), VideoObject (mỗi
  // video thật sự hiển thị, đủ dữ liệu). Hàm builder tự bỏ field rỗng → không
  // khai schema lỗi.
  // SEO sống ở server component; phần thân hiển thị do <ProductView> đảm nhiệm.
  const jsonLdBlocks: string[] = [
    serializeJsonLd(buildProductJsonLd(product, canonicalPath)),
    serializeJsonLd(buildBreadcrumbJsonLd(product, canonicalPath, breadcrumbCategories)),
  ];
  if (faqs.length > 0) {
    jsonLdBlocks.push(serializeJsonLd(buildFaqPageJsonLd(faqs)));
  }
  for (const videoLd of buildVideoObjectsJsonLd(product)) {
    jsonLdBlocks.push(serializeJsonLd(videoLd));
  }

  return (
    <>
      {jsonLdBlocks.map((block, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: block }}
        />
      ))}
      <AltSlugRegistrar kind="product" viSlug={product.slug} enSlug={product.slugEn ?? null} />
      <ProductView product={product} settings={settings} breadcrumbCategories={breadcrumbCategories} />
    </>
  );
}
