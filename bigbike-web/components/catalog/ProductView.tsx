"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { listPublicSettings } from "@/lib/api/public-api";

import { WpPurchaseSection } from "@/components/wp/WpPurchaseSection";
import { WpThemeStylesheet } from "@/components/wp/WpThemeStylesheet";
import { LText, LocalizedContentProvider, useLocalizedField } from "@/components/i18n/LocalizedContent";
import { Tr } from "@/components/i18n/Tr";
import {
  ProductContentBottom,
  ProductDescriptionTab,
  ProductFaqs,
  ProductProsCons,
  ProductSpecsTable,
  ProductVideosSection,
} from "@/components/catalog/ProductLocalizedParts";
import {
  ProductDescriptionBlocks,
  ProductSizeGuideSection,
  ProductSuitabilitySection,
} from "@/components/catalog/ProductDescriptionBlocks";
import { FeaturedSpecsBar } from "@/components/catalog/FeaturedSpecsBar";
import { ProductSwiper } from "@/components/catalog/ProductSwiper";
import { ReadingProgressBar } from "@/components/catalog/ReadingProgressBar";
import { ReviewsSection } from "@/components/catalog/ReviewsSection";
import { WriteReviewDialog } from "@/components/catalog/WriteReviewDialog";
import { RecentlyViewedSection } from "@/components/catalog/RecentlyViewedSection";
import { ProductContactCta } from "@/components/catalog/ProductContactCta";
import { MobilePdpAnchorNav, type AnchorNavItem } from "@/components/catalog/MobilePdpAnchorNav";
import { PdpSectionHeading, PDP_SECTION_SEP } from "@/components/catalog/product-view/PdpSection";
import { buildTrustItems, ProductTrustCard } from "@/components/catalog/product-view/ProductTrustCard";
import type { RecentProduct } from "@/lib/recently-viewed";
import type { BrandSummary, CategorySummary, DescriptionBlock, Product, PublicSiteSetting } from "@/lib/contracts/public";
import { safeArray, safeText } from "@/lib/utils/format";
import { pickSetting } from "@/lib/utils/settings";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";

type ProductViewProps = {
  product: Product;
  /** Site settings for the bottom contact band + trust block NAP. Public PDP passes
   *  server-fetched settings; live-preview fetches the same public endpoint client-side
   *  so Hotline/Địa chỉ match the live page. */
  settings: PublicSiteSetting[];
  /**
   * Live-preview mode (admin editor iframe). Skips sections that fetch by a
   * real product id or have browser side effects — reviews + "recently viewed"
   * — and the locale-switch provider, since the previewed product is an unsaved
   * draft already resolved to the chosen locale by the backend dry-run.
   */
  previewMode?: boolean;
};

/**
 * `brand.name`/`category.name` resolve theo locale ở backend (JpaCatalogReadRepository
 * toCategorySummary/toBrandSummary — cùng cơ chế pick() với các field khác). `ProductView`
 * tạo ra `LocalizedContentProvider` bên dưới nên KHÔNG thể gọi `useLocalizedField` ngay
 * trong thân hàm của chính nó (chạy trước khi provider tồn tại) — phải tách một component
 * con thật sự nằm TRONG cây con của provider, giống cách `LText`/`WpPurchaseSection` làm.
 */
function LocalizedTaxonomyName({ field, viName }: { field: "brand" | "category"; viName: string }) {
  const locale = useLocale();
  const localized = useLocalizedField<CategorySummary | BrandSummary>(field);
  return <>{locale === "en" ? safeText(localized?.name, "") : viName}</>;
}

/**
 * "Sản phẩm tương tự"/"Phụ kiện" — mảng `relatedProducts`/`accessoryProducts` cũng resolve
 * theo locale ở backend (`toDomainListItem`, cùng field mỗi sản phẩm con). Cùng lý do trên,
 * phải đọc `useLocalizedField` trong một component con nằm trong provider, không phải ở
 * thân `ProductView`.
 */
function LocalizedProductSwiper({
  field,
  viProducts,
  currentProductId,
}: {
  field: "relatedProducts" | "accessoryProducts";
  viProducts: Product[];
  currentProductId: string;
}) {
  const locale = useLocale();
  const enProducts = useLocalizedField<Product[]>(field);
  const products = safeArray(locale === "en" ? enProducts : viProducts).filter(
    (p) => p.id !== currentProductId,
  );
  return <ProductSwiper products={products} autoHeight />;
}

/**
 * Presentational body of the product detail page. Shared 1:1 by the public PDP
 * (`app/product/[slug]/page.tsx`) and the admin live-preview iframe
 * (`app/preview/product/page.tsx`) so the preview is byte-faithful to what
 * customers see. SEO concerns (metadata, JSON-LD) stay in the server page; this
 * component owns only the visible body.
 */

/**
 * Dòng tin cậy MOBILE thay chỗ breadcrumb (breadcrumb ẩn <768px) — logic y hệt bản gốc trên
 * tên sản phẩm (WpPurchaseSection). Tách thành component riêng (không gọi hook thẳng trong
 * ProductView) vì `useLocalizedField` cần đứng DƯỚI LocalizedContentProvider trong cây React
 * để đọc đúng context bản EN — ProductView là cha của Provider nên gọi hook ở đó luôn ra rỗng.
 */
function MobileTrustLine({ product }: { product: Product }) {
  const locale = useLocale();
  const enTrustHtml = useLocalizedField<string>("trustBadges");
  const trustBadgesResolvedHtml = locale === "en" ? enTrustHtml ?? "" : product.trustBadges ?? "";

  if (trustBadgesResolvedHtml.trim()) {
    return (
      <div
        className="md:hidden max-md:mt-4 max-md:mb-4 mb-11 bb-trust-badges-html"
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(trustBadgesResolvedHtml, { allowInlineStyles: true }) }}
      />
    );
  }
  return null;
}

export function ProductView({ product, settings, previewMode = false }: ProductViewProps) {
  const locale = useLocale();
  const tProduct = useTranslations("Product");

  // Fetch site settings client-side using the active locale to ensure we get English translations of
  // static fields (hours, address, zalo) when locale = "en".
  const { data: freshSettingsResult } = useQuery({
    queryKey: ["public-settings", locale],
    queryFn: () => listPublicSettings(locale),
    initialData: { data: settings, error: null },
    staleTime: 5 * 60 * 1000,
  });
  const activeSettings = freshSettingsResult?.data ?? settings;

  const name = safeText(product.name, tProduct("fallbackShortName") || "Sản phẩm");

  // Nhãn cho thanh nhảy-mục MOBILE (anchor nav tổng ở đầu nội dung).
  const tTab = useTranslations("Product.tabs");

  // Business NAP — same key set as footer / contact page so the bottom contact
  // band shows site-wide values (consistent local-SEO). Live-preview also loads
  // these (client fetch) so the trust block + contact band match the live page.
  const siteName = pickSetting(activeSettings, ["site_name"]) || "BigBike";
  const contactAddress = pickSetting(activeSettings, ["contact_address", "address"]);
  const hotline = pickSetting(activeSettings, ["hotline", "phone"]);
  const zaloUrl = pickSetting(activeSettings, ["zalo_url"]);
  const zaloDisplay = pickSetting(activeSettings, ["zalo_display"]);
  const hoursWeekday = pickSetting(activeSettings, ["opening_hours_weekday"]);
  const hoursWeekend = pickSetting(activeSettings, ["opening_hours_weekend"]);
  // Khối cam kết dưới nút mua hàng (V232) + dải tin cậy trên tên sản phẩm (V233) giờ quản theo
  // TỪNG sản phẩm (product.commitments / product.trustBadges) — WpPurchaseSection tự đọc thẳng
  // từ product, không còn lấy từ settings.
  const gallery = safeArray(product.gallery);
  // Canonical layout (PDP_CONTENT_GUIDE §0b): "Phù hợp với ai" (#7) và "Bảng size" (#8) là SECTION RIÊNG,
  // thứ tự CỐ ĐỊNH ngay sau Ưu/Nhược điểm + Sản phẩm liên quan — KHÔNG để admin chèn lẫn giữa mô tả.
  // Từ V327/V328, backend không còn trả 2 loại này bên trong descriptionBlocks — đọc thẳng field riêng.
  const descBlocks = safeArray(product.descriptionBlocks) as DescriptionBlock[];
  const suitabilitySection = product.suitabilitySection ?? null;
  const sizeGuideSection = product.sizeGuideSection ?? null;
  // "Dán mã HTML" cho Thông số kỹ thuật (V255) — HTML là nguồn render duy nhất.
  const specsHtml = product.specifications?.trim() ? product.specifications : "";
  // "Dán mã HTML" cho Ô số liệu nổi bật (V256) — HTML là nguồn render duy nhất.
  const specStatsResolvedHtml = product.specStats?.trim() ? product.specStats : "";
  const faqs = safeArray(product.faqs);
  const videos = safeArray(product.videos);
  const related = safeArray(product.relatedProducts).filter((p) => p.id !== product.id);
  const accessories = safeArray(product.accessoryProducts).filter((p) => p.id !== product.id);
  const rating = product.rating ?? null;
  const ratingCount = product.ratingCount ?? null;

  const descriptionHtml = product.description ? sanitizeRichHtml(product.description) : "";
  const contentBottomHtml = product.contentBottom ? sanitizeRichHtml(product.contentBottom) : "";
  // "Quick Answer" (trả lời nhanh, V300) — đoạn tóm tắt AIO, blockquote #3 ngay sau Specs Dashboard.
  const quickAnswer = safeText(product.quickAnswerSummary, "");

  // "Mô tả / Tính năng" (#4) chỉ gồm phần mô tả thuần (đã tách Phù hợp với ai · Bảng size ra khối riêng).
  const hasDescription = descBlocks.length > 0 || Boolean(descriptionHtml);

  // Ưu/Nhược điểm (V251): tách RA khỏi mô tả — KHỐI RIÊNG cố định ngay dưới mô tả, NGOÀI tab (nguồn
  // product_highlights). Schema.org positiveNotes/negativeNotes suy ra từ đây (json-ld).
  const positiveNotes = safeArray(product.positiveNotes);
  const negativeNotes = safeArray(product.negativeNotes);

  const brand = product.brand ?? null;
  const category = product.category?.slug === "chua-phan-loai" ? null : (product.category ?? null);

  const recentRecord: RecentProduct = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price?.retailPrice ?? null,
    imageUrl: product.image?.url ?? gallery[0]?.image?.url ?? null,
    categoryName: product.category?.name ?? null,
    rating: product.rating ?? null,
    ratingCount: product.ratingCount ?? null,
  };

  // Mọi khối tự hiện khi CÓ nội dung (đã gỡ chức năng "Hiển thị trên web" — không còn bật/tắt từng phần).
  const showSpecs = Boolean(specsHtml);
  const showFaqs = faqs.length > 0;
  const showVideos = videos.length > 0;
  const showReviews = !previewMode;
  const showProsCons = positiveNotes.length > 0 || negativeNotes.length > 0;
  const showRelated = related.length > 0;
  const showAccessories = accessories.length > 0;
  const showSuitability = Boolean(suitabilitySection?.html?.trim());
  const showSizeGuide = Boolean(sizeGuideSection?.html?.trim());

  // Trust block "Mua tại BigBike.vn" (#12) — lưới Giá/Kho realtime + Cam kết (cùng nguồn
  // product.commitments với khối dưới nút mua) + footer liên hệ (xem product-view/ProductTrustCard).
  // Tự ẩn khi rỗng cả ba. Tiêu đề dùng CHUNG <PdpSectionHeading> như mọi section khác (huy hiệu
  // "Chính hãng" ở slot `end` cùng hàng) — tự vẽ bên TRONG ProductTrustCard, không lặp lại ở đây.
  const trustItems = buildTrustItems({ product, previewMode });
  const hasTrustContact = Boolean(hotline || contactAddress);
  const hasTrustCommitments = safeArray(product.commitments).some((c) => c.title);
  const trustCard =
    trustItems.length > 0 || hasTrustContact || hasTrustCommitments ? (
      <ProductTrustCard
        items={trustItems}
        viCommitments={safeArray(product.commitments)}
        hotline={hotline}
        zaloDisplay={zaloDisplay}
        zaloUrl={zaloUrl}
        contactAddress={contactAddress}
        hoursWeekday={hoursWeekday}
        hoursWeekend={hoursWeekend}
      />
    ) : null;

  // Thanh nhảy-mục MOBILE (anchor nav tổng) — đặt ở đầu phần nội dung, phủ TOÀN BỘ section theo đúng thứ
  // tự trang (PDP_CONTENT_GUIDE §0b). Mỗi mục cuộn tới id tương ứng — mọi khối đều flat (id "pdp-*" /
  // "reviews"), không còn cụm widget tab riêng cho mobile. Tự bỏ mục khi section rỗng.
  const anchorItems: AnchorNavItem[] = [];
  if (hasDescription) anchorItems.push({ id: "pdp-description", label: tTab("description") });
  if (showSizeGuide) anchorItems.push({ id: "pdp-sizeguide", label: tTab("size") });
  if (showSpecs) anchorItems.push({ id: "pdp-specifications", label: tTab("specs") });
  if (showFaqs) anchorItems.push({ id: "pdp-faqs", label: tTab("faqs") });
  if (showVideos) anchorItems.push({ id: "pdp-videos", label: tTab("videos") });
  if (showReviews) anchorItems.push({ id: "reviews", label: tTab("reviews") });

  // Thứ tự CỐ ĐỊNH các section body theo canonical layout (PDP_CONTENT_GUIDE §0b — sơ đồ "thứ tự đầy đủ
  // trang sản phẩm" của chủ shop): Tính năng chi tiết (Mô tả) → Ưu/Nhược + Sản phẩm tương tự → Phù hợp với
  // ai → Bảng size → Thông số kỹ thuật → FAQ → Video → Đánh giá → Trust → Phụ kiện. Mọi khối render FLAT,
  // GIỐNG HỆT NHAU trên cả desktop lẫn mobile (đã bỏ widget tab gộp — anchor nav đầu trang đã đủ để nhảy
  // nhanh tới từng mục). "Sản phẩm đã xem gần đây" render riêng.
  const bodyOrder = [
    "description", "prosConsRelated", "suitability", "sizeGuide",
    "specifications", "faqs", "videos", "reviews",
    "trust", "accessories",
  ];

  // Các section body — render theo thứ tự cố định ở trên.
  const bodyNodes: Record<string, ReactNode> = {};

  // "Tính năng chi tiết" (#4) — khối flat hiển thị CẢ desktop lẫn mobile (đã tách khỏi widget tab).
  if (hasDescription) {
    bodyNodes.description = (
      <div key="description" id="pdp-description" className={`scroll-mt-[var(--bb-header-height)] ${PDP_SECTION_SEP}`}>
        <ProductDescriptionBlocks
          blocks={descBlocks}
          fallback={<ProductDescriptionTab viHtml={descriptionHtml} />}
        />
      </div>
    );
  }

  // Ưu/Nhược điểm (V251) + Sản phẩm tương tự gộp MỘT section chung (ngoài tab) — 2 phần liên quan nhau.
  // Một vạch hairline ở ĐẦU section (không có vạch ngăn giữa 2 phần → đọc liền mạch "nhược điểm → xem
  // lựa chọn khác"). Mỗi phần tự ẩn khi rỗng; cả section ẩn khi cả hai rỗng. Hiện trên CẢ desktop lẫn
  // mobile (không nằm trong widget tab). Carousel dùng chung nhịp section (tiêu đề căn trái) như mọi khối.
  if (showProsCons || showRelated) {
    bodyNodes.prosConsRelated = (
      <div key="prosConsRelated" id="pdp-proscons" className={`scroll-mt-[var(--bb-header-height)] ${PDP_SECTION_SEP}`}>
        <section>
          {showProsCons ? (
            <>
              <PdpSectionHeading title={<Tr ns="Product" k="prosConsTitle" />} />
              <ProductProsCons positiveNotes={positiveNotes} negativeNotes={negativeNotes} />
            </>
          ) : null}
          {showRelated ? (
            <div className={showProsCons ? "mt-8 max-md:mt-6" : ""}>
              {showProsCons ? (
                // Câu dẫn nối — biến 2 phần thành MỘT mạch: khách vừa đọc nhược điểm/giá → mời xem lựa
                // chọn khác NGAY trong cùng khối (giữ ở lại site). Thay tiêu đề lớn "Sản phẩm tương tự"
                // (vốn đọc thành chủ đề tách biệt). Khi KHÔNG có ưu/nhược điểm thì dùng tiêu đề thường.
                <p className="!mb-0 flex items-start gap-2 text-18 max-md:text-ui-16 font-medium text-foreground">
                  <span aria-hidden className="font-bold text-brand">→</span>
                  <Tr ns="Product" k="relatedBridge" />
                </p>
              ) : (
                <PdpSectionHeading title={<Tr ns="Product" k="relatedTitle" />} />
              )}
              <LocalizedProductSwiper field="relatedProducts" viProducts={related} currentProductId={product.id} />
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  // "Phù hợp với ai" (#7) — SECTION riêng ngay sau cụm Ưu/Nhược + Sản phẩm liên quan. Hiện cả desktop lẫn
  // mobile (NGOÀI widget tab, như prosConsRelated). Tiêu đề lấy từ chính khối (admin nhập).
  if (showSuitability) {
    bodyNodes.suitability = (
      <div key="suitability" id="pdp-suitability" className={`scroll-mt-[var(--bb-header-height)] ${PDP_SECTION_SEP}`}>
        <section>
          <ProductSuitabilitySection section={suitabilitySection} />
        </section>
      </div>
    );
  }

  // "Bảng size" (#8) — SECTION riêng ngay sau "Phù hợp với ai".
  if (showSizeGuide) {
    bodyNodes.sizeGuide = (
      <div key="sizeGuide" id="pdp-sizeguide" className={`scroll-mt-[var(--bb-header-height)] ${PDP_SECTION_SEP}`}>
        <section>
          <ProductSizeGuideSection section={sizeGuideSection} />
        </section>
      </div>
    );
  }

  // Thông số kỹ thuật / FAQ / Video — khối flat, hiện GIỐNG HỆT NHAU trên cả desktop lẫn mobile (đã bỏ
  // widget tab gộp riêng mobile). `id` khớp với anchorItems ở trên để anchor nav mobile nhảy tới đúng chỗ.
  if (showSpecs) {
    bodyNodes.specifications = (
      <div key="specifications" id="pdp-specifications" className={`scroll-mt-[var(--bb-header-height)] ${PDP_SECTION_SEP}`}>
        <section>
          <PdpSectionHeading title={<Tr ns="Product" k="specifications" />} />
          <ProductSpecsTable viSpecsHtml={specsHtml} />
        </section>
      </div>
    );
  }

  if (showFaqs) {
    bodyNodes.faqs = (
      <div key="faqs" id="pdp-faqs" className={`scroll-mt-[var(--bb-header-height)] ${PDP_SECTION_SEP}`}>
        <section>
          <PdpSectionHeading title={<Tr ns="Product" k="faqs" />} />
          <ProductFaqs viFaqs={faqs} />
        </section>
      </div>
    );
  }

  if (showVideos) {
    bodyNodes.videos = (
      <div key="videos" id="pdp-videos" className={`scroll-mt-[var(--bb-header-height)] ${PDP_SECTION_SEP}`}>
        <section>
          <PdpSectionHeading title={<Tr ns="Product" k="videos" />} />
          <ProductVideosSection videos={videos} />
        </section>
      </div>
    );
  }

  // Đánh giá tự mang <section id="reviews"> + tiêu đề riêng (xem ReviewsSection) — không cần bọc thêm.
  if (showReviews) {
    bodyNodes.reviews = <ReviewsSection productId={product.id} />;
  }

  if (trustCard) {
    bodyNodes.trust = (
      <div key="trust" id="pdp-trust" className={`scroll-mt-[var(--bb-header-height)] ${PDP_SECTION_SEP}`}>
        <section>{trustCard}</section>
      </div>
    );
  }

  if (showAccessories) {
    // Cùng nhịp section như "Sản phẩm tương tự" — tiêu đề căn trái + vạch hairline, đồng đều toàn trang.
    bodyNodes.accessories = (
      <div key="accessories" id="pdp-accessories" className={`scroll-mt-[var(--bb-header-height)] ${PDP_SECTION_SEP}`}>
        <section>
          <PdpSectionHeading title={<Tr ns="Product" k="crossSellTitle" />} />
          <LocalizedProductSwiper field="accessoryProducts" viProducts={accessories} currentProductId={product.id} />
        </section>
      </div>
    );
  }

  const inner = (
    <div id="main-content" className="bb-wp-pdp-page">
      {/* Vạch tiến độ đọc — chỉ mobile (khớp mockup). Fixed top nên vị trí trong DOM
          không ảnh hưởng; đặt đầu khối cho dễ thấy. */}
      <ReadingProgressBar />
      <div className="container">
        <div className="breadcrumb max-md:hidden">
          <ul>
            <li>
              <Link href="/" className="home">
                <span property="name">Bigbike.vn</span>
              </Link>
            </li>
            {brand ? (
              <li>
                <LocalizedLink kind="brand" viSlug={brand.slug} enSlug={brand.slugEn} className="taxonomy">
                  <span property="name"><LocalizedTaxonomyName field="brand" viName={brand.name} /></span>
                </LocalizedLink>
              </li>
            ) : category ? (
              <li>
                <LocalizedLink kind="category" viSlug={category.slug} enSlug={category.slugEn} className="taxonomy">
                  <span property="name"><LocalizedTaxonomyName field="category" viName={category.name} /></span>
                </LocalizedLink>
              </li>
            ) : null}
            <li>
              <span className="post post-product current-item">
                <LText field="name">{name}</LText>
              </span>
            </li>
          </ul>
        </div>

        <MobileTrustLine product={product} />

        <div id="pdp-overview" className="product-detail product sidebar">
          <WpPurchaseSection
            product={product}
            gallery={gallery}
            rating={rating}
            ratingCount={ratingCount}
            zaloUrl={zaloUrl || undefined}
            previewMode={previewMode}
          />
        </div>

        {/* Modal viết đánh giá — mount MỘT lần cho cả PDP. Mọi nút "Viết đánh giá"
            (khối mua hàng trên + khối đánh giá dưới) đều mở modal này thay vì cuộn
            xuống form inline. Bỏ qua ở chế độ xem trước (sản phẩm nháp chưa có id). */}
        {!previewMode && <WriteReviewDialog productId={product.id} />}

        {/* #2 Specs Dashboard (V235) — tối đa 4 ô số liệu nổi bật ngay dưới khu vực mua hàng.
            "Đòn chốt" bán hàng. Khối ngoài tab → tự ẩn khi không có ô nào (không gate visibility). */}
        <FeaturedSpecsBar viStatsHtml={specStatsResolvedHtml} />

        {/* #3 Quick Answer (V300) — đoạn tóm tắt AIO 40–60 từ để Google/AI trích dẫn. Blockquote ngay
            sau Specs Dashboard, trước "Tính năng chi tiết". Tự ẩn khi rỗng, không gate visibility. */}
        {quickAnswer ? (
          <section className="my-10">
            <blockquote className="border-l-4 border-brand bg-muted px-5 py-4 text-18 leading-relaxed text-foreground">
              <LText field="quickAnswerSummary">{quickAnswer}</LText>
            </blockquote>
          </section>
        ) : null}

        {/* Thanh nhảy-mục MOBILE (anchor nav tổng) — nổi vào sau khi khu mua hàng (#pdp-overview) cuộn khỏi
            tầm nhìn, phủ TOÀN BỘ section theo đúng thứ tự trang. Tự ẩn trên desktop (component có md:!hidden).
            Chỉ hiện khi có từ 2 mục trở lên. */}
        {anchorItems.length > 1 && (
          <MobilePdpAnchorNav items={anchorItems} triggerSelector="#pdp-overview" />
        )}

        {/* Body sections — render theo thứ tự canonical (PDP_CONTENT_GUIDE §0b), GIỐNG HỆT NHAU trên cả
            desktop lẫn mobile (không còn cụm widget tab riêng cho mobile). */}
        {bodyOrder.map((key) => {
          const node = bodyNodes[key];
          return node ? <div key={key}>{node}</div> : null;
        })}

        {/* Nội dung dài SEO (contentBottom) — dưới lưới sản phẩm gợi ý; chỉ render khi admin có nhập.
            Không thuộc panel "Hiển thị trên web" (admin không soạn ở form sản phẩm) → chỉ gate theo nội dung. */}
        {contentBottomHtml ? (
          <section className="product-content-bottom mb-40">
            <ProductContentBottom viHtml={contentBottomHtml} />
          </section>
        ) : null}

        {/* Sản phẩm khách đã xem — lưu localStorage; bỏ qua trong preview. */}
        {!previewMode && (
          <RecentlyViewedSection currentProductId={product.id} currentProduct={recentRecord} />
        )}

        {/* Dải liên hệ cửa hàng ở chân trang (local-SEO). Lấy từ system settings. */}
        <ProductContactCta
          productName={name}
          siteName={siteName}
          address={contactAddress || undefined}
          zaloUrl={zaloUrl || undefined}
        />
      </div>
    </div>
  );

  return (
    <>
      <WpThemeStylesheet href="/wp-content/themes/bigbike/css/wp-theme-product.css?v=11" />
      {previewMode ? (
        inner
      ) : (
        <LocalizedContentProvider kind="product" slug={product.slug}>
          {inner}
        </LocalizedContentProvider>
      )}
    </>
  );
}
