import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";

import { WpPurchaseSection } from "@/components/wp/WpPurchaseSection";
import { WpProductTabs, type WpTab } from "@/components/wp/WpProductTabs";
import { ProductSwiper } from "@/components/catalog/ProductSwiper";
import { ReviewsSection } from "@/components/catalog/ReviewsSection";
import { RecentlyViewedSection } from "@/components/catalog/RecentlyViewedSection";
import { ProductContactCta } from "@/components/catalog/ProductContactCta";
import type { RecentProduct } from "@/lib/recently-viewed";
import { getProductBySlug, listProducts, listPublicSettings } from "@/lib/api/public-api";
import { buildProductJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeArray, safeText } from "@/lib/utils/format";
import { pickSetting } from "@/lib/utils/settings";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toBrandPath, toCategoryPath, toProductPath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const result = await listProducts({ page: 1, size: 100, sort: "createdAt:desc" });
  return (result.data ?? []).map((p) => ({ slug: p.slug }));
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
      content: descriptionHtml ? (
        <div className="wyswyg" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
      ) : (
        <div className="wyswyg">
          <p>Chưa có mô tả cho sản phẩm này.</p>
        </div>
      ),
    },
    {
      id: "tab-more_infomation",
      label: "Thông số kĩ thuật",
      content:
        specs.length > 0 ? (
          <div className="thong-so-ki-thuat">
            <table className="shop_attributes">
              <tbody>
                {specs.map((s, i) => (
                  <tr key={i}>
                    <th>{s.name}</th>
                    <td>{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="thong-so-ki-thuat">
            <p>Chưa có thông số kĩ thuật cho sản phẩm này.</p>
          </div>
        ),
    },
    {
      id: "tab-faq",
      label: "Câu hỏi thường gặp",
      content:
        faqs.length > 0 ? (
          <div className="flex flex-col gap-0">
            {faqs.map((faq, i) => (
              <details key={i} className="group border-b border-border first:border-t">
                <summary className="flex justify-between items-start gap-3 py-3.5 font-semibold text-foreground cursor-pointer list-none [&::-webkit-details-marker]:hidden after:content-['+'] after:shrink-0 after:text-xl after:font-normal after:text-muted-foreground after:leading-none group-[[open]]:after:content-['−']">
                  {faq.question}
                </summary>
                <div className="pb-3.5 text-muted-foreground">{faq.answer}</div>
              </details>
            ))}
          </div>
        ) : (
          <div className="wyswyg">
            <p>Chưa có câu hỏi thường gặp cho sản phẩm này.</p>
          </div>
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
            <span className="post post-product current-item">{name}</span>
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
        <WpProductTabs tabs={tabs} anchorExtras={[{ id: "reviews", label: "Đánh giá" }]} />
      )}

      {/* Đánh giá sản phẩm — danh sách review đã duyệt + form gửi đánh giá (chờ
          kiểm duyệt). Dùng lại ReviewsSection (tự gọi /api/products/{id}/reviews). */}
      <ReviewsSection productId={product.id} />

      {related.length > 0 && (
        <div className="product-list pt-80 pb-40">
          <div className="container">
            <div className="block-title text-center mb-40">
              <p className="sub-title">SẢN PHẨM LIÊN QUAN</p>
              <h3>Sản phẩm tương tự</h3>
            </div>
            <ProductSwiper products={related} />
          </div>
        </div>
      )}

      {/* Sản phẩm khách đã xem — lịch sử lưu trên trình duyệt, tự bỏ qua sản
          phẩm đang xem; chỉ hiện khi có từ 2 sản phẩm khác trở lên. */}
      <RecentlyViewedSection currentProductId={product.id} currentProduct={recentRecord} />
        </div>

        {/* Dải liên hệ cửa hàng ở chân trang (local-SEO): "Mua <sản phẩm> chính
            hãng tại <shop>" + địa chỉ, hotline, Zalo — lấy từ system settings,
            đồng bộ với footer / trang liên hệ. Đặt ngoài .container vì component tự
            canh giữa theo max-width riêng. */}
        <ProductContactCta
          productName={name}
          siteName={siteName}
          address={contactAddress || undefined}
          hotline={hotline || undefined}
          zaloUrl={zaloUrl || undefined}
        />
      </div>
    </>
  );
}
