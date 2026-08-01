import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RatingStars } from "./RatingStars";

vi.mock("next-intl", () => ({
  useTranslations: () => (_key: string, values: { rating: string }) => `${values.rating} sao`,
}));

function fillWidth(container: HTMLElement): string | null {
  const overlay = container.querySelector<HTMLElement>("span.absolute");
  return overlay?.style.width ?? null;
}

describe("RatingStars", () => {
  it("tô đúng % theo trung bình cộng — 4.0 ([5,4,3]) → 80%", () => {
    const { container } = render(<RatingStars value={4.0} />);
    expect(fillWidth(container)).toBe("80%");
    expect(container.querySelector('[aria-label="4.0 sao"]')).not.toBeNull();
  });

  it("tô đúng % theo trung bình cộng — 3.5 ([5,2]) → 70% (nửa sao)", () => {
    const { container } = render(<RatingStars value={3.5} />);
    expect(fillWidth(container)).toBe("70%");
    expect(container.querySelector('[aria-label="3.5 sao"]')).not.toBeNull();
  });

  it("clamp giá trị vượt thang về 5 sao", () => {
    const { container } = render(<RatingStars value={7} />);
    expect(fillWidth(container)).toBe("100%");
  });

  // REVIEW_RULE_003: không còn default 4.5 — giá trị thiếu/không hợp lệ thì ẨN.
  it("value = 0 → không render gì (ẩn sao)", () => {
    const { container } = render(<RatingStars value={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("value = NaN → không render gì, không default 4.5", () => {
    const { container } = render(<RatingStars value={Number.NaN} />);
    expect(container.firstChild).toBeNull();
  });

  it("value = null / undefined → không render gì, không default 4.5", () => {
    const { container: c1 } = render(<RatingStars value={null} />);
    expect(c1.firstChild).toBeNull();
    const { container: c2 } = render(<RatingStars value={undefined} />);
    expect(c2.firstChild).toBeNull();
  });

  it("value âm → không render gì", () => {
    const { container } = render(<RatingStars value={-1} />);
    expect(container.firstChild).toBeNull();
  });
});
