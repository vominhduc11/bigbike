import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProductCard } from "@/components/catalog/ProductCard";
import type { Product } from "@/lib/contracts/public";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { rating?: string; count?: number; name?: string }) => {
    if (key === "ratingStars") return `${values?.rating} sao`;
    if (key === "ratingSummaryAria") return `${values?.rating} sao, ${values?.count} đánh giá`;
    if (key === "ratingCount") return `(${values?.count})`;
    if (key === "ratingEmptyAria") return "Chưa có đánh giá, 0 đánh giá";
    if (key === "ratingUnavailableAria") return `Chưa có điểm trung bình, ${values?.count} đánh giá`;
    if (key === "reviews.writeReviewAria") return `Viết đánh giá cho ${values?.name}`;
    if (key === "reviews.formTitle") return "Đánh giá của bạn";
    if (key === "reviews.formIntro") return "Chia sẻ cảm nhận của bạn về sản phẩm.";
    if (key === "close") return "Đóng";
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
  it("hiển thị sao tô một phần và số lượt trong ngoặc khi có đánh giá đã duyệt", () => {
    const { container } = render(
      <ProductCard product={makeProduct({ rating: 3.5, ratingCount: 2 })} />,
    );
    expect(container.querySelector('[aria-label="3.5 sao, 2 đánh giá"]')).not.toBeNull();
    expect(screen.queryByText("3.5")).toBeNull();
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });

  it("ẩn hoàn toàn sao và (0) khi chưa có đánh giá", () => {
    const { container } = render(
      <ProductCard product={makeProduct({ rating: null, ratingCount: 0 })} />,
    );
    expect(container.querySelector('[aria-label="Chưa có đánh giá, 0 đánh giá"]')).toBeNull();
    expect(screen.queryByText("(0)")).toBeNull();
  });

  it("không hiển thị điểm giả khi thiếu số lượt đánh giá", () => {
    const { container } = render(
      <ProductCard product={makeProduct({ rating: 4.5, ratingCount: null })} />,
    );
    expect(container.querySelector('[aria-label="Chưa có đánh giá, 0 đánh giá"]')).toBeNull();
    expect(screen.queryByText("(0)")).toBeNull();
    expect(screen.queryByText("4.5")).toBeNull();
  });

  it("không tạo vùng đánh giá khi payload thiếu dữ liệu", () => {
    const { container } = render(<ProductCard product={makeProduct()} />);
    expect(container.querySelector('[aria-label="Chưa có đánh giá, 0 đánh giá"]')).toBeNull();
  });
});

describe("ProductCard - không viết đánh giá từ danh sách", () => {
  it("không render nút hoặc hộp viết đánh giá trên thẻ sản phẩm", () => {
    render(
      <>
        <ProductCard product={makeProduct({ id: "p1", name: "Găng tay một" })} />
        <ProductCard product={makeProduct({ id: "p2", name: "Găng tay hai" })} />
      </>,
    );

    expect(screen.queryByRole("button", { name: /Viết đánh giá cho/ })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
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

describe("ProductCard - ảnh responsive", () => {
  it("truyền đúng kích thước khung ảnh do lưới cung cấp", () => {
    render(
      <ProductCard
        product={makeProduct({
          image: { url: "/media/uploads/product-test.jpg", width: 1600, height: 1600 },
        })}
        imageSizes="(min-width: 768px) 25vw, 50vw"
      />,
    );

    const image = screen.getByRole("img", { name: "Găng tay test" });
    expect(image).toHaveAttribute("sizes", "(min-width: 768px) 25vw, 50vw");
    expect(image.getAttribute("srcset")).toMatch(/\s\d+w(?:,|$)/);
  });
});
