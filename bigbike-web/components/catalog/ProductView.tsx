"use client";

import Link from "next/link";
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
import type { Product, PublicSiteSetting } from "@/lib/contracts/public";
import { safeArray, safeText } from "@/lib/utils/format";
import { pickSetting } from "@/lib/utils/settings";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toBrandPath, toCategoryPath } from "@/lib/utils/routes";

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
export function ProductView({ product, settings, previewMode = false }: ProductViewProps) {
  const name = safeText(product.name, "Sản phẩm");

  // Business NAP — same key set as footer / contact page so the bottom contact
  // band shows site-wide values (consistent local-SEO). Empty array in preview.
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
  const contentBottomHtml = product.contentBottom ? sanitizeRichHtml(product.contentBottom) : "";

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
  const promotionContentHtml = product.promotionContent
    ? sanitizeRichHtml(product.promotionContent)
    : "";
  const installationGuideHtml = product.installationGuide
    ? sanitizeRichHtml(product.installationGuide)
    : "";
  const hasTrustInfo =
    warrantyMonths != null ||
    Boolean(warrantyScope) ||
    Boolean(originBrandCountry) ||
    Boolean(originManufactureCountry) ||
    weightGrams != null;

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

  const tabs: WpTab[] = [
    {
      id: "tab-description",
      label: "Mô tả",
      labelKey: "description",
      content: <ProductDescriptionTab viHtml={descriptionHtml} />,
    },
    {
      id: "tab-more_infomation",
      label: "Thông số kĩ thuật",
      labelKey: "specs",
      content: <ProductSpecsTable viSpecs={specs} />,
    },
    {
      id: "tab-faq",
      label: "Câu hỏi thường gặp",
      labelKey: "faqs",
      content: <ProductFaqs viFaqs={faqs} />,
    },
  ];

  const inner = (
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
            previewMode={previewMode}
          />
        </div>

        {/* Khuyến mãi (admin nhập) — khối nổi bật ngay dưới khối mua hàng; chỉ render
            khi có nội dung. Cùng vocabulary section/heading với các khối SEO khác. */}
        {promotionContentHtml ? (
          <section className="my-10 border border-brand/40 bg-brand/5 p-5">
            <h2 className="mb-3 font-heading text-lg font-semibold uppercase text-brand">
              <Tr ns="Product" k="promotion" />
            </h2>
            <div className="wyswyg" dangerouslySetInnerHTML={{ __html: promotionContentHtml }} />
          </section>
        ) : null}

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
                    <li key={index} className="flex gap-2 text-muted-foreground">
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

        {/* Hướng dẫn lắp đặt (admin nhập) — section riêng cạnh bảng size, sanitize
            trước khi render; chỉ hiện khi admin có nhập. */}
        {installationGuideHtml ? (
          <section className="my-10">
            <h2 className="mb-3 font-heading text-lg font-semibold uppercase"><Tr ns="Product" k="installation" /></h2>
            <div className="wyswyg" dangerouslySetInnerHTML={{ __html: installationGuideHtml }} />
          </section>
        ) : null}

        {/* Nội dung dài SEO (contentBottom) — đặt ngay dưới khối tab mô tả/thông
            số/FAQ, nối tiếp mạch nội dung sản phẩm; chỉ render khi admin có nhập. */}
        {contentBottomHtml ? (
          <section className="product-content-bottom mb-40">
            <ProductContentBottom viHtml={contentBottomHtml} />
          </section>
        ) : null}

        {/* Đánh giá sản phẩm — bỏ qua trong preview vì bản nháp chưa có id thật. */}
        {!previewMode && <ReviewsSection productId={product.id} />}

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
