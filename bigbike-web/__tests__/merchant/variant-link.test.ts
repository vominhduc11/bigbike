import { describe, expect, it } from "vitest";
import { buildProductJsonLd } from "@/lib/seo/json-ld";
import {
  resolveLinkedVariant,
  variantOptions,
  withProductVariant,
} from "@/lib/utils/product-variant-link";
import { merchantVariants } from "./fixtures";

describe("Merchant variant landing links", () => {
  it("resolves the exact variant including unavailable choices, rejects unknown and repeated query values", () => {
    const product = merchantVariants();
    const variant = resolveLinkedVariant(product, "variant-red");
    expect(variant?.sku).toBe("E2E_GMC_RED_L");
    expect(variant?.isAvailable).toBe(false);
    expect(variantOptions(variant)).toEqual({ "Màu sắc": "Đỏ", Size: "L" });
    expect(resolveLinkedVariant(product, "foreign-variant")).toBeUndefined();
    expect(resolveLinkedVariant(product, ["variant-red", "variant-blue"])).toBeUndefined();
    expect(resolveLinkedVariant({ ...product, discontinued: true }, "variant-red")).toBeUndefined();
  });

  it("encodes the id and preserves existing query parameters", () => {
    expect(withProductVariant("/product/test/?lang=vi", "v&1")).toBe(
      "/product/test/?lang=vi&variant=v%261",
    );
  });

  it("emits the selected SKU's price, image, stock and group in server-side structured data", () => {
    const product = merchantVariants();
    const schema = buildProductJsonLd(product, "/product/san-pham-kiem-thu/", "variant-red");
    expect(schema).toMatchObject({
      "@type": "Product",
      sku: "E2E_GMC_RED_L",
      inProductGroupWithID: product.id,
      offers: { price: 800000, availability: "https://schema.org/OutOfStock" },
    });
    expect(schema.url).toContain("?variant=variant-red");
    expect((schema.image as string[])[0]).toContain("/media/uploads/kiem-thu.webp");
    const group = buildProductJsonLd(product);
    expect(group.productGroupID).toBe(product.id);
    expect((group.hasVariant as { offers: { url: string } }[])[0].offers.url).toContain(
      "?variant=variant-blue",
    );
  });
});
