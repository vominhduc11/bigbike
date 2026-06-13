import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Minus, Plus } from "lucide-react";

import { WpPurchaseSection } from "@/components/wp/WpPurchaseSection";
import { WpProductTabs, type WpTab } from "@/components/wp/WpProductTabs";
import { WpThemeStylesheet } from "@/components/wp/WpThemeStylesheet";
import { LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import { Tr } from "@/components/i18n/Tr";
import {
  ProductContentBottom,
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
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildProductJsonLd,
  buildVideoObjectsJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
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
  // Nội dung dài SEO cuối trang (checklist #27 — tăng độ sâu nội dung). Field đã
  // có trong type/API nhưng trước đây KHÔNG render; nay hiển thị dưới khối tab.
  const contentBottomHtml = product.contentBottom ? sanitizeRichHtml(product.contentBottom) : "";

  // Template SEO fields (V175). Đã resolve theo locale ở server.
  const positiveNotes = safeArray(product.positiveNotes)
    .map((n) => safeText(n.content, ""))
    .filter(Boolean);
  const negativeNotes = safeArray(product.negativeNotes)
    .map((n) => safeText(n.content, ""))
    .filter(Boolean);
  const warrantyMonths = product.warrantyMonths ?? null;
  const warrantyScope = safeText(product.warrantyScope, "");
  const originBrandCountry = safeText(product.originBrandCountry, "");
  const originManufactureCountry = safeText(product.originManufactureCountry, "");
  const weightGrams = product.weightGrams ?? null;
  const sizeGuideHtml = product.sizeGuide ? sanitizeRichHtml(product.sizeGuide) : "";
  const hasTrustInfo =
    warrantyMonths != null ||
    Boolean(warrantyScope) ||
    Boolean(originBrandCountry) ||
    Boolean(originManufactureCountry) ||
    weightGrams != null;

  const brand = product.brand ?? null;
  const category = product.category?.slug === "chua-phan-loai" ? null : (product.category ?? null);

  // Bộ JSON-LD cho PDP (mỗi loại 1 thẻ <script>): Product (kèm aggregateRating
  // khi có review thật), BreadcrumbList, FAQPage (khi có FAQ), VideoObject (mỗi
  // video có thumbnail). Hàm builder tự bỏ field rỗng → không khai schema lỗi.
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
        <ProductDescriptionTab viHtml={descriptionHtml} />
      ),
    },
    {
      id: "tab-more_infomation",
      label: "Thông số kĩ thuật",
      labelKey: "specs",
      content: (
        <ProductSpecsTable viSpecs={specs} />
      ),
    },
    {
      id: "tab-faq",
      label: "Câu hỏi thường gặp",
      labelKey: "faqs",
      content: (
        <ProductFaqs viFaqs={faqs} />
      ),
    },
  ];

  return (
    <>
      <WpThemeStylesheet href="/wp-content/themes/bigbike/css/wp-theme-product.css?v=11" />
      {jsonLdBlocks.map((block, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: block }}
        />
      ))}

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

      {/* Ưu điểm & Nhược điểm (V175) — USP độc quyền của BigBike, đặt nổi bật ngay
          dưới khối mua hàng. Đồng bộ schema positiveNotes/negativeNotes. */}
      {(positiveNotes.length > 0 || negativeNotes.length > 0) && (
        <section className="my-10 grid gap-6 md:grid-cols-2">
          {positiveNotes.length > 0 && (
            <div className="border border-border p-5">
              <h2 className="mb-3 font-heading text-lg font-semibold uppercase"><Tr ns="Product" k="prosTitle" /></h2>
              <ul className="flex flex-col gap-2">
                {positiveNotes.map((note, index) => (
                  <li key={index} className="flex gap-2 text-foreground">
                    <Plus className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {negativeNotes.length > 0 && (
            <div className="border border-border p-5">
              <h2 className="mb-3 font-heading text-lg font-semibold uppercase"><Tr ns="Product" k="consTitle" /></h2>
              <ul className="flex flex-col gap-2">
                {negativeNotes.map((note, index) => (
                  <li key={index} className="flex gap-2 text-foreground">
                    <Minus className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Thông tin tin cậy (V175): bảo hành, xuất xứ, trọng lượng — dạng định nghĩa. */}
      {hasTrustInfo && (
        <section className="my-10">
          <h2 className="mb-3 font-heading text-lg font-semibold uppercase"><Tr ns="Product" k="infoTitle" /></h2>
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {warrantyMonths != null && (
              <div className="flex justify-between gap-4 border-b border-border py-2">
                <dt className="text-muted-foreground"><Tr ns="Product" k="warranty" /></dt>
                <dd className="font-medium text-right">{warrantyMonths} <Tr ns="Product" k="monthsUnit" /></dd>
              </div>
            )}
            {weightGrams != null && (
              <div className="flex justify-between gap-4 border-b border-border py-2">
                <dt className="text-muted-foreground"><Tr ns="Product" k="weight" /></dt>
                <dd className="font-medium text-right">{weightGrams.toLocaleString("vi-VN")} g</dd>
              </div>
            )}
            {originBrandCountry && (
              <div className="flex justify-between gap-4 border-b border-border py-2">
                <dt className="text-muted-foreground"><Tr ns="Product" k="brand" /></dt>
                <dd className="font-medium text-right">{originBrandCountry}</dd>
              </div>
            )}
            {originManufactureCountry && (
              <div className="flex justify-between gap-4 border-b border-border py-2">
                <dt className="text-muted-foreground"><Tr ns="Product" k="madeIn" /></dt>
                <dd className="font-medium text-right">{originManufactureCountry}</dd>
              </div>
            )}
            {warrantyScope && (
              <div className="flex justify-between gap-4 border-b border-border py-2 sm:col-span-2">
                <dt className="text-muted-foreground"><Tr ns="Product" k="warrantyScope" /></dt>
                <dd className="font-medium text-right">{warrantyScope}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {tabs.length > 0 && (
        <WpProductTabs tabs={tabs} anchorExtras={[{ id: "reviews", labelKey: "reviews" }]} />
      )}

      {/* Bảng size (V175) — HTML table do admin nhập, sanitize trước khi render. */}
      {sizeGuideHtml ? (
        <section className="my-10">
          <h2 className="mb-3 font-heading text-lg font-semibold uppercase"><Tr ns="Product" k="sizeGuideTitle" /></h2>
          <div className="wyswyg" dangerouslySetInnerHTML={{ __html: sizeGuideHtml }} />
        </section>
      ) : null}

      {/* Nội dung dài SEO (contentBottom) — đặt ngay dưới khối tab mô tả/thông
          số/FAQ, nối tiếp mạch nội dung sản phẩm; chỉ render khi admin có nhập. */}
      {contentBottomHtml ? (
        <section className="product-content-bottom mb-40">
          <ProductContentBottom viHtml={contentBottomHtml} />
        </section>
      ) : null}

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
