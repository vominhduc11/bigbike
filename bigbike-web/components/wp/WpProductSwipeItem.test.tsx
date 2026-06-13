import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/contracts/public";
import { WpProductSwipeItem } from "./WpProductSwipeItem";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
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
  it("ratingCount >= 1 → render sao (RatingStars) đúng trung bình cộng", () => {
    const { container } = render(
      <WpProductSwipeItem product={makeProduct({ rating: 3.5, ratingCount: 2 })} />,
    );
    const star = container.querySelector('[aria-label$="sao"]');
    expect(star).not.toBeNull();
    expect(star!.getAttribute("aria-label")).toBe("3.5 sao");
  });

  it("0 review → KHÔNG render sao, không còn default 4.5", () => {
    const { container } = render(
      <WpProductSwipeItem product={makeProduct({ rating: null, ratingCount: 0 })} />,
    );
    expect(container.querySelector('[aria-label$="sao"]')).toBeNull();
  });

  it("rating ảo 4.5 nhưng ratingCount null (hàng WP-import) → ẩn sao (REVIEW_RULE_004)", () => {
    const { container } = render(
      <WpProductSwipeItem product={makeProduct({ rating: 4.5, ratingCount: null })} />,
    );
    expect(container.querySelector('[aria-label$="sao"]')).toBeNull();
  });

  it("thiếu cả rating lẫn ratingCount (entry localStorage cũ) → ẩn sao", () => {
    const { container } = render(<WpProductSwipeItem product={makeProduct()} />);
    expect(container.querySelector('[aria-label$="sao"]')).toBeNull();
  });
});
