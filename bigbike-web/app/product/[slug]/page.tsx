import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";

import { WpPurchaseSection } from "@/components/wp/WpPurchaseSection";
import { WpProductTabs, type WpTab } from "@/components/wp/WpProductTabs";
import { LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import { Tr } from "@/components/i18n/Tr";
import {
  ProductDescriptionTab,
  ProductFaqs,
  ProductSpecsTable,
} from "@/components/catalog/ProductLocalizedParts";
import { ProductSwiper } from "@/components/catalog/ProductSwiper";
import { ReviewsSection } from "@/components/catalog/ReviewsSection";
import { RecentlyViewedSection } from "@/components/catalog/RecentlyViewedSection";
import { ProductContactCta } from "@/components/catalog/ProductContactCta";
import type { RecentProduct } from "@/lib/recently-viewed";
import { getProductBySlug, listPublicSettings } from "@/lib/api/public-api";
import { buildProductJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeArray, safeText } from "@/lib/utils/format";
import { pickSetting } from "@/lib/utils/settings";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toBrandPath, toCategoryPath, toProductPath } from "@/lib/utils/routes";
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
  return buildPublicMetadata({
    title: product.seo?.title ?? product.name,
    description: product.seo?.description ?? product.shortDescription ?? product.name,
    canonicalPath: product.seo?.canonicalUrl ?? toProductPath(product.slug),
    ogImage: product.seo?.ogImage?.url ?? product.image?.url ?? undefined,
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

  const name = safeText(product.name, "Sản phẩm");

  // Business NAP — cùng bộ key với footer / trang liên hệ, để dải liên hệ ở chân
  // PDP hiển thị y hệt giá trị toàn site (nhất quán local-SEO).
  const settings = settingsResult.data ?? [];
  const siteName = pickSetting(settings, ["site_name"]) || "BigBike";
  const contactAddress = pickSetting(settings, ["contact_address", "address"]);
  const hotline = pickSetting(settings, ["hotline", "phone"]);
  const zaloUrl = pickSetting(settings, ["zalo_url"]);
  const gallery = safeArray(product.gallery);
  const specs = safeArray(product.specifications);
  const faqs = safeArray(product.faqs);
  const videos = safeArray(product.videos);
  const related = safeArray(product.relatedProducts).filter((p) => p.id !== product.id);
  const rating = product.rating ?? null;
  const ratingCount = product.ratingCount ?? null;

  const descriptionHtml = product.description ? sanitizeRichHtml(product.description) : "";
  const shortDescriptionHtml = product.shortDescription
    ? sanitizeRichHtml(product.shortDescription)
    : "";

  const brand = product.brand ?? null;
  const category = product.category?.slug === "chua-phan-loai" ? null : (product.category ?? null);

  const productJsonLd = serializeJsonLd(buildProductJsonLd(product));

  // Bản ghi gọn để lưu vào lịch sử "Sản phẩm đã xem" (localStorage trên máy khách).
  const recentRecord: RecentProduct = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price?.retailPrice ?? null,
    // Detail API không trả `image` (chỉ `gallery`) → fallback ảnh đầu gallery
    // để thẻ "đã xem" có ảnh thật thay vì logo placeholder.
    imageUrl: product.image?.url ?? gallery[0]?.url ?? null,
    categoryName: product.category?.name ?? null,
    rating: product.rating ?? null,
    ratingCount: product.ratingCount ?? null,
  };

  // Như code cũ (trước port WP): KHÔNG có tab "Videos" riêng — video được ghép
  // thẳng vào dải gallery (xem WpPurchaseSection → ProductGallery). Danh sách tab
  // luôn hiện đủ; tab nào chưa có dữ liệu vẫn hiển thị với nội dung fallback.
  const tabs: WpTab[] = [
    {
      id: "tab-description",
      label: "Mô tả",
      labelKey: "description",
      content: (
        <ProductDescriptionTab
          viHtml={descriptionHtml || "<p>Chưa có mô tả cho sản phẩm này.</p>"}
        />
      ),
    },
    {
      id: "tab-more_infomation",
      label: "Thông số kĩ thuật",
      labelKey: "specs",
      content: (
        <ProductSpecsTable
          viSpecs={specs}
          emptyLabel="Chưa có thông số kĩ thuật cho sản phẩm này."
        />
      ),
    },
    {
      id: "tab-faq",
      label: "Câu hỏi thường gặp",
      labelKey: "faqs",
      content: (
        <ProductFaqs viFaqs={faqs} emptyLabel="Chưa có câu hỏi thường gặp cho sản phẩm này." />
      ),
    },
  ];

  return (
    <>
      <link
        rel="stylesheet"
        href="/wp-content/themes/bigbike/css/wp-theme-product.css?v=11"
        precedence="default"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />

      <LocalizedContentProvider kind="product" slug={product.slug}>
      <div id="main-content">
        <div className="container">
      <div className="breadcrumb">
        <ul>
          <li>
            <Link href="/" className="home">
              <span property="name">Bigbike.vn</span>
            </Link>
          </li>
          {brand ? (
            <li>
              <Link href={toBrandPath(brand.slug)} className="taxonomy">
                <span property="name">{brand.name}</span>
              </Link>
            </li>
          ) : category ? (
            <li>
              <Link href={toCategoryPath(category.slug)} className="taxonomy">
                <span property="name">{category.name}</span>
              </Link>
            </li>
          ) : null}
          <li>
            <span className="post post-product current-item">
              <LText field="name">{name}</LText>
            </span>
          </li>
        </ul>
      </div>

      <div id="pdp-overview" className="product-detail product sidebar">
        <WpPurchaseSection
          product={product}
          gallery={gallery}
          videos={videos}
          shortDescriptionHtml={shortDescriptionHtml}
          rating={rating}
          ratingCount={ratingCount}
        />
      </div>

      {tabs.length > 0 && (
        <WpProductTabs tabs={tabs} anchorExtras={[{ id: "reviews", labelKey: "reviews" }]} />
      )}

      {/* Đánh giá sản phẩm — danh sách review đã duyệt + form gửi đánh giá (chờ
          kiểm duyệt). Dùng lại ReviewsSection (tự gọi /api/products/{id}/reviews). */}
      <ReviewsSection productId={product.id} />

      {related.length > 0 && (
        <div className="product-list pt-80 pb-40">
          <div className="container">
            <div className="block-title text-center mb-40">
              <p className="sub-title"><Tr ns="Home" k="relatedKicker" /></p>
              <h3><Tr ns="Home" k="relatedTitle" /></h3>
            </div>
            <ProductSwiper products={related} />
          </div>
        </div>
      )}

      {/* Sản phẩm khách đã xem — lịch sử lưu trên trình duyệt, tự bỏ qua sản
          phẩm đang xem; chỉ hiện khi có từ 2 sản phẩm khác trở lên. */}
      <RecentlyViewedSection currentProductId={product.id} currentProduct={recentRecord} />

      {/* Dải liên hệ cửa hàng ở chân trang (local-SEO): "Mua <sản phẩm> chính
          hãng tại <shop>" + địa chỉ, hotline, Zalo — lấy từ system settings,
          đồng bộ với footer / trang liên hệ. Đặt TRONG .container để dùng chung
          đúng một rail width/lề 2 bên với các section phía trên ở mọi breakpoint. */}
      <ProductContactCta
        productName={name}
        siteName={siteName}
        address={contactAddress || undefined}
        hotline={hotline || undefined}
        zaloUrl={zaloUrl || undefined}
      />
        </div>
      </div>
      </LocalizedContentProvider>
    </>
  );
}
