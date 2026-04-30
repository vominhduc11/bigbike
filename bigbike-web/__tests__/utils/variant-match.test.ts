import { describe, expect, it } from "vitest";
import {
  collectAttributeNames,
  findColorPreviewVariant,
  findMatchingVariant,
  findPreviewVariant,
  getOptionValue,
  isColorAttribute,
  normalizeValue,
} from "@/lib/utils/variant-match";
import type { ProductVariant } from "@/lib/contracts/public";

function variant(
  id: string,
  options: Array<[string, string]>,
  isAvailable = true,
): ProductVariant {
  return {
    id,
    name: id,
    options: options.map(([name, value]) => ({ name, value })),
    stockState: "IN_STOCK",
    isAvailable,
  };
}

const variants: ProductVariant[] = [
  variant("v_red_s", [["Color", "Đỏ"], ["Size", "S"]]),
  variant("v_red_m", [["Color", "Đỏ"], ["Size", "M"]]),
  variant("v_red_l", [["Color", "Đỏ"], ["Size", "L"]], false), // OOS
  variant("v_blue_s", [["Color", "Xanh"], ["Size", "S"]]),
  variant("v_blue_m", [["Color", "Xanh"], ["Size", "M"]]),
];

describe("normalizeValue", () => {
  it("strips diacritics + lowercases", () => {
    expect(normalizeValue("Đỏ")).toBe("do");
    expect(normalizeValue("Kích thước")).toBe("kich thuoc");
  });

  it("treats different casings of same accented value as equal", () => {
    expect(normalizeValue("ĐỎ")).toBe(normalizeValue("đỏ"));
  });
});

describe("collectAttributeNames", () => {
  it("returns set of all attribute names across variants", () => {
    const names = collectAttributeNames(variants);
    expect(names.has("Color")).toBe(true);
    expect(names.has("Size")).toBe(true);
    expect(names.size).toBe(2);
  });

  it("is empty when no variants", () => {
    expect(collectAttributeNames([]).size).toBe(0);
  });
});

describe("getOptionValue", () => {
  it("matches diacritic-insensitively on attribute name", () => {
    const v = variant("x", [["Màu sắc", "Đỏ"]]);
    expect(getOptionValue(v, "Mau sac")).toBe("Đỏ");
    expect(getOptionValue(v, "MÀU SẮC")).toBe("Đỏ");
  });
});

describe("isColorAttribute", () => {
  it("recognizes Vietnamese labels and WP-style color codes", () => {
    expect(isColorAttribute("Màu sắc")).toBe(true);
    expect(isColorAttribute("mau-sac")).toBe(true);
    expect(isColorAttribute("pa_color")).toBe(true);
    expect(isColorAttribute("Size")).toBe(false);
  });
});

describe("findMatchingVariant — partial selection", () => {
  it("returns first variant matching just one picked attribute", () => {
    const m = findMatchingVariant(variants, { Color: "Đỏ" });
    expect(m?.id).toBe("v_red_s");
  });

  it("prefers available variants when onlyAvailable=true", () => {
    const m = findMatchingVariant(
      variants,
      { Color: "Đỏ", Size: "L" },
      { onlyAvailable: true },
    );
    expect(m).toBeNull(); // v_red_l is OOS
  });

  it("returns null when nothing picked", () => {
    expect(findMatchingVariant(variants, {})).toBeNull();
  });

  it("returns full match when all attributes picked", () => {
    const m = findMatchingVariant(variants, { Color: "Xanh", Size: "M" });
    expect(m?.id).toBe("v_blue_m");
  });
});

describe("findMatchingVariant — requireAll", () => {
  it("rejects partial selections when requireAll=true", () => {
    expect(
      findMatchingVariant(variants, { Color: "Đỏ" }, { requireAll: true }),
    ).toBeNull();
  });

  it("accepts full selections when requireAll=true", () => {
    const m = findMatchingVariant(
      variants,
      { Color: "Đỏ", Size: "S" },
      { requireAll: true },
    );
    expect(m?.id).toBe("v_red_s");
  });
});

describe("findPreviewVariant", () => {
  it("falls back to OOS variant when no available match exists", () => {
    const m = findPreviewVariant(variants, { Color: "Đỏ", Size: "L" });
    expect(m?.id).toBe("v_red_l"); // OOS but still previewable
  });

  it("prefers available variant when both exist", () => {
    const m = findPreviewVariant(variants, { Color: "Đỏ" });
    expect(m?.id).toBe("v_red_s"); // first available Đỏ variant
  });

  it("returns null when no picks made", () => {
    expect(findPreviewVariant(variants, {})).toBeNull();
  });
});

describe("findColorPreviewVariant", () => {
  it("ignores size-only picks so gallery does not change by size", () => {
    expect(findColorPreviewVariant(variants, { Size: "M" })).toBeNull();
  });

  it("uses color only even when a full variant selection is present", () => {
    const m = findColorPreviewVariant(variants, { Color: "Đỏ", Size: "M" });
    expect(m?.id).toBe("v_red_s");
  });

  it("falls back to OOS variant when the picked color has no available variant", () => {
    const purpleOnly = [variant("v_purple_l", [["Màu sắc", "Tím"], ["Size", "L"]], false)];
    const m = findColorPreviewVariant(purpleOnly, { "Màu sắc": "Tím", Size: "L" });
    expect(m?.id).toBe("v_purple_l");
  });
});
