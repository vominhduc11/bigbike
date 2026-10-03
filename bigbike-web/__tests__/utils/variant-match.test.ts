import { describe, expect, it } from "vitest";
import {
  collectAttributeNames,
  findColorPreviewVariant,
  findMatchingVariant,
  findPreviewVariant,
  getOptionValue,
  isColorAttribute,
  normalizeAttributeName,
  normalizeValue,
} from "@/lib/utils/variant-match";
import type { ProductVariant } from "@/lib/contracts/public";

function variant(id: string, options: Array<[string, string]>, isAvailable = true): ProductVariant {
  return {
    id,
    name: id,
    options: options.map(([name, value]) => ({ name, value })),
    stockState: "IN_STOCK",
    isAvailable,
  };
}

const variants: ProductVariant[] = [
  variant("v_red_s", [
    ["Color", "Đỏ"],
    ["Size", "S"],
  ]),
  variant("v_red_m", [
    ["Color", "Đỏ"],
    ["Size", "M"],
  ]),
  variant(
    "v_red_l",
    [
      ["Color", "Đỏ"],
      ["Size", "L"],
    ],
    false,
  ), // OOS
  variant("v_blue_s", [
    ["Color", "Xanh"],
    ["Size", "S"],
  ]),
  variant("v_blue_m", [
    ["Color", "Xanh"],
    ["Size", "M"],
  ]),
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

  it("groups equivalent names once, preserving the first label and attribute order", () => {
    const mixed = [
      variant("black", [
        [" màu sắc ", "ĐEN"],
        ["Kích cỡ", "XL"],
      ]),
      variant("red", [
        ["Màu sắc", "Đỏ"],
        ["KICH  CO", "XXL"],
      ]),
      variant("white", [
        ["MAU-SAC", "Trắng"],
        ["Chất liệu", "KPA"],
      ]),
    ];
    expect(Array.from(collectAttributeNames(mixed))).toEqual(["màu sắc", "Kích cỡ", "Chất liệu"]);
  });
});

describe("getOptionValue", () => {
  it("matches diacritic-insensitively on attribute name", () => {
    const v = variant("x", [["Màu sắc", "Đỏ"]]);
    expect(getOptionValue(v, "Mau sac")).toBe("Đỏ");
    expect(getOptionValue(v, "MÀU SẮC")).toBe("Đỏ");
  });
});

describe("size label compatibility", () => {
  const mixedSizes = [
    variant("xl", [["Size", "XL"]]),
    variant("bxl", [["Kích cỡ", "BXL"]]),
    variant("xxl", [["Size", "XXL"]]),
  ];

  it.each(["Size", "SIZE", "Kích cỡ", " KÍCH  CỠ ", "kich-co"])(
    "uses the same identity for %s",
    (label) => expect(normalizeAttributeName(label)).toBe("size"),
  );

  it("keeps one size group in either order without renaming its values", () => {
    expect([...collectAttributeNames(mixedSizes)]).toEqual(["Size"]);
    expect([...collectAttributeNames([mixedSizes[1], mixedSizes[0]])]).toEqual(["Kích cỡ"]);
    expect(getOptionValue(mixedSizes[1], "Size")).toBe("BXL");
    expect(getOptionValue(mixedSizes[0], "Kích cỡ")).toBe("XL");
  });

  it("resolves each full choice across labels and rejects conflicting size picks", () => {
    for (const item of mixedSizes) {
      for (const label of ["Size", "Kích cỡ"]) {
        expect(
          findMatchingVariant(mixedSizes, { [label]: item.options![0].value }, { requireAll: true })
            ?.id,
        ).toBe(item.id);
      }
    }
    expect(
      findMatchingVariant(mixedSizes, { Size: "XXL", "Kích cỡ": "BXL" }, { requireAll: true }),
    ).toBeNull();
    expect(findMatchingVariant(mixedSizes, { Size: "M" }, { requireAll: true })).toBeNull();
    expect(findColorPreviewVariant(mixedSizes, { Size: "BXL" })).toBeNull();
  });

  it("preserves availability checks and unrelated attributes", () => {
    const unavailable = [
      { ...mixedSizes[1], isAvailable: false, stockState: "OUT_OF_STOCK" as const },
    ];
    expect(findMatchingVariant(unavailable, { Size: "BXL" }, { onlyAvailable: true })).toBeNull();
    expect(findMatchingVariant(unavailable, { Size: "BXL" }, { inStockOnly: true })).toBeNull();
    expect(findMatchingVariant(unavailable, { Size: "BXL" }, { requireAll: true })?.id).toBe("bxl");
    expect(normalizeAttributeName("Kích thước")).toBe("kich thuoc");
    expect(normalizeAttributeName("Pack size")).toBe("pack size");
    const withMaterial = variant("material-bxl", [
      ["Kích cỡ", "BXL"],
      ["Chất liệu", "Vải"],
    ]);
    expect(findMatchingVariant([withMaterial], { Size: "BXL" }, { requireAll: true })).toBeNull();
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
    const m = findMatchingVariant(variants, { Color: "Đỏ", Size: "L" }, { onlyAvailable: true });
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
    expect(findMatchingVariant(variants, { Color: "Đỏ" }, { requireAll: true })).toBeNull();
  });

  it("accepts full selections when requireAll=true", () => {
    const m = findMatchingVariant(variants, { Color: "Đỏ", Size: "S" }, { requireAll: true });
    expect(m?.id).toBe("v_red_s");
  });

  it("resolves the exact variant when its labels differ from the picker labels", () => {
    const mixed = [
      variant("black-xl", [
        ["màu sắc", "ĐEN"],
        ["Kích cỡ", "XL"],
      ]),
      variant("red-xl", [
        ["Màu sắc", "Đỏ"],
        ["Kích cỡ", "XL"],
      ]),
      variant(
        "red-xxl",
        [
          ["MÀU SẮC", "Đỏ"],
          ["KICH CO", "XXL"],
        ],
        false,
      ),
    ];
    expect(
      findMatchingVariant(
        mixed,
        { "màu sắc": "Đỏ", "Kích cỡ": "XL" },
        {
          requireAll: true,
          onlyAvailable: true,
        },
      )?.id,
    ).toBe("red-xl");
    expect(findMatchingVariant(mixed, { "màu sắc": "Đỏ" }, { requireAll: true })).toBeNull();
    expect(
      findMatchingVariant(
        mixed,
        { "màu sắc": "Đỏ", "Kích cỡ": "XXL" },
        {
          requireAll: true,
          onlyAvailable: true,
        },
      ),
    ).toBeNull();
    expect(findColorPreviewVariant(mixed, { "màu sắc": "Đỏ", "Kích cỡ": "XXL" })?.id).toBe(
      "red-xl",
    );
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
    const purpleOnly = [
      variant(
        "v_purple_l",
        [
          ["Màu sắc", "Tím"],
          ["Size", "L"],
        ],
        false,
      ),
    ];
    const m = findColorPreviewVariant(purpleOnly, { "Màu sắc": "Tím", Size: "L" });
    expect(m?.id).toBe("v_purple_l");
  });
});
