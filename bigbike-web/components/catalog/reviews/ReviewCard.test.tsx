import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReviewCard } from "./ReviewCard";

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string, values?: { rating?: string }) => {
    if (key === "reviewStarsAria") return `${values?.rating} sao`;
    if (key === "ratingUnavailable") return "Chưa có điểm trung bình";
    if (key === "showMore") return "Xem thêm";
    if (key === "showLess") return "Thu gọn";
    if (key === "photosLabel") return "Ảnh trong đánh giá";
    if (key === "photoAlt") return `Ảnh ${values?.rating ?? "review"}`;
    return key;
  },
}));

vi.mock("@/components/i18n/LocalDate", () => ({ LocalDate: () => "01/08/2026" }));
vi.mock("@/components/ui/Avatar", () => ({ Avatar: () => <span data-testid="avatar" /> }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const review = {
  id: 1,
  authorName: "Nguyễn Văn A",
  rating: 4.25,
  comment: "Sản phẩm tốt.",
  createdAt: "2026-08-01T00:00:00Z",
};

describe("ReviewCard", () => {
  it("dùng sao một phần cho rating hợp lệ của từng review", () => {
    const { container } = render(<ReviewCard review={review} />);
    expect(screen.getByLabelText("4.3 sao")).toBeInTheDocument();
    expect(container.querySelector("span.absolute")?.getAttribute("style")).toContain("85%");
  });

  it("dùng trạng thái trung tính khi rating của review bất thường", () => {
    const { container } = render(<ReviewCard review={{ ...review, rating: 0 }} />);
    expect(screen.getByLabelText("Chưa có điểm trung bình")).toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(5);
    expect(container.querySelector("span.absolute")).toBeNull();
  });
});
