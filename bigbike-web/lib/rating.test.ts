import { describe, expect, it } from "vitest";
import { hasApprovedReviews } from "./rating";

// REVIEW_RULE_003 (docs/business/BUSINESS_RULES.md): chỉ hiện sao khi có
// >= 1 review đã duyệt — nguồn chân lý là ratingCount, không phải rating > 0.
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
