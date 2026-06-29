import { describe, expect, it } from "vitest";
import { featureHasText, featureHasImage, groupBlocks } from "./grouping";
import type { FeatureBlockT } from "./grouping";

function makeFeature(overrides: Partial<FeatureBlockT> = {}): FeatureBlockT {
  return { type: "feature", ...overrides };
}

describe("featureHasText", () => {
  it("false khi không có trường chữ nào", () => {
    expect(featureHasText(makeFeature())).toBe(false);
  });

  it("true khi có subheading", () => {
    expect(featureHasText(makeFeature({ subheading: "  Nổi bật  " }))).toBe(true);
  });

  it("false khi subheading chỉ khoảng trắng", () => {
    expect(featureHasText(makeFeature({ subheading: "   " }))).toBe(false);
  });

  it("true khi có heading", () => {
    expect(featureHasText(makeFeature({ heading: "Tính năng" }))).toBe(true);
  });

  it("true khi có html", () => {
    expect(featureHasText(makeFeature({ html: "<p>Nội dung</p>" }))).toBe(true);
  });

  it("false khi html chỉ khoảng trắng", () => {
    expect(featureHasText(makeFeature({ html: "   " }))).toBe(false);
  });

  it("true khi items có ít nhất một phần tử không rỗng", () => {
    expect(featureHasText(makeFeature({ items: ["", "Điểm nổi bật"] }))).toBe(true);
  });

  it("false khi items toàn chuỗi rỗng", () => {
    expect(featureHasText(makeFeature({ items: ["", "  "] }))).toBe(false);
  });

  it("false khi items là mảng rỗng", () => {
    expect(featureHasText(makeFeature({ items: [] }))).toBe(false);
  });
});

describe("featureHasImage", () => {
  it("false khi url undefined", () => {
    expect(featureHasImage(makeFeature())).toBe(false);
  });

  it("false khi url chuỗi rỗng", () => {
    expect(featureHasImage(makeFeature({ url: "" }))).toBe(false);
  });

  it("false khi url chỉ khoảng trắng", () => {
    expect(featureHasImage(makeFeature({ url: "   " }))).toBe(false);
  });

  it("true khi url có giá trị", () => {
    expect(featureHasImage(makeFeature({ url: "/media/uploads/anh.jpg" }))).toBe(true);
  });

  it("true khi url có khoảng trắng quanh nhưng không rỗng", () => {
    expect(featureHasImage(makeFeature({ url: "  /media/abc.jpg  " }))).toBe(true);
  });
});

describe("groupBlocks — khối feature", () => {
  it("tạo group feature cho khối đủ ảnh+chữ", () => {
    const blocks = [makeFeature({ heading: "Nổi bật", url: "/media/a.jpg" })];
    const groups = groupBlocks(blocks);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("feature");
  });

  it("tạo group feature cho khối chỉ có chữ (không ảnh)", () => {
    const blocks = [makeFeature({ heading: "Tiêu đề" })];
    const groups = groupBlocks(blocks);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("feature");
  });

  it("tạo group feature cho khối chỉ có ảnh (không chữ)", () => {
    const blocks = [makeFeature({ url: "/media/b.jpg" })];
    const groups = groupBlocks(blocks);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("feature");
  });

  it("vẫn tạo group feature cho khối trống (lọc ở component, không ở groupBlocks)", () => {
    const blocks = [makeFeature()];
    const groups = groupBlocks(blocks);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe("feature");
  });

  it("xen kẽ reverse đúng cho nhiều khối auto", () => {
    const blocks = [
      makeFeature({ heading: "A", url: "/a.jpg", side: "auto" }),
      makeFeature({ heading: "B", url: "/b.jpg", side: "auto" }),
      makeFeature({ heading: "C", url: "/c.jpg", side: "auto" }),
    ];
    const groups = groupBlocks(blocks);
    if (groups[0].kind === "feature") expect(groups[0].reverse).toBe(false);
    if (groups[1].kind === "feature") expect(groups[1].reverse).toBe(true);
    if (groups[2].kind === "feature") expect(groups[2].reverse).toBe(false);
  });

  it("ép side='right' → reverse=true bất kể thứ tự auto", () => {
    const blocks = [makeFeature({ heading: "A", url: "/a.jpg", side: "right" })];
    const groups = groupBlocks(blocks);
    if (groups[0].kind === "feature") expect(groups[0].reverse).toBe(true);
  });

  it("ép side='left' → reverse=false", () => {
    const blocks = [makeFeature({ heading: "A", url: "/a.jpg", side: "left" })];
    const groups = groupBlocks(blocks);
    if (groups[0].kind === "feature") expect(groups[0].reverse).toBe(false);
  });
});
