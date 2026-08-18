import { describe, expect, it } from "vitest";

import type { Product } from "@/lib/contracts/public";
import { inferProductKind, selectDiscontinuedSuggestions } from "@/lib/utils/discontinued-suggestions";

function product(
  id: string,
  name: string,
  options: { brand?: string; image?: boolean; galleryImage?: boolean; price?: number; discontinued?: boolean } = {},
): Product {
  return {
    id,
    slug: id,
    name,
    brand: options.brand ? { id: options.brand, slug: options.brand.toLowerCase(), name: options.brand } : undefined,
    image: options.image ? { url: `/media/${id}.jpg`, alt: name } : undefined,
    gallery: options.galleryImage ? [{ mediaType: "image", image: { url: `/media/${id}-gallery.jpg` } }] : [],
    price: { retailPrice: options.price ?? 100, currency: "VND" },
    stockState: "IN_STOCK",
    publishStatus: "PUBLISHED",
    discontinued: options.discontinued ?? false,
    homepageBlock: "NONE",
    createdAt: "",
    updatedAt: "",
  };
}

describe("discontinued suggestions", () => {
  it("infers the requested product kind from its name", () => {
    expect(inferProductKind("Áo giáp touring")).toBe("jacket");
    expect(inferProductKind("Quần bảo hộ")).toBe("pants");
    expect(inferProductKind("Găng tay moto")).toBe("gloves");
  });

  it("ranks same brand before same kind, then other candidates", () => {
    const results = selectDiscontinuedSuggestions(
      [
        product("other-pants", "Quần bảo hộ khác", { brand: "Other", image: true }),
        product("same-kind", "Áo giáp khác", { brand: "Different", image: true }),
        product("same-brand-pants", "Quần bảo hộ", { brand: "Scoyco", image: true }),
        product("same-brand-jacket", "Áo bảo hộ", { brand: "Scoyco", image: true }),
      ],
      { name: "Áo giáp Scoyco", brandName: "Scoyco" },
    );

    expect(results.map((item) => item.id)).toEqual([
      "same-brand-jacket",
      "same-brand-pants",
      "same-kind",
      "other-pants",
    ]);
  });

  it("uses the first gallery image and excludes unpriced, image-less, or discontinued rows", () => {
    const results = selectDiscontinuedSuggestions(
      [
        product("gallery-only", "Áo bảo hộ", { galleryImage: true }),
        product("no-image", "Áo bảo hộ"),
        product("bad-price", "Áo bảo hộ", { image: true, price: 0 }),
        product("discontinued", "Áo bảo hộ", { image: true, discontinued: true }),
      ],
      { name: "Áo giáp cũ" },
    );

    expect(results.map((item) => item.id)).toEqual(["gallery-only"]);
    expect(results[0]?.image?.url).toContain("gallery-only-gallery.jpg");
  });
});
