"use client";

import { useTranslations } from "next-intl";
import { resolveRatingDisplay } from "@/lib/rating";
import { cn } from "@/lib/utils";
import { RatingStars } from "./RatingStars";

type RatingDisplayProps = {
  rating: number | null | undefined;
  ratingCount: number | null | undefined;
  className?: string;
  iconClassName?: string;
  showScore?: boolean;
  showEmptyLabel?: boolean;
};

/** Shared product rating composition for cards, carousels and compact widgets. */
export function RatingDisplay({
  rating,
  ratingCount,
  className,
  iconClassName,
  showScore = true,
  showEmptyLabel = true,
}: RatingDisplayProps) {
  const t = useTranslations("Common");
  const state = resolveRatingDisplay(rating, ratingCount);
  const countLabel = t("ratingCount", { count: state.count });
  const statusLabel = state.kind === "empty"
    ? t("ratingEmpty")
    : state.kind === "inconsistent"
      ? t("ratingUnavailable")
      : null;
  const ariaLabel = state.kind === "rated"
    ? t("ratingSummaryAria", { rating: state.rating.toFixed(1), count: state.count })
    : state.kind === "empty"
      ? t("ratingEmptyAria")
      : t("ratingUnavailableAria", { count: state.count });

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)} aria-label={ariaLabel}>
      <RatingStars value={state.rating} empty iconClassName={iconClassName} ariaLabel={ariaLabel} />
      {state.kind === "rated" && showScore ? (
        <span className="tabular-nums">{state.rating.toFixed(1)}</span>
      ) : null}
      {state.kind !== "rated" && showEmptyLabel ? <span>{statusLabel}</span> : null}
      {/* Trạng thái rỗng chỉ nói "Chưa có đánh giá" — thêm "0 đánh giá" là lặp ý
          (REVIEW_RULE_003). Count vẫn hiện ở trạng thái rated/inconsistent. */}
      {state.kind !== "empty" ? <span>{countLabel}</span> : null}
    </span>
  );
}
