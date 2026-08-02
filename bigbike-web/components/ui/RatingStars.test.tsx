import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RatingStars } from "./RatingStars";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { rating?: string }) =>
    key === "ratingStars" ? `${values?.rating} sao` : key,
}));

function fillWidth(container: HTMLElement): string | null {
  const overlay = container.querySelector<HTMLElement>("span.absolute");
  return overlay?.style.width ?? null;
}

describe("RatingStars", () => {
  it("tô đúng % theo trung bình cộng — 4.0 → 80%", () => {
    const { container } = render(<RatingStars value={4.0} />);
    expect(fillWidth(container)).toBe("80%");
    expect(container.querySelector('[aria-label="4.0 sao"]')).not.toBeNull();
  });

  it("tô đúng % theo trung bình cộng — 3.5 → 70%", () => {
    const { container } = render(<RatingStars value={3.5} />);
    expect(fillWidth(container)).toBe("70%");
  });

  it("score vượt thang không tạo rating giả — hiển thị sao trung tính", () => {
    const { container } = render(<RatingStars value={7} />);
    expect(fillWidth(container)).toBeNull();
    expect(container.querySelectorAll("svg")).toHaveLength(5);
  });

  it.each([
    [0, "ratingEmptyStars"],
    [Number.NaN, "ratingEmptyStars"],
    [null, "ratingEmptyStars"],
    [undefined, "ratingEmptyStars"],
    [-1, "ratingEmptyStars"],
  ])("giá trị %s → 5 sao rỗng, không ẩn widget", (value, label) => {
    const { container } = render(<RatingStars value={value} />);
    expect(container.querySelector(`[aria-label="${label}"]`)).not.toBeNull();
    expect(fillWidth(container)).toBeNull();
    expect(container.querySelectorAll("svg")).toHaveLength(5);
  });

  it("empty=false giữ được primitive ẩn khi caller cần", () => {
    const { container } = render(<RatingStars value={null} empty={false} />);
    expect(container.firstChild).toBeNull();
  });
});
