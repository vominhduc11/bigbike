import { describe, expect, it } from "vitest";
import { hasApprovedReviews, resolveRatingDisplay } from "./rating";

// REVIEW_RULE_003 (docs/business/BUSINESS_RULES.md): mọi widget đều có trạng thái
// sao; count + score hợp lệ mới cho phép hiển thị trạng thái rated.
describe("hasApprovedReviews", () => {
  it("trả true khi có >= 1 review đã duyệt và rating hợp lệ", () => {
    expect(hasApprovedReviews(4.0, 3)).toBe(true);
    expect(hasApprovedReviews(3.5, 2)).toBe(true);
    expect(hasApprovedReviews(1, 1)).toBe(true);
    expect(hasApprovedReviews(5, 100)).toBe(true);
  });

  it("trả false khi 0 review — kể cả khi rating ảo > 0 (data WP-import, REVIEW_RULE_004)", () => {
    expect(hasApprovedReviews(4.5, 0)).toBe(false);
    expect(hasApprovedReviews(4.5, null)).toBe(false);
    expect(hasApprovedReviews(4.5, undefined)).toBe(false);
  });

  it("trả false khi rating thiếu/không vẽ được dù count > 0 (cache lệch)", () => {
    expect(hasApprovedReviews(null, 3)).toBe(false);
    expect(hasApprovedReviews(undefined, 3)).toBe(false);
    expect(hasApprovedReviews(0, 3)).toBe(false);
    expect(hasApprovedReviews(Number.NaN, 3)).toBe(false);
  });

  it("trả false khi cả hai đều thiếu (sản phẩm mới, chưa từng có review)", () => {
    expect(hasApprovedReviews(null, null)).toBe(false);
    expect(hasApprovedReviews(undefined, undefined)).toBe(false);
    expect(hasApprovedReviews(0, 0)).toBe(false);
  });
});

describe("resolveRatingDisplay", () => {
  it("count 0/null luôn là empty, không nhận rating ảo", () => {
    expect(resolveRatingDisplay(null, 0)).toEqual({ kind: "empty", rating: null, count: 0 });
    expect(resolveRatingDisplay(4.5, null)).toEqual({ kind: "empty", rating: null, count: 0 });
  });

  it("count dương + score lỗi là inconsistent nhưng giữ count an toàn", () => {
    expect(resolveRatingDisplay(null, 18)).toEqual({ kind: "inconsistent", rating: null, count: 18 });
    expect(resolveRatingDisplay(Number.NaN, 18)).toEqual({ kind: "inconsistent", rating: null, count: 18 });
  });

  it("count dương + score hợp lệ là rated", () => {
    expect(resolveRatingDisplay(3.5, 2)).toEqual({ kind: "rated", rating: 3.5, count: 2 });
    expect(resolveRatingDisplay(4.25, 2)).toEqual({ kind: "rated", rating: 4.3, count: 2 });
  });
});
