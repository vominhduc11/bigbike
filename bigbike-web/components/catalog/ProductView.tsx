"use client";

import type { ReactNode } from "react";
import Link from "next/link";

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
import { PdpSectionHeading, PDP_SECTION_SEP } from "@/components/catalog/product-view/PdpSection";
import { buildTrustItems, ProductTrustCard } from "@/components/catalog/product-view/ProductTrustCard";
import type { RecentProduct } from "@/lib/recently-viewed";
import type { DescriptionBlock, Product, PublicSiteSetting } from "@/lib/contracts/public";
import { safeArray, safeText } from "@/lib/utils/format";
import { pickSetting } from "@/lib/utils/settings";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { parseSectionVisibility, isSectionVisible } from "@/lib/utils/section-visibility";
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

  // "Hiển thị trên web" (V245) — admin bật/tắt từng section. `vis(key)` = không bị tắt (map[key] !== false);
  // section vẫn cần CÓ nội dung mới hiện. Sản phẩm cũ (map rỗng) → vis luôn true → giữ hành vi legacy.
  const sectionVis = parseSectionVisibility(product.sectionVisibility);
  const vis = (key: string) => isSectionVisible(sectionVis, key);

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
  const hasDescription = (descBlocks.length > 0 || Boolean(descriptionHtml)) && vis("description");

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

  // Gate có-nội-dung + đã-bật cho các section TRONG TAB (dùng chung desktop + widget tab mobile).
  const showSpecs = (specs.length > 0 || Boolean(specsHtml)) && vis("specifications");
  const showFaqs = faqs.length > 0 && vis("faqs");
  const showVideos = videos.length > 0 && vis("videos");
  const showReviews = !previewMode && vis("reviews");
  // Khối NGOÀI tab — KHÔNG gate theo "Hiển thị trên web": tự hiện khi có nội dung.
  const showProsCons = positiveNotes.length > 0 || negativeNotes.length > 0;
  const showRelated = related.length > 0;
  const showAccessories = accessories.length > 0;
  // "Phù hợp với ai" · "Bảng size" theo visibility của 'description' (admin không có toggle riêng cho 2
  // khối này — SECTION_VISIBILITY_KEYS chỉ có 'description'); tự ẩn khi không có khối tương ứng.
  const showSuitability = suitabilityBlocks.length > 0 && vis("description");
  const showSizeGuide = sizeGuideBlocks.length > 0 && vis("description");

  // Trust block "Mua tại BigBike.vn" (#11) — lưới ô số liệu thương mại (xem product-view/ProductTrustCard).
  // Tự ẩn khi rỗng; tiêu đề mục đặt NGOÀI thẻ qua <PdpSectionHeading> (xem bodyNodes.trust).
  const trustItems = buildTrustItems({ product, previewMode, hotline, zaloDisplay, contactAddress });
  const trustCard = trustItems.length > 0 ? <ProductTrustCard items={trustItems} /> : null;

  // MOBILE: gói nội dung Mô tả/Thông số/FAQ/Video/Đánh giá vào MỘT widget tab. Thứ tự tab = đúng mạch
  // desktop. Tự ẩn từng tab khi rỗng; reviews bỏ qua trong preview. Khối "cam kết" (trust) KHÔNG vào
  // widget — render độc lập như desktop (xem bodyNodes.trust).
  const specGroupBuiltins: Record<string, BuiltinTab> = {};
  if (hasDescription) {
    specGroupBuiltins.description = {
      id: "tab-description",
      labelKey: "description",
      content: (
        <ProductDescriptionBlocks
          blocks={descBlocks}
          fallback={<ProductDescriptionTab viHtml={descriptionHtml} />}
        />
      ),
    };
  }
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
  // Thứ tự CỐ ĐỊNH các section body theo canonical layout (PDP_CONTENT_GUIDE §0b): Mô tả → Thông số → FAQ
  // → Video → Đánh giá → Ưu/Nhược + Sản phẩm liên quan → Phù hợp với ai → Bảng size → Trust → Phụ kiện.
  // 5 khối Mô tả→Thông số→FAQ→Video→Đánh giá là cụm "vào được" widget tab (TAB_KEYS); cụm "prosConsRelated
  // → suitability → sizeGuide" là các khối NGOÀI tab. MOBILE: widget tab gom 5 khối rồi cụm ngoài-tab xếp
  // chồng ngay dưới. DESKTOP: 5 khối render giãn (không tab) rồi tới cụm ngoài-tab — nên thứ tự DESKTOP
  // KHỚP MOBILE. Đổi mảng này KHÔNG ảnh hưởng mobile (mobile lấy thứ tự qua TAB_KEYS + xếp chồng riêng).
  // "Sản phẩm đã xem gần đây" render riêng.
  const bodyOrder = [
    "description", "specifications", "faqs", "videos", "reviews",
    "prosConsRelated", "suitability", "sizeGuide", "trust", "accessories",
  ];

  // Mobile tab widget chỉ gồm tab nhét được vào widget (KHÔNG gồm prosConsRelated/suitability/sizeGuide/
  // accessories/trust — các khối này hiện xếp chồng dưới widget).
  const TAB_KEYS = new Set(["description", "specifications", "faqs", "videos", "reviews"]);
  const specGroupOrder = bodyOrder.filter((k) => TAB_KEYS.has(k));
  const hasSpecGroup = Object.keys(specGroupBuiltins).length > 0;

  // Các section body desktop — render theo thứ tự admin đã cấu hình.
  const bodyNodes: Record<string, ReactNode> = {};

  if (hasDescription) {
    bodyNodes.description = (
      <div key="description" className={`max-md:hidden ${PDP_SECTION_SEP}`}>
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
      <div key="prosConsRelated" className={PDP_SECTION_SEP}>
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
      <div key="suitability" className={PDP_SECTION_SEP}>
        <section>
          <ProductSuitabilitySection blocks={suitabilityBlocks} />
        </section>
      </div>
    );
  }

  // "Bảng size" (#7) — SECTION riêng ngay sau "Phù hợp với ai".
  if (showSizeGuide) {
    bodyNodes.sizeGuide = (
      <div key="sizeGuide" className={PDP_SECTION_SEP}>
        <section>
          <ProductSizeGuideSection blocks={sizeGuideBlocks} />
        </section>
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
      <div key="trust" className={PDP_SECTION_SEP}>
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
      <div key="accessories" className={PDP_SECTION_SEP}>
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

        {/* MOBILE — widget tab (đủ bộ các section có thể nhét vào tab, theo thứ tự admin cấu hình).
            Chỉ hiện ở max-md; desktop dùng khối xếp chồng bên dưới. */}
        {hasSpecGroup && (
          <div className="my-10 md:hidden">
            <ProductTabsSection tabs={[]} builtins={specGroupBuiltins} defaultOrder={specGroupOrder} />
          </div>
        )}

        {/* Body sections (desktop) — render theo thứ tự admin kéo-thả trong "Hiển thị trên web".
            Mỗi node tự mang responsive class (max-md:hidden / md:hidden). */}
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
