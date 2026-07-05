import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/contracts/public";
import { WpProductSwipeItem } from "./WpProductSwipeItem";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "vi",
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

describe("WpProductSwipeItem — mô hình giá 2 trường (PRODUCT_RULE_012)", () => {
  it("có salePrice hợp lệ → hiện giá sale + giá niêm yết gạch ngang + badge %", () => {
    const { container } = render(
      <WpProductSwipeItem
        product={makeProduct({ price: { retailPrice: 500000, salePrice: 400000, currency: "VND" } })}
      />,
    );
    expect(screen.getByText("400.000 ₫")).toBeInTheDocument();
    const old = container.querySelector(".old");
    expect(old).not.toBeNull();
    expect(old!.textContent).toBe("500.000 ₫");
    expect(container.querySelector(".product--item-sale")).not.toBeNull();
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("chỉ có retailPrice (salePrice trống) → hiện giá niêm yết, KHÔNG gạch ngang/badge", () => {
    const { container } = render(
      <WpProductSwipeItem product={makeProduct({ price: { retailPrice: 500000, currency: "VND" } })} />,
    );
    expect(screen.getByText("500.000 ₫")).toBeInTheDocument();
    expect(container.querySelector(".old")).toBeNull();
    expect(container.querySelector(".product--item-sale")).toBeNull();
  });
});
