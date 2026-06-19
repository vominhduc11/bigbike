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
import { parseSectionVisibility, isSectionVisible, parseSectionOrder } from "@/lib/utils/section-visibility";
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
 * Tiêu đề khối nội dung PDP (desktop) — eyebrow đỏ nhỏ + H2 in hoa, đậm, lớn.
 * Thống nhất nhịp tiêu đề mọi section (theo mockup PDP), dùng token/Arial — KHÔNG
 * hardcode màu/font. `kicker` tùy chọn; `id` để mobile-anchor/scroll trỏ tới.
 */
function PdpSectionHeading({
  kicker,
  title,
  id,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="pdp-section-head scroll-mt-[var(--bb-header-height)]">
      {kicker ? <p className="kicker">{kicker}</p> : null}
      <h2 className="title">{title}</h2>
    </div>
  );
}

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

  // Quick Answer (V236) — đoạn AIO 40–60 từ, blockquote đặt TRƯỚC H2 đầu tiên.
  const quickAnswer = safeText(product.quickAnswerSummary, "");
  // Ưu/Nhược điểm · Phù hợp với ai · Bảng size (V246): giờ là KHỐI nằm trong mô tả (descriptionBlocks),
  // admin tự đặt vị trí; web render qua ProductDescriptionBlocks. Không còn section/tab cố định ở đây.
  const hasDescription = (descriptionBlocks.length > 0 || Boolean(descriptionHtml)) && vis("description");

  const warrantyMonths = product.warrantyMonths ?? null;
  const warrantyScope = safeText(product.warrantyScope, "");
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

  // Gate có-nội-dung + đã-bật cho các section còn lại (dùng chung desktop + widget tab mobile).
  const showSpecs = specs.length > 0 && vis("specifications");
  const showFaqs = faqs.length > 0 && vis("faqs");
  const showVideos = videos.length > 0 && vis("videos");
  const showRelated = related.length > 0 && vis("related");
  const showAccessories = accessories.length > 0 && vis("accessories");
  const showReviews = !previewMode && vis("reviews");

  // Trust block "Mua tại BigBike.vn" (#11) — lưới ô số liệu thương mại. Giá/Kho lấy THỜI GIAN THỰC
  // (TrustLivePrice/TrustLiveStock — cùng nguồn với nút mua, có tính giảm giá + tắt-bán thủ công, để
  // KHÔNG mâu thuẫn); BH lấy từ sản phẩm; Giao/Đổi là chính sách shop (nhãn tĩnh i18n); Hotline/Địa
  // chỉ từ site settings (rỗng trong preview).
  const retailPrice = product.price?.retailPrice ?? null;
  const trustItems: Array<{ key: string; labelKey: string; value: ReactNode }> = [];
  if (retailPrice != null) {
    trustItems.push({ key: "price", labelKey: "trustPrice", value: <TrustLivePrice product={product} previewMode={previewMode} /> });
  }
  if (product.stockState) {
    trustItems.push({ key: "stock", labelKey: "trustStock", value: <TrustLiveStock product={product} previewMode={previewMode} /> });
  }
  if (warrantyMonths != null) {
    trustItems.push({
      key: "warranty",
      labelKey: "warranty",
      value: (
        <>
          {warrantyMonths} <Tr ns="Product" k="monthsUnit" />
        </>
      ),
    });
  } else if (warrantyScope) {
    trustItems.push({ key: "warranty", labelKey: "warranty", value: warrantyScope });
  }
  // Giao hàng / Đổi trả: admin nhập theo TỪNG sản phẩm (V247); để trống → câu mặc định chung (i18n).
  const pdpShippingLine = safeText(product.pdpShippingLine, "");
  const pdpReturnLine = safeText(product.pdpReturnLine, "");
  trustItems.push({
    key: "shipping",
    labelKey: "trustShipping",
    value: pdpShippingLine ? pdpShippingLine : <Tr ns="Product" k="trustShippingValue" />,
  });
  trustItems.push({
    key: "exchange",
    labelKey: "trustExchange",
    value: pdpReturnLine ? pdpReturnLine : <Tr ns="Product" k="trustExchangeValue" />,
  });
  if (hotline) {
    trustItems.push({ key: "hotline", labelKey: "trustHotline", value: hotline });
  }
  if (contactAddress) {
    trustItems.push({ key: "address", labelKey: "trustAddress", value: contactAddress });
  }
  // Thẻ trust (chỉ lưới ô số liệu, KHÔNG tiêu đề bên trong). Tiêu đề mục được đặt NGOÀI thẻ:
  //   • DESKTOP → qua <PdpSectionHeading> (eyebrow + 35px) như mọi mục khác (đồng bộ cỡ chữ).
  //   • MOBILE → widget tab tự render nhãn "Mua tại BigBike" làm tiêu đề, nên thẻ không lặp lại.
  // Tự ẩn khi rỗng.
  const trustCard = trustItems.length > 0 && vis("trust") ? (
    <div className="bg-secondary p-6 text-foreground">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {trustItems.map((item) => (
          <div key={item.key} className="border border-border bg-background p-3">
            <dd className="m-0 font-barlow text-18 font-semibold">{item.value}</dd>
            <dt className="mt-1 text-overline uppercase tracking-wide text-muted-foreground">
              <Tr ns="Product" k={item.labelKey} />
            </dt>
          </div>
        ))}
      </dl>
    </div>
  ) : null;

  // MOBILE: gói TẤT CẢ nội dung giữa Quick Answer và Trust block vào MỘT widget tab (đủ bộ như user
  // chốt). Thứ tự tab = đúng mạch desktop. Tự ẩn từng tab khi rỗng; reviews bỏ qua trong preview.
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
    specGroupBuiltins.specs = { id: "tab-more_infomation", labelKey: "specs", content: <ProductSpecsTable viSpecs={specs} /> };
  }
  if (showFaqs) {
    specGroupBuiltins.faq = { id: "tab-faq", labelKey: "faqs", content: <ProductFaqs viFaqs={faqs} /> };
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
  // Trust cũng là 1 tab trên mobile (user chốt) — tab cuối; desktop vẫn là khối riêng.
  if (trustCard) {
    specGroupBuiltins.trust = { id: "tab-trust", labelKey: "trust", content: trustCard };
  }
  // Thứ tự mặc định các section body (dùng cho cả desktop stacked + mobile tab widget).
  const BODY_SECTION_DEFAULT_ORDER = [
    "description", "related", "specifications", "faqs", "videos", "reviews", "trust", "accessories",
  ];
  const bodyOrder = parseSectionOrder(product.sectionVisibility, BODY_SECTION_DEFAULT_ORDER);

  // Mobile tab widget chỉ gồm các tab có thể nhét vào widget (không phải related/accessories).
  const TAB_KEYS = new Set(["description", "specifications", "faqs", "videos", "reviews", "trust"]);
  const specGroupOrder = bodyOrder.filter((k) => TAB_KEYS.has(k));
  const hasSpecGroup = Object.keys(specGroupBuiltins).length > 0;

  // Các section body desktop — render theo thứ tự admin đã cấu hình.
  const bodyNodes: Record<string, ReactNode> = {};

  if (hasDescription) {
    bodyNodes.description = (
      <div key="description" className="my-10 max-md:hidden">
        <ProductDescriptionBlocks
          blocks={descriptionBlocks}
          fallback={<ProductDescriptionTab viHtml={descriptionHtml} />}
        />
      </div>
    );
  }

  if (showRelated) {
    bodyNodes.related = (
      <div key="related">
        <div className="product-list pt-40 pb-20 max-md:hidden">
          <div className="block-title text-center mb-40">
            <p className="sub-title"><Tr ns="Product" k="relatedKicker" /></p>
            <h3><Tr ns="Product" k="relatedTitle" /></h3>
          </div>
          <ProductSwiper products={related} />
        </div>
        <div className="product-list pt-80 pb-40 md:hidden">
          <div className="container">
            <div className="block-title text-center mb-40">
              <p className="sub-title"><Tr ns="Product" k="relatedKicker" /></p>
              <h3><Tr ns="Product" k="relatedTitle" /></h3>
            </div>
            <ProductSwiper products={related} />
          </div>
        </div>
      </div>
    );
  }

  if (showSpecs) {
    bodyNodes.specifications = (
      <section key="specifications" className="my-10 max-md:hidden">
        <PdpSectionHeading
          kicker={<Tr ns="Product" k="secKicker.specs" />}
          title={<Tr ns="Product" k="specifications" />}
        />
        <ProductSpecsTable viSpecs={specs} />
      </section>
    );
  }

  if (showFaqs) {
    bodyNodes.faqs = (
      <section key="faqs" className="my-10 max-md:hidden">
        <PdpSectionHeading
          kicker={<Tr ns="Product" k="secKicker.faq" />}
          title={<Tr ns="Product" k="faqs" />}
        />
        <ProductFaqs viFaqs={faqs} />
      </section>
    );
  }

  if (showVideos) {
    bodyNodes.videos = (
      <section key="videos" className="my-10 max-md:hidden">
        <PdpSectionHeading
          kicker={<Tr ns="Product" k="secKicker.videos" />}
          title={<Tr ns="Product" k="videos" />}
        />
        <ProductVideosSection videos={videos} />
      </section>
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
      <div key="trust" className="max-md:hidden">
        <section className="my-10">
          <PdpSectionHeading
            kicker={<Tr ns="Product" k="secKicker.trust" />}
            title={<Tr ns="Product" k="trustBlockTitle" />}
          />
          {trustCard}
        </section>
      </div>
    );
  }

  if (showAccessories) {
    bodyNodes.accessories = (
      <div key="accessories" className="product-list pt-80 pb-40">
        <div className="container">
          <div className="block-title text-center mb-40">
            <p className="sub-title"><Tr ns="Product" k="crossSellKicker" /></p>
            <h3><Tr ns="Product" k="crossSellTitle" /></h3>
          </div>
          <ProductSwiper products={accessories} />
        </div>
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
            "Đòn chốt" bán hàng. Tự ẩn khi không có ô nào. */}
        {vis("specStats") && <FeaturedSpecsBar stats={specStats} />}

        {/* #3 Quick Answer (V236) — đoạn AIO 40–60 từ, blockquote đặt TRƯỚC mọi H2 để Google/AI
            trích dẫn. Chỉ render khi admin có nhập và đã bật. */}
        {quickAnswer && vis("quickAnswer") ? (
          <section className="my-10">
            <blockquote className="border-l-4 border-brand bg-brand-soft px-5 py-4 text-18 leading-relaxed text-foreground">
              <LText field="quickAnswerSummary">{quickAnswer}</LText>
            </blockquote>
          </section>
        ) : null}

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
