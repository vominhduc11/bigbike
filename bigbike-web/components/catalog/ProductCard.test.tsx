import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProductCard } from "@/components/catalog/ProductCard";
import type { Product } from "@/lib/contracts/public";

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

describe("ProductCard - hiển thị đánh giá đã duyệt", () => {
  it("hiển thị sao khi sản phẩm có đánh giá đã duyệt", () => {
    const { container } = render(
      <ProductCard product={makeProduct({ rating: 3.5, ratingCount: 2 })} />,
    );
    expect(container.querySelector('[aria-label="3.5 sao"]')).not.toBeNull();
  });

  it("ẩn sao khi chưa có đánh giá", () => {
    const { container } = render(
      <ProductCard product={makeProduct({ rating: null, ratingCount: 0 })} />,
    );
    expect(container.querySelector('[aria-label$="sao"]')).toBeNull();
  });

  it("ẩn điểm nhập cũ khi không có số lượng đánh giá", () => {
    const { container } = render(
      <ProductCard product={makeProduct({ rating: 4.5, ratingCount: null })} />,
    );
    expect(container.querySelector('[aria-label$="sao"]')).toBeNull();
  });

  it("ẩn sao khi thiếu toàn bộ dữ liệu đánh giá", () => {
    const { container } = render(<ProductCard product={makeProduct()} />);
    expect(container.querySelector('[aria-label$="sao"]')).toBeNull();
  });
});

describe("ProductCard - giá bán", () => {
  it("hiển thị giá sale, giá niêm yết và phần trăm giảm", () => {
    const { container } = render(
      <ProductCard
        product={makeProduct({
          price: { retailPrice: 500000, salePrice: 400000, currency: "VND" },
        })}
      />,
    );
    expect(screen.getByText("400.000 ₫")).toBeInTheDocument();
    expect(container.querySelector("[data-product-old-price]")?.textContent).toBe("500.000 ₫");
    expect(container.querySelector("[data-product-sale]")).not.toBeNull();
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("chỉ hiển thị giá niêm yết khi không có sale", () => {
    const { container } = render(<ProductCard product={makeProduct()} />);
    expect(screen.getByText("500.000 ₫")).toBeInTheDocument();
    expect(container.querySelector("[data-product-old-price]")).toBeNull();
    expect(container.querySelector("[data-product-sale]")).toBeNull();
  });
});
