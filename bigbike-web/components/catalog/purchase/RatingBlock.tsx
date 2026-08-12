"use client";

import { useTranslations } from "next-intl";
import { RatingStars } from "@/components/ui/RatingStars";
import { resolveRatingDisplay } from "@/lib/rating";

// Khối sao + microdata aggregateRating trên tiêu đề. Rating rỗng luôn có sao trung
// tính; aggregateRating chỉ xuất khi score và approved count hợp lệ (REVIEW_RULE_003).
export function RatingBlock({
  rating,
  ratingCount,
  onScrollToReviews,
  onOpenWriteReview,
  previewMode = false,
}: {
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
  const state = resolveRatingDisplay(rating, ratingCount);
  const hasRatedReview = state.kind === "rated";
  const ratingAriaLabel = hasRatedReview
    ? tb("ratingAria", { rating: state.rating.toFixed(1), count: state.count })
    : state.kind === "empty"
      ? tb("emptyRatingAria")
      : tb("unavailableRatingAria", { count: state.count });

  if (!hasRatedReview) {
    return (
      <div className="mt-5 font-body text-a4-content text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1" aria-label={ratingAriaLabel}>
          <RatingStars value={state.rating} empty ariaLabel={ratingAriaLabel} />
          <span>{state.kind === "empty" ? tb("noReviews") : tb("ratingUnavailable")}</span>
          {/* Rỗng: "Chưa có đánh giá" đã đủ, thêm "0 đánh giá" là lặp ý (REVIEW_RULE_003). */}
          {state.kind !== "empty" ? <span>{tb("ratingCount", { count: state.count })}</span> : null}
        </div>
        <p className="m-0 mt-2">
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1" aria-label={ratingAriaLabel}>
        <RatingStars value={state.rating} ariaLabel={ratingAriaLabel} />
        <span itemProp="ratingValue" className="tabular-nums">{state.rating.toFixed(1)}/5</span>
        {/* reviewCount đi bằng <meta> để microdata vẫn đủ mà không in số lượt 2 lần
            cạnh nhãn "{n} đánh giá" ngay bên phải. */}
        <meta itemProp="reviewCount" content={String(state.count)} />
        <span>{tb("ratingCount", { count: state.count })}</span>
      </div>
      <p className="mb-0 mt-2">
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
