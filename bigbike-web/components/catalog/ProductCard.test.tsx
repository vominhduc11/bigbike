import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProductCard } from "@/components/catalog/ProductCard";
import type { Product } from "@/lib/contracts/public";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { rating?: string; count?: number }) => {
    if (key === "ratingStars") return `${values?.rating} sao`;
    if (key === "ratingSummaryAria") return `${values?.rating} sao, ${values?.count} đánh giá`;
    if (key === "ratingCount") return `${values?.count} đánh giá`;
    if (key === "ratingEmpty") return "Chưa có đánh giá";
    if (key === "ratingEmptyAria") return "Chưa có đánh giá, 0 đánh giá";
    if (key === "ratingUnavailable") return "Chưa có điểm trung bình";
    if (key === "ratingUnavailableAria") return `Chưa có điểm trung bình, ${values?.count} đánh giá`;
    return key;
  },
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

describe("ProductCard - hiển thị đánh giá", () => {
  it("hiển thị điểm, sao và số lượt đánh giá khi có đánh giá đã duyệt", () => {
    const { container } = render(
      <ProductCard product={makeProduct({ rating: 3.5, ratingCount: 2 })} />,
    );
    expect(container.querySelector('[aria-label="3.5 sao, 2 đánh giá"]')).not.toBeNull();
    expect(screen.getByText("3.5")).toBeInTheDocument();
    expect(screen.getByText("2 đánh giá")).toBeInTheDocument();
  });

  it("hiển thị sao trung tính và trạng thái chưa có đánh giá", () => {
    const { container } = render(
      <ProductCard product={makeProduct({ rating: null, ratingCount: 0 })} />,
    );
    expect(container.querySelector('[aria-label="Chưa có đánh giá, 0 đánh giá"]')).not.toBeNull();
    expect(screen.getByText("Chưa có đánh giá")).toBeInTheDocument();
    expect(screen.getByText("0 đánh giá")).toBeInTheDocument();
  });

  it("không hiển thị điểm giả khi thiếu số lượt đánh giá", () => {
    const { container } = render(
      <ProductCard product={makeProduct({ rating: 4.5, ratingCount: null })} />,
    );
    expect(container.querySelector('[aria-label="Chưa có đánh giá, 0 đánh giá"]')).not.toBeNull();
    expect(screen.queryByText("4.5")).toBeNull();
  });

  it("vẫn giữ vùng đánh giá khi payload thiếu dữ liệu", () => {
    const { container } = render(<ProductCard product={makeProduct()} />);
    expect(container.querySelector('[aria-label="Chưa có đánh giá, 0 đánh giá"]')).not.toBeNull();
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
