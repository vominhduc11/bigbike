import type { Metadata } from "next";
import { notFound } from "next/navigation";

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

// English product detail — real server-rendered page at its own URL (không phải bản
// dịch client-side như route /product/[slug] khi cookie=en). Chỉ tồn tại cho sản phẩm
// có `slugEn`; guard bên dưới 404 nếu param không khớp đúng slugEn (PRODUCT_RULE_003).
export async function generateStaticParams() {
  return [];
}

type ProductDetailPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) return {};
  const result = await getProductBySlug(slug, "en");
  const product = result.data;
  if (!product || !product.slugEn || product.slugEn !== slug) return {};

  const canonicalPath = toProductPath(product.slugEn, "en", true);
  return buildPublicMetadata({
    title: product.seo?.title ?? product.name,
    description: product.seo?.description ?? product.shortDescription ?? product.name,
    canonicalPath,
    locale: "en",
    ogImage: product.seo?.ogImage?.url ?? product.image?.url ?? undefined,
    languageAlternates: { vi: toProductPath(product.slug), en: canonicalPath },
  });
}

export default async function ProductDetailPageEn({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) notFound();

  const [result, settingsResult] = await Promise.all([
    getProductBySlug(slug, "en"),
    listPublicSettings("en"),
  ]);

  const product = result.data;
  // Không khớp đúng slugEn của chính sản phẩm này → không có trang EN cho bản ghi
  // này (hoặc ai đó gõ nhầm slug VI vào đây) — 404, không hiển thị trùng nội dung.
  if (!product || !product.slugEn || product.slugEn !== slug) notFound();

  const settings = settingsResult.data ?? [];
  const faqs = safeArray(product.faqs);
  const videos = safeArray(product.videos);
  const canonicalPath = toProductPath(product.slugEn, "en", true);

  const jsonLdBlocks: string[] = [
    serializeJsonLd(buildProductJsonLd(product, canonicalPath)),
    serializeJsonLd(buildBreadcrumbJsonLd(product, canonicalPath)),
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
      <AltSlugRegistrar kind="product" viSlug={product.slug} enSlug={product.slugEn} />
      <ProductView product={product} settings={settings} />
    </>
  );
}
