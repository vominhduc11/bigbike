/**
 * Gate hiển thị widget sao dùng chung toàn app — REVIEW_RULE_003
 * (docs/business/BUSINESS_RULES.md): chỉ hiện sao khi sản phẩm có ≥ 1 review
 * đã duyệt. Nguồn chân lý là `ratingCount` / `totalReviews`, KHÔNG phải
 * `rating > 0` — dữ liệu WP-import có thể mang rating ảo 4.5 với
 * rating_count NULL và 0 review thật (REVIEW_RULE_004).
 *
 * Yêu cầu thêm `rating` hữu hạn > 0 để chắc chắn vẽ được sao (phòng cache
 * lệch: count > 0 nhưng rating null).
 */
export function hasApprovedReviews(
  rating: number | null | undefined,
  ratingCount: number | null | undefined,
): boolean {
  return (
    typeof ratingCount === "number" &&
    ratingCount > 0 &&
    typeof rating === "number" &&
    Number.isFinite(rating) &&
    rating > 0
  );
}
