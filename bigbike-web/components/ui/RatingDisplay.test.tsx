import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RatingDisplay } from "./RatingDisplay";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { rating?: string; count?: number }) => {
    if (key === "ratingStars") return `${values?.rating} sao`;
    if (key === "ratingSummaryAria") return `${values?.rating} sao, ${values?.count} đánh giá`;
    if (key === "ratingCount") return `(${values?.count})`;
    if (key === "ratingEmptyAria") return "Chưa có đánh giá, 0 đánh giá";
    if (key === "ratingUnavailableAria") return `Chưa có điểm trung bình, ${values?.count} đánh giá`;
    return key;
  },
}));

describe("RatingDisplay", () => {
  it("hiển thị sao tô một phần và số lượt trong ngoặc", () => {
    const { container } = render(<RatingDisplay rating={3.5} ratingCount={18} />);

    expect(screen.queryByText("3.5")).toBeNull();
    expect(screen.getByText("(18)")).toBeInTheDocument();
    expect(container.querySelector('[aria-label="3.5 sao, 18 đánh giá"]')).not.toBeNull();
    expect(container.querySelector("span.absolute")?.getAttribute("style")).toContain("70%");
  });

  it("hiển thị sao trung tính và (0) khi count bằng 0 hoặc null", () => {
    const { rerender, container } = render(<RatingDisplay rating={null} ratingCount={0} />);

    expect(screen.getByText("(0)")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có đánh giá")).toBeNull();
    expect(screen.queryByText("0 đánh giá")).toBeNull();
    expect(container.querySelector('[aria-label="Chưa có đánh giá, 0 đánh giá"]')).not.toBeNull();
    expect(screen.queryByText("0.0")).toBeNull();

    rerender(<RatingDisplay rating={4.5} ratingCount={null} />);
    expect(screen.queryByText("4.5")).toBeNull();
    expect(screen.getByText("(0)")).toBeInTheDocument();
  });

  it("giữ count an toàn nhưng không hiển thị score/status khi payload không nhất quán", () => {
    const { container } = render(<RatingDisplay rating={null} ratingCount={18} />);

    expect(screen.queryByText("Chưa có điểm trung bình")).toBeNull();
    expect(screen.getByText("(18)")).toBeInTheDocument();
    expect(screen.queryByText("0.0")).toBeNull();
    expect(container.querySelector('[aria-label="Chưa có điểm trung bình, 18 đánh giá"]')).not.toBeNull();
  });
});
