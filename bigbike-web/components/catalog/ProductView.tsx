"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { WpPurchaseSection } from "@/components/wp/WpPurchaseSection";
import { WpThemeStylesheet } from "@/components/wp/WpThemeStylesheet";
import { LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
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
import { ProductTabsSection, type BuiltinTab } from "@/components/catalog/ProductTabsSection";
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
import type { DescriptionBlock, Product, PublicSiteSetting } from "@/lib/contracts/public";
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
 * Presentational body of the product detail page. Shared 1:1 by the public PDP
 * (`app/product/[slug]/page.tsx`) and the admin live-preview iframe
 * (`app/preview/product/page.tsx`) so the preview is byte-faithful to what
 * customers see. SEO concerns (metadata, JSON-LD) stay in the server page; this
 * component owns only the visible body.
 */

export function ProductView({ product, settings, previewMode = false }: ProductViewProps) {
  const name = safeText(product.name, "Sản phẩm");

  // Nhãn ngắn cho thanh nhảy-mục MOBILE (anchor nav tổng ở đầu nội dung).
  const tTab = useTranslations("Product.tabs");
  const tTabShort = useTranslations("Product.tabsShort");

  // Business NAP — same key set as footer / contact page so the bottom contact
  // band shows site-wide values (consistent local-SEO). Live-preview also loads
  // these (client fetch) so the trust block + contact band match the live page.
  const siteName = pickSetting(settings, ["site_name"]) || "BigBike";
  const contactAddress = pickSetting(settings, ["contact_address", "address"]);
  const hotline = pickSetting(settings, ["hotline", "phone"]);
  const zaloUrl = pickSetting(settings, ["zalo_url"]);
  const zaloDisplay = pickSetting(settings, ["zalo_display"]);
  // Khối cam kết dưới nút mua hàng (V232) + dải tin cậy trên tên sản phẩm (V233) giờ quản theo
  // TỪNG sản phẩm (product.commitments / product.trustBadges) — WpPurchaseSection tự đọc thẳng từ
  // product, không còn lấy từ settings.
  const gallery = safeArray(product.gallery);
  const descriptionBlocks = safeArray(product.descriptionBlocks) as DescriptionBlock[];
  // Canonical layout (PDP_CONTENT_GUIDE §0b): "Phù hợp với ai" (#6) và "Bảng size" (#7) là SECTION RIÊNG,
  // thứ tự CỐ ĐỊNH ngay sau Ưu/Nhược điểm + Sản phẩm liên quan — KHÔNG để admin chèn lẫn giữa mô tả. Tách
  // 2 loại khối này RA khỏi luồng mô tả; phần còn lại (chữ/feature/ảnh/video) là "Mô tả / Tính năng" (#3).
  const suitabilityBlocks = descriptionBlocks.filter((b) => b.type === "suitability");
  const sizeGuideBlocks = descriptionBlocks.filter((b) => b.type === "sizeGuide");
  const descBlocks = descriptionBlocks.filter(
    (b) => b.type !== "suitability" && b.type !== "sizeGuide",
  );
  const specs = safeArray(product.specifications);
  // "Dán mã HTML" cho Thông số kỹ thuật (V255): khi có, web hiện HTML thay bảng dòng ("html thắng").
  const specsHtml = product.specificationsHtml?.trim() ? product.specificationsHtml : "";
  const specStats = safeArray(product.specStats);
  // "Dán mã HTML" cho Ô số liệu nổi bật (V256): khi có, web render HTML thay lưới ("html thắng").
  const specStatsHtml = product.specStatsHtml?.trim() ? product.specStatsHtml : "";
  const faqs = safeArray(product.faqs);
  const videos = safeArray(product.videos);
  const related = safeArray(product.relatedProducts).filter((p) => p.id !== product.id);
  const accessories = safeArray(product.accessoryProducts).filter((p) => p.id !== product.id);
  const rating = product.rating ?? null;
  const ratingCount = product.ratingCount ?? null;

  const descriptionHtml = product.description ? sanitizeRichHtml(product.description) : "";
  const contentBottomHtml = product.contentBottom ? sanitizeRichHtml(product.contentBottom) : "";

  // "Mô tả / Tính năng" (#3) chỉ gồm phần mô tả thuần (đã tách Phù hợp với ai · Bảng size ra khối riêng).
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
  const showSpecs = specs.length > 0 || Boolean(specsHtml);
  const showFaqs = faqs.length > 0;
  const showVideos = videos.length > 0;
  const showReviews = !previewMode;
  const showProsCons = positiveNotes.length > 0 || negativeNotes.length > 0;
  const showRelated = related.length > 0;
  const showAccessories = accessories.length > 0;
  const showSuitability = suitabilityBlocks.length > 0;
  const showSizeGuide = sizeGuideBlocks.length > 0;

  // Trust block "Mua tại BigBike.vn" (#11) — lưới ô số liệu thương mại (xem product-view/ProductTrustCard).
  // Tự ẩn khi rỗng; tiêu đề mục đặt NGOÀI thẻ qua <PdpSectionHeading> (xem bodyNodes.trust).
  const trustItems = buildTrustItems({ product, previewMode, hotline, zaloDisplay, contactAddress });
  const trustCard = trustItems.length > 0 ? <ProductTrustCard items={trustItems} /> : null;

  // Thanh nhảy-mục MOBILE (anchor nav tổng) — đặt ở đầu phần nội dung, phủ TOÀN BỘ section theo đúng thứ
  // tự trang (PDP_CONTENT_GUIDE §0b). Mỗi mục cuộn tới id tương ứng: khối flat dùng id "pdp-*"; cụm Thông
  // số dùng id panel trong widget tab (tab-more_infomation/tab-faq/tab-videos/reviews) — có sẵn trong DOM
  // trên mobile. Tự bỏ mục khi section rỗng. Widget tab KHÔNG render thanh nav riêng nữa (hideAnchorNav).
  const anchorItems: AnchorNavItem[] = [];
  if (hasDescription) anchorItems.push({ id: "pdp-description", label: tTab("description") });
  if (showProsCons || showRelated) anchorItems.push({ id: "pdp-proscons", label: tTabShort("prosCons") });
  if (showSuitability) anchorItems.push({ id: "pdp-suitability", label: tTabShort("suitability") });
  if (showSizeGuide) anchorItems.push({ id: "pdp-sizeguide", label: tTab("size") });
  if (showSpecs) anchorItems.push({ id: "tab-more_infomation", label: tTab("specs") });
  if (showFaqs) anchorItems.push({ id: "tab-faq", label: tTab("faqs") });
  if (showVideos) anchorItems.push({ id: "tab-videos", label: tTab("videos") });
  if (showReviews) anchorItems.push({ id: "reviews", label: tTab("reviews") });
  if (trustCard) anchorItems.push({ id: "pdp-trust", label: tTab("trust") });
  if (showAccessories) anchorItems.push({ id: "pdp-accessories", label: tTab("accessories") });

  // MOBILE: gói cụm "Thông số" (Thông số kỹ thuật/FAQ/Video/Đánh giá) vào MỘT widget tab, đặt đúng vị trí
  // trong mạch trang (sau Bảng size). "Tính năng chi tiết" (Mô tả) nay là khối flat RIÊNG ở đầu trang —
  // KHÔNG vào widget. Tự ẩn từng tab khi rỗng; reviews bỏ qua trong preview.
  const specGroupBuiltins: Record<string, BuiltinTab> = {};
  if (showSpecs) {
    // Khóa map PHẢI khớp khóa thứ tự ("specifications"/"faqs" trong BODY_SECTION_DEFAULT_ORDER) —
    // ProductTabsSection tra builtins[type] theo khóa thứ tự; lệch tên → tab + mục anchor nav bị bỏ.
    specGroupBuiltins.specifications = { id: "tab-more_infomation", labelKey: "specs", content: <ProductSpecsTable viSpecs={specs} viSpecsHtml={specsHtml} /> };
  }
  if (showFaqs) {
    specGroupBuiltins.faqs = { id: "tab-faq", labelKey: "faqs", content: <ProductFaqs viFaqs={faqs} /> };
  }
  if (showVideos) {
    specGroupBuiltins.videos = {
      id: "tab-videos",
      labelKey: "videos",
      content: <ProductVideosSection videos={videos} />,
    };
  }
  // Đánh giá là tab cuối (bỏ qua trong preview vì chưa có id sản phẩm). Panel mang id="reviews"
  // để nút "Viết đánh giá đầu tiên" cuộn/nhảy tới đúng (xem scrollToReviews ở WpPurchaseSection).
  if (showReviews) {
    specGroupBuiltins.reviews = { id: "reviews", labelKey: "reviews", content: <ReviewsSection productId={product.id} embedded /> };
  }
  // Thứ tự CỐ ĐỊNH các section body theo canonical layout (PDP_CONTENT_GUIDE §0b — sơ đồ "thứ tự đầy đủ
  // trang sản phẩm" của chủ shop): Tính năng chi tiết (Mô tả) → Ưu/Nhược + Sản phẩm tương tự → Phù hợp với
  // ai → [cụm Thông số:] Bảng size → Thông số kỹ thuật → FAQ → Video → Đánh giá → Trust → Phụ kiện.
  // MOBILE: 4 khối Thông số kỹ thuật/FAQ/Video/Đánh giá gom vào MỘT widget tab (TAB_KEYS) đặt tại chốt
  // "specGroupMobile" (ngay sau Bảng size); các khối còn lại (Mô tả, Ưu/Nhược, Phù hợp với ai, Bảng size,
  // Trust, Phụ kiện) xếp chồng flat. DESKTOP: 4 khối đó render giãn (không tab) tại đúng vị trí → thứ tự
  // DESKTOP KHỚP MOBILE. "Sản phẩm đã xem gần đây" render riêng.
  const bodyOrder = [
    "description", "prosConsRelated", "suitability", "sizeGuide",
    "specGroupMobile", "specifications", "faqs", "videos", "reviews",
    "trust", "accessories",
  ];

  // Cụm "Thông số" gom được vào widget tab mobile (KHÔNG gồm Mô tả/Ưu-Nhược/Phù hợp/Bảng size/Trust/Phụ
  // kiện — các khối này xếp chồng flat ở cả 2 màn).
  const TAB_KEYS = new Set(["specifications", "faqs", "videos", "reviews"]);
  const specGroupOrder = bodyOrder.filter((k) => TAB_KEYS.has(k));
  const hasSpecGroup = Object.keys(specGroupBuiltins).length > 0;

  // Các section body desktop — render theo thứ tự admin đã cấu hình.
  const bodyNodes: Record<string, ReactNode> = {};

  // "Tính năng chi tiết" (#3) — khối flat hiển thị CẢ desktop lẫn mobile (đã tách khỏi widget tab).
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
              <ProductSwiper products={related} autoHeight />
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  // "Phù hợp với ai" (#6) — SECTION riêng ngay sau cụm Ưu/Nhược + Sản phẩm liên quan. Hiện cả desktop lẫn
  // mobile (NGOÀI widget tab, như prosConsRelated). Tiêu đề lấy từ chính khối (admin nhập).
  if (showSuitability) {
    bodyNodes.suitability = (
      <div key="suitability" id="pdp-suitability" className={`scroll-mt-[var(--bb-header-height)] ${PDP_SECTION_SEP}`}>
        <section>
          <ProductSuitabilitySection blocks={suitabilityBlocks} />
        </section>
      </div>
    );
  }

  // "Bảng size" (#7) — SECTION riêng ngay sau "Phù hợp với ai".
  if (showSizeGuide) {
    bodyNodes.sizeGuide = (
      <div key="sizeGuide" id="pdp-sizeguide" className={`scroll-mt-[var(--bb-header-height)] ${PDP_SECTION_SEP}`}>
        <section>
          <ProductSizeGuideSection blocks={sizeGuideBlocks} />
        </section>
      </div>
    );
  }

  // MOBILE — widget tab cụm "Thông số" (Thông số kỹ thuật/FAQ/Video/Đánh giá), đặt đúng vị trí trong mạch
  // trang (sau Bảng size, trước Trust). Chỉ hiện ở max-md; desktop dùng 4 khối flat bên dưới.
  if (hasSpecGroup) {
    bodyNodes.specGroupMobile = (
      <div key="specGroupMobile" className="my-10 md:hidden">
        <ProductTabsSection tabs={[]} builtins={specGroupBuiltins} defaultOrder={specGroupOrder} hideAnchorNav />
      </div>
    );
  }

  // Các khối desktop-only dưới đây bọc trong <div max-md:hidden> THAY VÌ đặt max-md:hidden thẳng lên
  // <section>: CSS reset WP (unlayered) ép `section{display:block}`, thắng utility Tailwind (layered)
  // nên max-md:hidden trên <section> KHÔNG ẩn được → bản desktop lọt xuống mobile, trùng với bản trong
  // tab. Bọc bằng <div> (không bị reset) thì ẩn đúng. Xem memory wp_css_overrides_tailwind_layer.
  if (showSpecs) {
    bodyNodes.specifications = (
      <div key="specifications" className={`max-md:hidden ${PDP_SECTION_SEP}`}>
        <section>
          <PdpSectionHeading title={<Tr ns="Product" k="specifications" />} />
          <ProductSpecsTable viSpecs={specs} viSpecsHtml={specsHtml} />
        </section>
      </div>
    );
  }

  if (showFaqs) {
    bodyNodes.faqs = (
      <div key="faqs" className={`max-md:hidden ${PDP_SECTION_SEP}`}>
        <section>
          <PdpSectionHeading title={<Tr ns="Product" k="faqs" />} />
          <ProductFaqs viFaqs={faqs} />
        </section>
      </div>
    );
  }

  if (showVideos) {
    bodyNodes.videos = (
      <div key="videos" className={`max-md:hidden ${PDP_SECTION_SEP}`}>
        <section>
          <PdpSectionHeading title={<Tr ns="Product" k="videos" />} />
          <ProductVideosSection videos={videos} />
        </section>
      </div>
    );
  }

  if (showReviews) {
    bodyNodes.reviews = (
      <div key="reviews" className="max-md:hidden">
        <ReviewsSection productId={product.id} />
      </div>
    );
  }

  if (trustCard) {
    bodyNodes.trust = (
      <div key="trust" id="pdp-trust" className={`scroll-mt-[var(--bb-header-height)] ${PDP_SECTION_SEP}`}>
        <section>
          <PdpSectionHeading title={<Tr ns="Product" k="trustBlockTitle" />} />
          {trustCard}
        </section>
      </div>
    );
  }

  if (showAccessories) {
    // Cùng nhịp section như "Sản phẩm tương tự" — tiêu đề căn trái + vạch hairline, đồng đều toàn trang.
    bodyNodes.accessories = (
      <div key="accessories" id="pdp-accessories" className={`scroll-mt-[var(--bb-header-height)] ${PDP_SECTION_SEP}`}>
        <section>
          <PdpSectionHeading title={<Tr ns="Product" k="crossSellTitle" />} />
          <ProductSwiper products={accessories} autoHeight />
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
        <div className="breadcrumb">
          <ul>
            <li>
              <Link href="/" className="home">
                <span property="name">Bigbike.vn</span>
              </Link>
            </li>
            {brand ? (
              <li>
                <LocalizedLink kind="brand" viSlug={brand.slug} enSlug={brand.slugEn} className="taxonomy">
                  <span property="name">{brand.name}</span>
                </LocalizedLink>
              </li>
            ) : category ? (
              <li>
                <LocalizedLink kind="category" viSlug={category.slug} enSlug={category.slugEn} className="taxonomy">
                  <span property="name">{category.name}</span>
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
        <FeaturedSpecsBar stats={specStats} viStatsHtml={specStatsHtml} />

        {/* Thanh nhảy-mục MOBILE (anchor nav tổng) — nổi vào sau khi khu mua hàng (#pdp-overview) cuộn khỏi
            tầm nhìn, phủ TOÀN BỘ section theo đúng thứ tự trang. Tự ẩn trên desktop (component có md:!hidden).
            Chỉ hiện khi có từ 2 mục trở lên. */}
        {anchorItems.length > 1 && (
          <MobilePdpAnchorNav items={anchorItems} triggerSelector="#pdp-overview" />
        )}

        {/* Body sections — render theo thứ tự canonical (PDP_CONTENT_GUIDE §0b). Mỗi node tự mang
            responsive class: khối flat hiện cả 2 màn; cụm Thông số → desktop là 4 khối flat (max-md:hidden),
            mobile là widget tab (md:hidden) tại chốt "specGroupMobile". */}
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
          hotline={hotline || undefined}
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
