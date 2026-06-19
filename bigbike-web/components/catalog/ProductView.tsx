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
  ProductInstallationGuide,
  ProductProsCons,
  ProductSpecsTable,
  ProductSuitability,
} from "@/components/catalog/ProductLocalizedParts";
import { ProductDescriptionBlocks } from "@/components/catalog/ProductDescriptionBlocks";
import { ProductTabsSection, type BuiltinTab } from "@/components/catalog/ProductTabsSection";
import { FeaturedSpecsBar } from "@/components/catalog/FeaturedSpecsBar";
import { ProductSwiper } from "@/components/catalog/ProductSwiper";
import { ReadingProgressBar } from "@/components/catalog/ReadingProgressBar";
import { ReviewsSection } from "@/components/catalog/ReviewsSection";
import { WriteReviewDialog } from "@/components/catalog/WriteReviewDialog";
import { RecentlyViewedSection } from "@/components/catalog/RecentlyViewedSection";
import { ProductContactCta } from "@/components/catalog/ProductContactCta";
import type { RecentProduct } from "@/lib/recently-viewed";
import type { DescriptionBlock, Product, PublicSiteSetting } from "@/lib/contracts/public";
import { safeArray, safeText, formatVnd } from "@/lib/utils/format";
import { pickSetting } from "@/lib/utils/settings";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { hasSuitabilityContent } from "@/lib/utils/suitability";
import { hasInstallationContent } from "@/lib/utils/installation";
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
  // "Phù hợp với ai" (V240) — JSON array các thẻ tư vấn; parse bản vi để gate hiển thị (server).
  // Mỗi gate gộp thêm vis(key): admin tắt → coi như không có nội dung (ẩn cả desktop lẫn widget tab mobile).
  const hasSuitability = hasSuitabilityContent(product.suitabilityAdvisory) && vis("suitability");
  const hasDescription = (descriptionBlocks.length > 0 || Boolean(descriptionHtml)) && vis("description");

  const positiveNotes = safeArray(product.positiveNotes)
    .map((n) => safeText(n.content, ""))
    .filter(Boolean);
  const negativeNotes = safeArray(product.negativeNotes)
    .map((n) => safeText(n.content, ""))
    .filter(Boolean);
  const warrantyMonths = product.warrantyMonths ?? null;
  const warrantyScope = safeText(product.warrantyScope, "");
  const sizeGuideHtml = product.sizeGuide ? sanitizeRichHtml(product.sizeGuide) : "";
  // "Hướng dẫn lắp đặt" (V242) — JSON object các bước; chuỗi gốc truyền thẳng cho
  // ProductInstallationGuide parse + render (gate hiển thị qua hasInstallationContent).
  const installationJson = product.installationGuide ?? null;

  const brand = product.brand ?? null;
  const category = product.category?.slug === "chua-phan-loai" ? null : (product.category ?? null);

  const recentRecord: RecentProduct = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price?.retailPrice ?? null,
    imageUrl: product.image?.url ?? gallery[0]?.url ?? null,
    categoryName: product.category?.name ?? null,
    rating: product.rating ?? null,
    ratingCount: product.ratingCount ?? null,
  };

  // Nhóm "Thông số" (V236 restructure): Mô tả/Tính năng kéo RA thành khối full-trang (#4); Đánh giá
  // tách riêng sau FAQ (#10). Bảng size + Thông số + Lắp đặt + FAQ:
  //   • DESKTOP (md+) → các KHỐI XẾP CHỒNG riêng (đúng mockup desktop).
  //   • MOBILE (max-md) → gói lại trong widget tab "như ban đầu" (WpProductTabs) cho dễ điều hướng.
  // Hai bản cùng nội dung, ẩn/hiện theo breakpoint. Tự ẩn từng mục khi rỗng.
  const hasInstallation = hasInstallationContent(installationJson) && vis("installation");

  // Gate có-nội-dung + đã-bật cho các section còn lại (dùng chung desktop + widget tab mobile).
  const showSpecs = specs.length > 0 && vis("specifications");
  const showFaqs = faqs.length > 0 && vis("faqs");
  const showSize = Boolean(sizeGuideHtml) && vis("sizeGuide");
  const showRelated = related.length > 0 && vis("related");
  const showAccessories = accessories.length > 0 && vis("accessories");
  const showReviews = !previewMode && vis("reviews");

  // Trust block "Mua tại BigBike.vn" (#11) — lưới ô số liệu thương mại. Giá/Kho/BH lấy từ sản phẩm;
  // Giao/Đổi là chính sách shop (nhãn tĩnh i18n); Hotline/Địa chỉ từ site settings (rỗng trong preview).
  const retailPrice = product.price?.retailPrice ?? null;
  const stockStateKey = product.stockState ? `stockState.${product.stockState}` : null;
  const trustItems: Array<{ key: string; labelKey: string; value: ReactNode }> = [];
  if (retailPrice != null) {
    trustItems.push({ key: "price", labelKey: "trustPrice", value: formatVnd(retailPrice) });
  }
  if (stockStateKey) {
    trustItems.push({ key: "stock", labelKey: "trustStock", value: <Tr ns="Product" k={stockStateKey} /> });
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
  trustItems.push({ key: "shipping", labelKey: "trustShipping", value: <Tr ns="Product" k="trustShippingValue" /> });
  trustItems.push({ key: "exchange", labelKey: "trustExchange", value: <Tr ns="Product" k="trustExchangeValue" /> });
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
            <dd className="m-0 font-heading text-body font-semibold">{item.value}</dd>
            <dt className="mt-1 text-overline uppercase tracking-wide text-muted-foreground">
              <Tr ns="Product" k={item.labelKey} />
            </dt>
          </div>
        ))}
      </dl>
    </div>
  ) : null;

  // Nội dung 3 khối Ưu/Nhược · Phù hợp với ai · Thông tin SP tách thành biến dùng chung cho cả
  // bản DESKTOP (khối xếp chồng riêng) lẫn MOBILE (tab trong widget) — tránh trùng lặp markup.
  const hasProsCons = (positiveNotes.length > 0 || negativeNotes.length > 0) && vis("prosCons");
  const prosConsGrid = hasProsCons ? (
    <ProductProsCons viPositive={positiveNotes} viNegative={negativeNotes} />
  ) : null;

  const suitabilityBody = hasSuitability ? (
    <ProductSuitability viJson={product.suitabilityAdvisory ?? null} />
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
  if (prosConsGrid) {
    specGroupBuiltins.prosCons = { id: "tab-pros-cons", labelKey: "prosCons", content: prosConsGrid };
  }
  if (suitabilityBody) {
    specGroupBuiltins.suitability = { id: "tab-suitability", labelKey: "suitability", content: suitabilityBody };
  }
  if (showSize) {
    specGroupBuiltins.size = {
      id: "tab-size",
      labelKey: "size",
      content: <div className="wyswyg" dangerouslySetInnerHTML={{ __html: sizeGuideHtml }} />,
    };
  }
  if (showSpecs) {
    specGroupBuiltins.specs = { id: "tab-more_infomation", labelKey: "specs", content: <ProductSpecsTable viSpecs={specs} /> };
  }
  if (hasInstallation) {
    specGroupBuiltins.installation = {
      id: "tab-installation",
      labelKey: "installation",
      content: <ProductInstallationGuide viJson={installationJson} />,
    };
  }
  if (showFaqs) {
    specGroupBuiltins.faq = { id: "tab-faq", labelKey: "faqs", content: <ProductFaqs viFaqs={faqs} /> };
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
  const specGroupOrder = [
    "description", "prosCons", "suitability", "size", "specs", "installation", "faq", "reviews", "trust",
  ];
  const hasSpecGroup = Object.keys(specGroupBuiltins).length > 0;

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
            videos={videos}
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
            <blockquote className="border-l-4 border-brand bg-brand-soft px-5 py-4 text-15 leading-relaxed text-foreground">
              <LText field="quickAnswerSummary">{quickAnswer}</LText>
            </blockquote>
          </section>
        ) : null}

        {/* MOBILE — widget tab "như ban đầu" (đủ bộ: Mô tả · Bảng size · Thông số · Lắp đặt · FAQ ·
            Đánh giá). Đặt TRÊN mô tả. Chỉ hiện ở max-md; desktop dùng khối xếp chồng. */}
        {hasSpecGroup && (
          <div className="my-10 md:hidden">
            <ProductTabsSection tabs={[]} builtins={specGroupBuiltins} defaultOrder={specGroupOrder} />
          </div>
        )}

        {/* #4 Tính năng chi tiết — descriptionBlocks kéo RA khỏi tab thành khối full-trang (DESKTOP).
            Các khối tự mang tiêu đề H2/H3 (split-block). Trên mobile nằm trong widget tab ở trên. */}
        {hasDescription && (
          <div className="my-10 max-md:hidden">
            <ProductDescriptionBlocks
              blocks={descriptionBlocks}
              fallback={<ProductDescriptionTab viHtml={descriptionHtml} />}
            />
          </div>
        )}

        {/* DESKTOP — các khối xếp chồng riêng (#5 Ưu/Nhược → #6 Sản phẩm tương tự → #7 Phù hợp với ai →
            #8-9 Thông số → Thông tin SP). Trên mobile tất cả nằm trong widget tab ở trên.
            Dùng `max-md:hidden` (KHÔNG dùng class `hidden` vì WP theme có `.hidden{display:none!important}`
            unlayered sẽ ẩn cả ở desktop). */}
        <div className="max-md:hidden">
          {/* #5 Ưu điểm & Nhược điểm (V175) — USP độc quyền của BigBike. */}
          {prosConsGrid && (
            <section className="my-10">
              <PdpSectionHeading
                kicker={<Tr ns="Product" k="secKicker.prosCons" />}
                title={<Tr ns="Product" k="tabs.prosCons" />}
              />
              {prosConsGrid}
            </section>
          )}

          {/* #6 Sản phẩm tương tự — "Xem thêm lựa chọn". Đặt NGAY sau Ưu/Nhược điểm: khách vừa đọc
              nhược điểm/giá, đang phân vân → thấy ngay lựa chọn cùng loại, giữ khách lại site thay vì
              thoát ra tìm đối thủ. Mobile render ở cuối trang. */}
          {showRelated && (
            <div className="product-list pt-40 pb-20">
              <div className="block-title text-center mb-40">
                <p className="sub-title"><Tr ns="Product" k="relatedKicker" /></p>
                <h3><Tr ns="Product" k="relatedTitle" /></h3>
              </div>
              <ProductSwiper products={related} />
            </div>
          )}

          {/* #7 Phù hợp với ai — "Nếu… thì…" (V237). */}
          {suitabilityBody && (
            <section className="my-10">
              <PdpSectionHeading
                kicker={<Tr ns="Product" k="suitabilityKicker" />}
                title={<Tr ns="Product" k="suitabilityTitle" />}
              />
              {suitabilityBody}
            </section>
          )}

          {/* #7 Bảng size (V175) — HTML table do admin nhập, sanitize trước khi render. */}
          {showSize ? (
            <section className="my-10">
              <PdpSectionHeading
                kicker={<Tr ns="Product" k="secKicker.size" />}
                title={<Tr ns="Product" k="sizeGuideTitle" />}
              />
              <div className="wyswyg" dangerouslySetInnerHTML={{ __html: sizeGuideHtml }} />
            </section>
          ) : null}

          {/* #8 Thông số kỹ thuật. */}
          {showSpecs && (
            <section className="my-10">
              <PdpSectionHeading
                kicker={<Tr ns="Product" k="secKicker.specs" />}
                title={<Tr ns="Product" k="specifications" />}
              />
              <ProductSpecsTable viSpecs={specs} />
            </section>
          )}

          {/* Hướng dẫn lắp đặt — chỉ render khi admin có nhập. */}
          {hasInstallation && (
            <section className="my-10">
              <PdpSectionHeading
                kicker={<Tr ns="Product" k="secKicker.installation" />}
                title={<Tr ns="Product" k="installation" />}
              />
              <ProductInstallationGuide viJson={installationJson} />
            </section>
          )}

          {/* #9 FAQ. */}
          {showFaqs && (
            <section className="my-10">
              <PdpSectionHeading
                kicker={<Tr ns="Product" k="secKicker.faq" />}
                title={<Tr ns="Product" k="faqs" />}
              />
              <ProductFaqs viFaqs={faqs} />
            </section>
          )}

        </div>

        {/* #10 Đánh giá — DESKTOP: khối riêng sau FAQ (non-embedded → id="reviews" + H2 riêng).
            Trên mobile, Đánh giá nằm trong widget tab ở trên. Bỏ qua trong preview (chưa có id). */}
        {showReviews && (
          <div className="max-md:hidden">
            <ReviewsSection productId={product.id} />
          </div>
        )}

        {/* #11 "Mua tại BigBike.vn" — DESKTOP: tiêu đề mục (eyebrow + 35px) như các mục khác,
            rồi tới thẻ lưới số liệu. Trên mobile nằm trong widget tab ở trên (tab cuối). */}
        {trustCard && (
          // max-md:hidden phải đặt trên <div>, KHÔNG trên <section>: WP reset unlayered
          // `section{display:block}` thắng utility Tailwind layered → section không ẩn nổi
          // trên mobile, khiến "Mua tại BigBike.vn" hiện 2 lần (trùng tab trust ở widget trên).
          <div className="max-md:hidden">
            <section className="my-10">
              <PdpSectionHeading
                kicker={<Tr ns="Product" k="secKicker.trust" />}
                title={<Tr ns="Product" k="trustBlockTitle" />}
              />
              {trustCard}
            </section>
          </div>
        )}

        {/* #12 Hoàn thiện bộ bảo hộ — cross-sell khác loại (găng + giáp + giày), admin curate
            (V239), tự ẩn khi trống. Khối cuối của luồng marketing. */}
        {showAccessories && (
          <div className="product-list pt-80 pb-40">
            <div className="container">
              <div className="block-title text-center mb-40">
                <p className="sub-title"><Tr ns="Product" k="crossSellKicker" /></p>
                <h3><Tr ns="Product" k="crossSellTitle" /></h3>
              </div>
              <ProductSwiper products={accessories} />
            </div>
          </div>
        )}

        {/* Sản phẩm tương tự — MOBILE: hiển thị ở cuối (desktop đã render ở vị trí #6 phía trên). */}
        {showRelated && (
          <div className="product-list pt-80 pb-40 md:hidden">
            <div className="container">
              <div className="block-title text-center mb-40">
                <p className="sub-title"><Tr ns="Product" k="relatedKicker" /></p>
                <h3><Tr ns="Product" k="relatedTitle" /></h3>
              </div>
              <ProductSwiper products={related} />
            </div>
          </div>
        )}

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
