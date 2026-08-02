/** Canonical public rating display state (REVIEW_RULE_003/004). */
export type RatingDisplayState =
  | { kind: "empty"; rating: null; count: 0 }
  | { kind: "rated"; rating: number; count: number }
  | { kind: "inconsistent"; rating: null; count: number };

function safeRatingCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

function isValidRating(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 5;
}

/** Product aggregates follow the backend's positive-number HALF_UP one-decimal rule. */
function roundRatingHalfUp(value: number): number {
  return Math.floor(value * 10 + 0.5) / 10;
}

/**
 * Resolves product/API rating data without inventing a score. A positive count
 * with an invalid score stays visible as a neutral state so the safe count is
 * not lost, while null/zero count is the explicit empty state.
 */
export function resolveRatingDisplay(
  rating: number | null | undefined,
  ratingCount: number | null | undefined,
): RatingDisplayState {
  const count = safeRatingCount(ratingCount);
  if (count === 0) {
    return { kind: "empty", rating: null, count: 0 };
  }
  if (!isValidRating(rating)) {
    return { kind: "inconsistent", rating: null, count };
  }
  const rounded = roundRatingHalfUp(rating);
  return rounded > 0
    ? { kind: "rated", rating: rounded, count }
    : { kind: "inconsistent", rating: null, count };
}

export function hasApprovedReviews(
  rating: number | null | undefined,
  ratingCount: number | null | undefined,
): boolean {
  return resolveRatingDisplay(rating, ratingCount).kind === "rated";
}
