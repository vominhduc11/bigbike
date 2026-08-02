import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RatingDisplay } from "./RatingDisplay";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { rating?: string; count?: number }) => {
    if (key === "ratingStars") return `${values?.rating} sao`;
    if (key === "ratingSummaryAria") return `${values?.rating} sao, ${values?.count} đánh giá`;
    if (key === "ratingEmpty") return "Chưa có đánh giá";
    if (key === "ratingUnavailable") return "Chưa có điểm trung bình";
    if (key === "ratingCount") return `${values?.count} đánh giá`;
    if (key === "ratingEmptyAria") return "Chưa có đánh giá, 0 đánh giá";
    if (key === "ratingUnavailableAria") return `Chưa có điểm trung bình, ${values?.count} đánh giá`;
    return key;
  },
}));

describe("RatingDisplay", () => {
  it("hiển thị điểm một chữ số, sao một phần và số lượt đánh giá", () => {
    const { container } = render(<RatingDisplay rating={3.5} ratingCount={18} />);

    expect(screen.getByText("3.5")).toBeInTheDocument();
    expect(screen.getByText("18 đánh giá")).toBeInTheDocument();
    expect(container.querySelector('[aria-label="3.5 sao, 18 đánh giá"]')).not.toBeNull();
    expect(container.querySelector("span.absolute")?.getAttribute("style")).toContain("70%");
  });

  it("hiển thị trạng thái trung tính khi count bằng 0 hoặc null", () => {
    const { rerender, container } = render(<RatingDisplay rating={null} ratingCount={0} />);

    expect(screen.getByText("Chưa có đánh giá")).toBeInTheDocument();
    expect(screen.getByText("0 đánh giá")).toBeInTheDocument();
    expect(container.querySelector('[aria-label="Chưa có đánh giá, 0 đánh giá"]')).not.toBeNull();
    expect(screen.queryByText("0.0")).toBeNull();

    rerender(<RatingDisplay rating={4.5} ratingCount={null} />);
    expect(screen.queryByText("4.5")).toBeNull();
    expect(screen.getByText("Chưa có đánh giá")).toBeInTheDocument();
  });

  it("giữ count an toàn nhưng không hiển thị score giả khi payload không nhất quán", () => {
    const { container } = render(<RatingDisplay rating={null} ratingCount={18} />);

    expect(screen.getByText("Chưa có điểm trung bình")).toBeInTheDocument();
    expect(screen.getByText("18 đánh giá")).toBeInTheDocument();
    expect(screen.queryByText("0.0")).toBeNull();
    expect(container.querySelector('[aria-label="Chưa có điểm trung bình, 18 đánh giá"]')).not.toBeNull();
  });
});
