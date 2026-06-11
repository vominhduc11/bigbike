import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/contracts/public";
import { WpProductSwipeItem } from "./WpProductSwipeItem";

vi.mock("@/components/catalog/WishlistButton", () => ({
  WishlistButton: () => <div data-testid="wishlist" />,
}));

vi.mock("@/components/catalog/CompareButton", () => ({
  CompareButton: () => <div data-testid="compare" />,
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    slug: "gang-tay-test",
    name: "Găng tay test",
    category: { id: "c1", slug: "gang-tay", name: "Găng tay" },
    price: { retailPrice: 500000, currency: "VND" },
    stockState: "IN_STOCK",
    publishStatus: "PUBLISHED",
    homepageBlock: "NONE",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  } as Product;
}

describe("WpProductSwipeItem — gate sao theo REVIEW_RULE_003", () => {
  it("ratingCount >= 1 → render .rating-star với data-rating = trung bình cộng", () => {
    const { container } = render(
      <WpProductSwipeItem product={makeProduct({ rating: 3.5, ratingCount: 2 })} />,
    );
    const star = container.querySelector(".rating-star");
    expect(star).not.toBeNull();
    expect(star!.getAttribute("data-rating")).toBe("3.5");
  });

  it("0 review → KHÔNG render .rating-star (plugin theme sẽ không vẽ sao), không còn default 4.5", () => {
    const { container } = render(
      <WpProductSwipeItem product={makeProduct({ rating: null, ratingCount: 0 })} />,
    );
    expect(container.querySelector(".rating-star")).toBeNull();
  });

  it("rating ảo 4.5 nhưng ratingCount null (hàng WP-import) → ẩn sao (REVIEW_RULE_004)", () => {
    const { container } = render(
      <WpProductSwipeItem product={makeProduct({ rating: 4.5, ratingCount: null })} />,
    );
    expect(container.querySelector(".rating-star")).toBeNull();
  });

  it("thiếu cả rating lẫn ratingCount (entry localStorage cũ) → ẩn sao", () => {
    const { container } = render(<WpProductSwipeItem product={makeProduct()} />);
    expect(container.querySelector(".rating-star")).toBeNull();
  });
});
