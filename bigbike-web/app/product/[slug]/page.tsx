import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { AltSlugRegistrar } from "@/components/i18n/AltSlugProvider";
import { ProductView } from "@/components/catalog/ProductView";
import { getProductBySlug, listPublicSettings } from "@/lib/api/public-api";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildProductJsonLd,
  buildVideoObjectsJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeArray } from "@/lib/utils/format";
import { toProductPath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

// ISR on-demand: KHÔNG prebuild lúc build (sản phẩm là dữ liệu admin quản lý — không gọi
// API lấy list khi build). Trả [] để mỗi trang sinh khi truy cập lần đầu rồi cache; tồn
// kho/giá tươi qua revalidate theo tag product:{slug} (backend phát khi đổi giá/đặt đơn)
// + lớp CSR (giỏ hàng, đánh giá). dynamicParams mặc định = true.
export async function generateStaticParams() {
  return [];
}

type ProductDetailPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) return {};
  const result = await getProductBySlug(slug, await getLocale());
  const product = result.data;
  if (!product) return {};
  const canonicalPath = product.seo?.canonicalUrl ?? toProductPath(product.slug);
  return buildPublicMetadata({
    title: product.seo?.title ?? product.name,
    description: product.seo?.description ?? product.shortDescription ?? product.name,
    canonicalPath,
    ogImage: product.seo?.ogImage?.url ?? product.image?.url ?? undefined,
    // hreflang vi/en khi sản phẩm có slug tiếng Anh riêng (PRODUCT_RULE_003) — trang EN
    // thật nằm ở /products/{slugEn}/ (app/products/[slug]/page.tsx).
    languageAlternates: product.slugEn
      ? { vi: canonicalPath, en: toProductPath(product.slugEn, "en", true) }
      : undefined,
  });
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();
  const locale = await getLocale();

  const [result, settingsResult] = await Promise.all([
    getProductBySlug(slug, locale),
    listPublicSettings(locale),
  ]);

  const product = result.data;
  if (!product) notFound();
  // Legacy accidental URL: backend OR-resolves by slug hoặc slugEn, nên gõ đúng slugEn
  // vào route VI này vẫn trả 200. Trang EN thật giờ nằm ở /products/{slugEn}/ — chuyển
  // hẳn sang đó để chỉ còn 1 URL phục vụ nội dung EN (tránh trùng nội dung).
  if (product.slugEn && slug === product.slugEn && slug !== product.slug) {
    redirect(toProductPath(product.slugEn, "en", true));
  }

  const settings = settingsResult.data ?? [];
  const faqs = safeArray(product.faqs);
  const videos = safeArray(product.videos);

  // Bộ JSON-LD cho PDP (mỗi loại 1 thẻ <script>): Product (kèm aggregateRating
  // khi có review thật), BreadcrumbList, FAQPage (khi có FAQ), VideoObject (mỗi
  // video có thumbnail). Hàm builder tự bỏ field rỗng → không khai schema lỗi.
  // SEO sống ở server component; phần thân hiển thị do <ProductView> đảm nhiệm.
  const jsonLdBlocks: string[] = [
    serializeJsonLd(buildProductJsonLd(product)),
    serializeJsonLd(buildBreadcrumbJsonLd(product)),
  ];
  if (faqs.length > 0) {
    jsonLdBlocks.push(serializeJsonLd(buildFaqPageJsonLd(faqs)));
  }
  for (const videoLd of buildVideoObjectsJsonLd(videos, product)) {
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
      <ProductView product={product} settings={settings} />
    </>
  );
}
