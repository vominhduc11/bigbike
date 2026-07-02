"use client";

import { useTranslations } from "next-intl";
import type { Product } from "@/lib/contracts/public";
import { derivePricing } from "@/lib/pricing";
import { formatVndNumber, resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { hasApprovedReviews } from "@/lib/rating";
import { RatingStars } from "@/components/ui/RatingStars";
import { cn } from "@/lib/utils";

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
  const img = toLegacyWpMediaUrl(resolveMediaUrl(product.image?.url?.trim()));
  const name = safeText(product.name, "");
  // REVIEW_RULE_003: chỉ hiện sao khi có ≥ 1 review đã duyệt — không còn default
  // 4.5. Khi 0 review, KHÔNG render `.rating-star` (plugin starRating của theme
  // WP vẽ 2 sao mặc định cho mọi `.rating-star` thiếu data-rating).
  const hasReviews = hasApprovedReviews(product.rating, product.ratingCount);
  const showOld = compare != null && compare > current;

  // Lưới danh mục (`col-*`) cần MỌI thẻ cao bằng nhau, bất kể tên dài/ngắn hay
  // tỉ lệ ảnh khác nhau. Carousel (swiper-slide) giữ nguyên look WP gốc.
  // Cách đều: thẻ là flex-col cao 100% cột → ảnh khung vuông cố định → tên kẹp 2
  // dòng chiều cao cố định → giá luôn nằm cùng một mốc.
  const isGrid = wrapperClassName.includes("col-");

  return (
    <div className={wrapperClassName}>
      <div className={cn("product--item", isGrid && "flex h-full flex-col")}>
        <div className="product--item-thumbnail">
          <LocalizedLink
            kind="product"
            viSlug={product.slug}
            enSlug={product.slugEn}
            // Lưới: khung ảnh VUÔNG bằng nhau mọi thẻ, ảnh contain (mũ cao / áo khoác /
            // găng tay / tai nghe rộng đều fit, KHÔNG cắt). Dùng inline style vì theme WP
            // (wp-theme-category.css) đặt cứng `.product--item-thumbnail>a{min-height:200px;
            // display:block}` + `a img{width:auto}` + `img{transform:scale(1.05)}` — đè cả
            // Tailwind. Trong đó `min-height:200px` gặp `aspect-square` ép luôn CHIỀU RỘNG
            // = 200px > khung 160px ở mobile → tràn phải 40px bị `overflow:hidden` cắt.
            // Ép min-height:0 để ô vuông tính theo bề rộng; các rule WP không có !important
            // nên inline thắng. Nhánh carousel (!isGrid) giữ nguyên min-height 200 của WP.
            className={cn(isGrid && "overflow-hidden")}
            style={
              isGrid
                ? {
                    display: "flex",
                    minHeight: 0,
                    aspectRatio: "1 / 1",
                    alignItems: "center",
                    justifyContent: "center",
                  }
                : !img
                  ? { display: "flex", alignItems: "center", justifyContent: "center" }
                  : undefined
            }
          >
            {img ? (
              // Ảnh tải trực tiếp (không qua Swiper lazy) — KHÔNG để vòng xoay treo.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt={name}
                className="swiper-lazy -lazy"
                loading="lazy"
                style={
                  isGrid
                    ? {
                        width: "100%",
                        height: "100%",
                        maxWidth: "100%",
                        objectFit: "contain",
                        padding: 8,
                        transform: "none",
                      }
                    : undefined
                }
                width={1}
                height={1}
              />
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
          </LocalizedLink>
          {isSale && discountPercent ? (
            <div className="product--item-sale">
              <p>{discountPercent}%</p>
            </div>
          ) : null}
          <div className="product--item-cart">
            {/* Theme WP nhúng sẵn font literal "Barlow Condensed" (cinline-*.woff) và
                gán cứng cho nút này → nét hẹp, khác tên sản phẩm. Ép font body Arial
                (inline thắng CSS WP). */}
            <LocalizedLink kind="product" viSlug={product.slug} enSlug={product.slugEn} style={{ fontFamily: "var(--bb-font-body)" }}>
              {tProduct("cardSelect").toUpperCase()}
            </LocalizedLink>
          </div>
        </div>
        <div className={cn("product--item-desc", isGrid && "flex flex-1 flex-col")}>
          <div className="product--item-inside row">
            <div className="col-md-12">
              <p
                className={cn(
                  "product--item-title uppercase",
                  // Kẹp tên về 2 dòng, leading + min-height khớp nhau (2 × 1.25em) →
                  // tên 1 dòng vẫn chiếm đúng 2 dòng → giá luôn cùng một mốc.
                  isGrid && "line-clamp-2 min-h-[2.5em] leading-tight",
                )}
                style={{ fontFamily: "var(--bb-font-body)" }}
              >
                <LocalizedLink kind="product" viSlug={product.slug} enSlug={product.slugEn}>{name}</LocalizedLink>
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
