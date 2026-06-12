"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Product } from "@/lib/contracts/public";
import { derivePricing } from "@/lib/pricing";
import { formatVndNumber, resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { toProductPath } from "@/lib/utils/routes";
import { WishlistButton } from "@/components/catalog/WishlistButton";
import { CompareButton } from "@/components/catalog/CompareButton";
import { hasApprovedReviews } from "@/lib/rating";
import { RatingStars } from "@/components/ui/RatingStars";

/**
 * content-product-swipe-item — port 1:1 từ theme WP.
 * Bổ sung overlay wishlist + so sánh (bigbike-web feature) hiện khi hover,
 * giữ DOM WP nguyên vẹn cho phần còn lại. Nút "THÊM VÀO GIỎ HÀNG" link tới
 * trang sản phẩm đúng như WP (variable cần chọn option).
 *
 * `wrapperClassName` đổi thẻ bọc ngoài: mặc định "swiper-slide" cho slider
 * (trang chủ / sản phẩm liên quan); "col-md-3 col-6" cho lưới danh mục
 * (woocommerce/content-product.php).
 */
export function WpProductSwipeItem({
  product,
  wrapperClassName = "swiper-slide",
}: {
  product: Product;
  wrapperClassName?: string;
}) {
  const tProduct = useTranslations("Product");
  const { current, compare, isSale, discountPercent } = derivePricing(product.price);
  const href = toProductPath(product.slug);
  const img = toLegacyWpMediaUrl(resolveMediaUrl(product.image?.url?.trim()));
  const name = safeText(product.name, "");
  // REVIEW_RULE_003: chỉ hiện sao khi có ≥ 1 review đã duyệt — không còn default
  // 4.5. Khi 0 review, KHÔNG render `.rating-star` (plugin starRating của theme
  // WP vẽ 2 sao mặc định cho mọi `.rating-star` thiếu data-rating).
  const hasReviews = hasApprovedReviews(product.rating, product.ratingCount);
  const showOld = compare != null && compare > current;

  return (
    <div className={wrapperClassName}>
      <div className="product--item">
        <div className="product--item-thumbnail">
          <Link
            href={href}
            // Thiếu ảnh: biến khung (min-height 200) thành flex để căn logo placeholder
            // vào đúng chính giữa. Ảnh thật giữ nguyên layout WP gốc.
            style={img ? undefined : { display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {img ? (
              // Ảnh tải trực tiếp (không qua Swiper lazy) — KHÔNG để vòng xoay treo.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={name} className="swiper-lazy -lazy" width={1} height={1} />
            ) : (
              // Logo placeholder: căn giữa, giữ tỉ lệ, không kéo giãn / không zoom hover.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/wp/logo-1.png"
                alt={name}
                width={160}
                height={48}
                style={{ width: "55%", maxWidth: 160, height: "auto", opacity: 0.7, transform: "none" }}
              />
            )}
          </Link>
          {isSale && discountPercent ? (
            <div className="product--item-sale">
              <p>{discountPercent}%</p>
            </div>
          ) : null}
          <div className="wp-card-actions">
            <WishlistButton productId={product.id} />
            <CompareButton
              product={{
                id: product.id,
                slug: product.slug,
                name,
                imageUrl: product.image?.url ?? null,
                price: current,
                categoryId: product.category.id,
                categoryName: product.category.name,
              }}
              variant="icon"
            />
          </div>
          <div className="product--item-cart">
            <Link href={href}>
              <i className="fal fa-shopping-cart" />
              {tProduct("cardAddToCart").toUpperCase()}
            </Link>
          </div>
        </div>
        <div className="product--item-desc">
          <div className="product--item-inside row">
            <div className="col-md-12">
              <p className="product--item-title">
                <Link href={href}>{name}</Link>
              </p>
            </div>
            <div className="col-md-12">
              <div className="product--item-price">
                <p>{formatVndNumber(current)} ₫</p>
                {showOld ? <p className="old">{formatVndNumber(compare)} ₫</p> : null}
              </div>
            </div>
          </div>
          <div className="rating">
            {/* Sao vẽ bằng React (RatingStars) thay cho plugin home.min.js — plugin chỉ
                chạy lúc tải nguyên trang nên điều hướng nội bộ sẽ mất sao. Vẫn gate theo
                REVIEW_RULE_003/004 qua hasReviews. text-ui-18 = 18px khớp starSize cũ. */}
            {hasReviews ? (
              <span className="text-ui-18">
                <RatingStars value={product.rating} />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
