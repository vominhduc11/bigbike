"use client";

import { useTranslations } from "next-intl";
import { RatingStars } from "@/components/ui/RatingStars";

// Khối sao + microdata aggregateRating trên tiêu đề. Chỉ hiện sao khi có đánh giá
// thật (hasReviews — REVIEW_RULE_003); không thì hiện "Chưa có đánh giá" + link viết.
export function RatingBlock({
  hasReviews,
  rating,
  ratingCount,
  onScrollToReviews,
  onOpenWriteReview,
  previewMode = false,
}: {
  hasReviews: boolean;
  rating: number | null;
  ratingCount: number | null;
  onScrollToReviews: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onOpenWriteReview: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Khung xem trước admin: khối đánh giá bị ẩn (không có #reviews, không mount modal
      viết đánh giá) nên các link "Xem/Viết đánh giá" chỉ để nhìn — render mờ, khóa bấm. */
  previewMode?: boolean;
}) {
  const tb = useTranslations("PdpBuyBox");

  // Link đánh giá: bình thường là <a> bấm được; ở chế độ xem trước đổi thành <span>
  // mờ (không bấm được) để admin hiểu đây chỉ để xem, tránh bấm vào không có gì xảy ra.
  const reviewLinkClass = "text-brand! underline-offset-2 hover:underline";
  const reviewDisabledClass = "text-muted-foreground/70 cursor-not-allowed";

  if (!hasReviews) {
    return (
      <div className="mt-5 font-body text-a4-content text-muted-foreground">
        <p className="m-0">
          {tb("noReviews")} —{" "}
          {previewMode ? (
            <span className={reviewDisabledClass} aria-disabled="true">{tb("writeFirst")}</span>
          ) : (
            <a href="#reviews" onClick={onOpenWriteReview} className={reviewLinkClass}>
              {tb("writeFirst")}
            </a>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 font-body text-a4-content text-muted-foreground" itemProp="aggregateRating" itemScope itemType="https://schema.org/AggregateRating">
      {/* Sao vẽ bằng React (RatingStars) — KHÔNG để rỗng chờ plugin home.min.js
          vì script đó chỉ chạy lúc tải nguyên trang, điều hướng nội bộ vào PDP sẽ
          mất sao. text-a4-content = 18px khớp starSize cũ và thẻ sản phẩm. */}
      <span className="text-a4-content">
        <RatingStars value={rating} />
      </span>
      <br />
      <p className="mb-0 mt-2">
        {tb("ratingLabel")} <span itemProp="ratingValue">{rating}/</span>
        <span itemProp="reviewCount">{ratingCount}</span>
        {" — "}
        {previewMode ? (
          <span className={reviewDisabledClass} aria-disabled="true">{tb("viewAllReviews")}</span>
        ) : (
          <a href="#reviews" onClick={onScrollToReviews} className={reviewLinkClass}>
            {tb("viewAllReviews")}
          </a>
        )}
        {" · "}
        {previewMode ? (
          <span className={reviewDisabledClass} aria-disabled="true">{tb("writeReview")}</span>
        ) : (
          <a href="#reviews" onClick={onOpenWriteReview} className={reviewLinkClass}>
            {tb("writeReview")}
          </a>
        )}
      </p>
    </div>
  );
}
