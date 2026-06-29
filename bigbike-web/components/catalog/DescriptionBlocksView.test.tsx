import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DescriptionBlock } from "@/lib/contracts/public";
import { DescriptionBlocksView } from "./ProductDescriptionBlocks";

// resolveMediaUrl: trả URL MinIO đã resolve — trong test dùng giá trị gốc cho đơn giản.
vi.mock("@/lib/utils/format", () => ({
  resolveMediaUrl: (url: string | null | undefined) => url ?? null,
  formatPrice: (n: number) => String(n),
}));

// next-intl không cần trong DescriptionBlocksView (không dùng hook localize).
vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => (key: string) => key,
}));

function feature(overrides: Partial<Extract<DescriptionBlock, { type: "feature" }>> = {}): DescriptionBlock {
  return { type: "feature", ...overrides };
}

describe("DescriptionBlocksView — khối feature adaptive", () => {
  it("Quy tắc 4: trống hoàn toàn → không render section", () => {
    const { container } = render(<DescriptionBlocksView blocks={[feature()]} />);
    expect(container.querySelectorAll("section")).toHaveLength(0);
  });

  it("Quy tắc 4: url rỗng + items rỗng → không render section", () => {
    const { container } = render(
      <DescriptionBlocksView blocks={[feature({ url: "", items: [] })]} />,
    );
    expect(container.querySelectorAll("section")).toHaveLength(0);
  });

  it("Quy tắc 2: chỉ có chữ (heading) → không có grid 2 cột, heading hiển thị", () => {
    const { container, getByText } = render(
      <DescriptionBlocksView blocks={[feature({ heading: "Tiêu đề tính năng" })]} />,
    );
    // Có section
    expect(container.querySelectorAll("section")).toHaveLength(1);
    // Không có grid 2 cột
    expect(container.querySelector(".md\\:grid-cols-2")).toBeNull();
    // Nội dung heading hiển thị
    expect(getByText("Tiêu đề tính năng")).toBeTruthy();
    // Không có ảnh
    expect(container.querySelector("img")).toBeNull();
  });

  it("Quy tắc 2: chỉ có chữ (html) → không có grid 2 cột, không ảnh", () => {
    const { container } = render(
      <DescriptionBlocksView blocks={[feature({ html: "<p>Mô tả chi tiết</p>" })]} />,
    );
    expect(container.querySelectorAll("section")).toHaveLength(1);
    expect(container.querySelector(".md\\:grid-cols-2")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("Quy tắc 2: chỉ có chữ (items) → không có grid 2 cột, danh sách hiển thị", () => {
    const { container, getByText } = render(
      <DescriptionBlocksView blocks={[feature({ items: ["Điểm 1", "Điểm 2"] })]} />,
    );
    expect(container.querySelectorAll("section")).toHaveLength(1);
    expect(container.querySelector(".md\\:grid-cols-2")).toBeNull();
    expect(getByText("Điểm 1")).toBeTruthy();
  });

  it("Quy tắc 3: chỉ có ảnh → ảnh hiển thị, không có grid 2 cột", () => {
    const { container } = render(
      <DescriptionBlocksView blocks={[feature({ url: "/media/anh.jpg", alt: "Ảnh mô tả" })]} />,
    );
    expect(container.querySelectorAll("section")).toHaveLength(1);
    expect(container.querySelector(".md\\:grid-cols-2")).toBeNull();
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("/media/anh.jpg");
    expect(img?.getAttribute("alt")).toBe("Ảnh mô tả");
  });

  it("Quy tắc 3: chỉ có ảnh + caption → caption hiển thị", () => {
    const { getByText } = render(
      <DescriptionBlocksView
        blocks={[feature({ url: "/media/anh.jpg", caption: "Chú thích ảnh" })]}
      />,
    );
    expect(getByText("Chú thích ảnh")).toBeTruthy();
  });

  it("Quy tắc 1: đủ ảnh+chữ → grid 2 cột, cả ảnh lẫn heading hiển thị", () => {
    const { container, getByText } = render(
      <DescriptionBlocksView
        blocks={[feature({ url: "/media/anh.jpg", heading: "Nổi bật" })]}
      />,
    );
    expect(container.querySelectorAll("section")).toHaveLength(1);
    expect(container.querySelector(".md\\:grid-cols-2")).toBeTruthy();
    expect(container.querySelector("img")).toBeTruthy();
    expect(getByText("Nổi bật")).toBeTruthy();
  });

  it("Quy tắc 1: nhiều khối xen kẽ trái/phải vẫn giữ đủ cả ảnh+chữ", () => {
    const { container } = render(
      <DescriptionBlocksView
        blocks={[
          feature({ url: "/a.jpg", heading: "A", side: "auto" }),
          feature({ url: "/b.jpg", heading: "B", side: "auto" }),
        ]}
      />,
    );
    expect(container.querySelectorAll("section")).toHaveLength(2);
    expect(container.querySelectorAll(".md\\:grid-cols-2")).toHaveLength(2);
  });

  it("hỗn hợp: trống + chỉ chữ + đủ → chỉ render 2 section", () => {
    const { container } = render(
      <DescriptionBlocksView
        blocks={[
          feature(),                                              // trống → lọc
          feature({ heading: "Chỉ chữ" }),                       // chỉ chữ
          feature({ url: "/a.jpg", heading: "Đủ" }),             // đủ
        ]}
      />,
    );
    expect(container.querySelectorAll("section")).toHaveLength(2);
  });
});
