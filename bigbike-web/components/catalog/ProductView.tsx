"use client";

import type { CSSProperties, ReactNode } from "react";
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
import { ProductDescriptionBlocks } from "@/components/catalog/ProductDescriptionBlocks";
import { ProductTabsSection, type BuiltinTab } from "@/components/catalog/ProductTabsSection";
import { FeaturedSpecsBar } from "@/components/catalog/FeaturedSpecsBar";
import { TrustLivePrice, TrustLiveStock } from "@/components/catalog/ProductTrustLive";
import { ProductSwiper } from "@/components/catalog/ProductSwiper";
import { ReadingProgressBar } from "@/components/catalog/ReadingProgressBar";
import { ReviewsSection } from "@/components/catalog/ReviewsSection";
import { WriteReviewDialog } from "@/components/catalog/WriteReviewDialog";
import { RecentlyViewedSection } from "@/components/catalog/RecentlyViewedSection";
import { ProductContactCta } from "@/components/catalog/ProductContactCta";
import type { RecentProduct } from "@/lib/recently-viewed";
import type { DescriptionBlock, Product, PublicSiteSetting } from "@/lib/contracts/public";
import { safeArray, safeText } from "@/lib/utils/format";
import { pickSetting } from "@/lib/utils/settings";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { parseSectionVisibility, isSectionVisible } from "@/lib/utils/section-visibility";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";

type ProductViewProps = {
  product: Product;
  /** Site settings for the bottom contact band (NAP). Empty in preview. */
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

/**
 * Tiêu đề khối nội dung PDP (desktop) — H2 in hoa, đậm, lớn. Thống nhất nhịp tiêu
 * đề mọi section (theo mockup PDP), dùng token/Arial — KHÔNG hardcode màu/font.
 * `id` để mobile-anchor/scroll trỏ tới.
 */
function PdpSectionHeading({
  title,
  id,
}: {
  title: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="pdp-section-head scroll-mt-[var(--bb-header-height)]">
      <h2 className="title">{title}</h2>
    </div>
  );
}

/**
 * Ngăn cách giữa các khối nội dung PDP (desktop + khối hiện trên mobile): vạch hairline mảnh ở ĐẦU
 * mỗi mục + nhịp dọc đều, đồng bộ với khối Đánh giá. Dùng token `border-border` (KHÔNG hardcode màu)
 * và thang spacing 4px của Tailwind. DÙNG CHUNG cho MỌI section — kể cả 2 carousel (Sản phẩm tương tự /
 * Phụ kiện bán kèm) — để toàn trang có một nhịp dọc đồng đều, tiêu đề căn trái thống nhất.
 */
const PDP_SECTION_SEP = "mt-12 border-t border-border pt-12 max-md:mt-10 max-md:pt-10";

export function ProductView({ product, settings, previewMode = false }: ProductViewProps) {
  const name = safeText(product.name, "Sản phẩm");

  // "Hiển thị trên web" (V245) — admin bật/tắt từng section. `vis(key)` = không bị tắt (map[key] !== false);
  // section vẫn cần CÓ nội dung mới hiện. Sản phẩm cũ (map rỗng) → vis luôn true → giữ hành vi legacy.
  const sectionVis = parseSectionVisibility(product.sectionVisibility);
  const vis = (key: string) => isSectionVisible(sectionVis, key);

  // Business NAP — same key set as footer / contact page so the bottom contact
  // band shows site-wide values (consistent local-SEO). Empty array in preview.
  const siteName = pickSetting(settings, ["site_name"]) || "BigBike";
  const contactAddress = pickSetting(settings, ["contact_address", "address"]);
  const hotline = pickSetting(settings, ["hotline", "phone"]);
  const zaloUrl = pickSetting(settings, ["zalo_url"]);
  // Khối cam kết dưới nút mua hàng (V232) + dải tin cậy trên tên sản phẩm (V233) giờ quản theo
  // TỪNG sản phẩm (product.commitments / product.trustBadges) — WpPurchaseSection tự đọc thẳng từ
  // product, không còn lấy từ settings.
  const gallery = safeArray(product.gallery);
  const descriptionBlocks = safeArray(product.descriptionBlocks) as DescriptionBlock[];
  const specs = safeArray(product.specifications);
  const specStats = safeArray(product.specStats);
  const faqs = safeArray(product.faqs);
  const videos = safeArray(product.videos);
  const related = safeArray(product.relatedProducts).filter((p) => p.id !== product.id);
  const accessories = safeArray(product.accessoryProducts).filter((p) => p.id !== product.id);
  const rating = product.rating ?? null;
  const ratingCount = product.ratingCount ?? null;

  const descriptionHtml = product.description ? sanitizeRichHtml(product.description) : "";
  const contentBottomHtml = product.contentBottom ? sanitizeRichHtml(product.contentBottom) : "";

  // Phù hợp với ai · Bảng size (V246): KHỐI nằm trong mô tả (descriptionBlocks), admin tự đặt vị trí;
  // web render qua ProductDescriptionBlocks.
  const hasDescription = (descriptionBlocks.length > 0 || Boolean(descriptionHtml)) && vis("description");

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
  const showSpecs = specs.length > 0 && vis("specifications");
  const showFaqs = faqs.length > 0 && vis("faqs");
  const showVideos = videos.length > 0 && vis("videos");
  const showReviews = !previewMode && vis("reviews");
  // Khối NGOÀI tab — KHÔNG gate theo "Hiển thị trên web": tự hiện khi có nội dung.
  const showProsCons = positiveNotes.length > 0 || negativeNotes.length > 0;
  const showRelated = related.length > 0;
  const showAccessories = accessories.length > 0;

  // Trust block "Mua tại BigBike.vn" (#11) — lưới ô số liệu thương mại. Giá/Kho lấy THỜI GIAN THỰC
  // (TrustLivePrice/TrustLiveStock — cùng nguồn với nút mua, có tính giảm giá + tắt-bán thủ công, để
  // KHÔNG mâu thuẫn) ở ĐẦU; giữa là các dòng admin tự thêm theo từng sản phẩm (purchaseLines — nhãn
  // text admin nhập, không qua i18n; backend đã resolve theo ngôn ngữ); Hotline/Địa chỉ từ site
  // settings ở CUỐI (rỗng trong preview). Mỗi item có `labelKey` (nhãn i18n) HOẶC `label` (nhãn raw).
  const retailPrice = product.price?.retailPrice ?? null;
  const trustItems: Array<{ key: string; labelKey?: string; label?: string; value: ReactNode }> = [];
  if (retailPrice != null) {
    trustItems.push({ key: "price", labelKey: "trustPrice", value: <TrustLivePrice product={product} previewMode={previewMode} /> });
  }
  if (product.stockState) {
    trustItems.push({ key: "stock", labelKey: "trustStock", value: <TrustLiveStock product={product} previewMode={previewMode} /> });
  }
  // Dòng admin tự thêm (không giới hạn). Nhãn + giá trị là text admin nhập → render THẲNG, không i18n.
  safeArray(product.purchaseLines).forEach((line, index) => {
    const label = safeText(line?.label, "");
    const value = safeText(line?.value, "");
    if (!label && !value) return;
    trustItems.push({ key: `pl-${index}`, label, value });
  });
  if (hotline) {
    trustItems.push({ key: "hotline", labelKey: "trustHotline", value: hotline });
  }
  if (contactAddress) {
    trustItems.push({ key: "address", labelKey: "trustAddress", value: contactAddress });
  }
  // Số cột lưới ô trust tự khít theo SỐ ô: chia thành các hàng tối đa 4 ô, cân đều — tránh hàng cuối lẻ
  // 1 ô để hở 2 ô trống (VD 4 ô → 1 hàng 4; 7 ô → 4+3; 5 ô → 3+2; 6 ô → 3+3). Cột desktop truyền qua
  // biến CSS --bb-trust-cols. Mobile luôn 2 cột; nếu tổng ô lẻ thì ô cuối kéo rộng cả hàng cho gọn.
  const trustCols = (() => {
    const n = trustItems.length;
    if (n <= 1) return 1;
    const rows = Math.ceil(n / 4);
    return Math.ceil(n / rows);
  })();
  // Thẻ trust "cam kết" (chỉ lưới ô số liệu, KHÔNG tiêu đề bên trong). Tiêu đề mục đặt NGOÀI thẻ qua
  // <PdpSectionHeading> — DÙNG CHUNG desktop + mobile: khối này là section xếp chồng độc lập ở cả hai,
  // KHÔNG còn nằm trong widget tab mobile. Tự ẩn khi rỗng.
  const trustCard = trustItems.length > 0 ? (
    <div className="bg-secondary p-6 text-foreground">
      <dl
        className={`grid grid-cols-2 gap-3 sm:[grid-template-columns:repeat(var(--bb-trust-cols),minmax(0,1fr))] ${
          trustItems.length % 2 === 1 ? "max-sm:[&>:last-child]:col-span-2" : ""
        }`}
        style={{ "--bb-trust-cols": trustCols } as CSSProperties}
      >
        {trustItems.map((item) => (
          <div key={item.key} className="border border-border bg-background p-3">
            <dd className="m-0 font-barlow text-18 font-semibold">{item.value}</dd>
            <dt className="mt-1 text-overline uppercase tracking-wide text-muted-foreground">
              {item.labelKey ? <Tr ns="Product" k={item.labelKey} /> : item.label}
            </dt>
          </div>
        ))}
      </dl>
    </div>
  ) : null;

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
          blocks={descriptionBlocks}
          fallback={<ProductDescriptionTab viHtml={descriptionHtml} />}
        />
      ),
    };
  }
  if (showSpecs) {
    // Khóa map PHẢI khớp khóa thứ tự ("specifications"/"faqs" trong BODY_SECTION_DEFAULT_ORDER) —
    // ProductTabsSection tra builtins[type] theo khóa thứ tự; lệch tên → tab + mục anchor nav bị bỏ.
    specGroupBuiltins.specifications = { id: "tab-more_infomation", labelKey: "specs", content: <ProductSpecsTable viSpecs={specs} /> };
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
  // Thứ tự CỐ ĐỊNH các section body. Không cho đổi thứ tự — mọi khối luôn ở vị trí cố định.
  // "prosConsRelated" (Ưu/Nhược điểm + Sản phẩm tương tự) là MỘT section chung ngay dưới mô tả, ngoài
  // tab — 2 phần liên quan nhau: khách vừa đọc nhược điểm/giá, có thể phân vân → đưa "xem thêm lựa chọn"
  // ngay trong cùng khối để giữ họ ở lại site. "accessories" (Phụ kiện bán kèm) ở cuối. "Sản phẩm đã xem
  // gần đây" render riêng ngoài bodyOrder, ngay dưới.
  const bodyOrder = [
    "description", "prosConsRelated", "specifications", "faqs", "videos", "reviews", "trust", "accessories",
  ];

  // Mobile tab widget chỉ gồm các tab có thể nhét vào widget (không phải prosConsRelated/accessories/trust).
  const TAB_KEYS = new Set(["description", "specifications", "faqs", "videos", "reviews"]);
  const specGroupOrder = bodyOrder.filter((k) => TAB_KEYS.has(k));
  const hasSpecGroup = Object.keys(specGroupBuiltins).length > 0;

  // Các section body desktop — render theo thứ tự admin đã cấu hình.
  const bodyNodes: Record<string, ReactNode> = {};

  if (hasDescription) {
    bodyNodes.description = (
      <div key="description" className={`max-md:hidden ${PDP_SECTION_SEP}`}>
        <ProductDescriptionBlocks
          blocks={descriptionBlocks}
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
                <p className="!mb-0 flex items-start gap-2 text-18 font-medium text-foreground">
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

  // Các khối desktop-only dưới đây bọc trong <div max-md:hidden> THAY VÌ đặt max-md:hidden thẳng lên
  // <section>: CSS reset WP (unlayered) ép `section{display:block}`, thắng utility Tailwind (layered)
  // nên max-md:hidden trên <section> KHÔNG ẩn được → bản desktop lọt xuống mobile, trùng với bản trong
  // tab. Bọc bằng <div> (không bị reset) thì ẩn đúng. Xem memory wp_css_overrides_tailwind_layer.
  if (showSpecs) {
    bodyNodes.specifications = (
      <div key="specifications" className={`max-md:hidden ${PDP_SECTION_SEP}`}>
        <section>
          <PdpSectionHeading title={<Tr ns="Product" k="specifications" />} />
          <ProductSpecsTable viSpecs={specs} />
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
        <FeaturedSpecsBar stats={specStats} />

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
