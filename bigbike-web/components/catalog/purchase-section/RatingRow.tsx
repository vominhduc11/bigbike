"use client";

import { useTranslations } from "next-intl";
import { RatingStars } from "@/components/ui/RatingStars";
import { hasApprovedReviews } from "@/lib/rating";

/** Dòng sao + số đánh giá trong buy-box. Gate theo REVIEW_RULE_003: chưa có review thật → chỉ chữ "chưa có đánh giá", KHÔNG xuất microdata aggregateRating. */
export function RatingRow({
  rating,
  count,
}: {
  rating: number | null;
  count: number | null;
}) {
  const t = useTranslations("Product.buyBox");
  // REVIEW_RULE_003 — gate dùng chung; check null lặp lại chỉ để narrow type.
  if (!hasApprovedReviews(rating, count) || rating == null || count == null) {
    return (
      <div className="mt-2 text-ui-14 text-muted-foreground">
        <p className="m-0 !leading-[1.4]">{t("noReviews")}</p>
      </div>
    );
  }

  const displayValue = Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

  return (
    <div
      className="mt-2 text-ui-14"
      itemProp="aggregateRating"
      itemScope
      itemType="https://schema.org/AggregateRating"
    >
      <span className="text-ui-18">
        <RatingStars value={rating} />
      </span>
      <meta itemProp="bestRating" content="5" />
      <p className="m-0 mt-1 text-black !leading-[1.4]">
        <span itemProp="ratingValue" className="text-ui-22 align-middle font-semibold">{displayValue}</span>
        <span aria-hidden="true">★</span>{" "}
        (<span itemProp="reviewCount">{count}</span> {t("reviewsWord")})
      </p>
    </div>
  );
}
