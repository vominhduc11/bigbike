import { describe, expect, it } from "vitest";
import { buildMerchantFeed } from "@/lib/merchant/feed";
import { merchantProduct, merchantVariants } from "./fixtures";

const namespace = "http://base.google.com/ns/1.0";
function parse(xml: string) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  expect(document.querySelector("parsererror")).toBeNull();
  return [...document.querySelectorAll("item")];
}
const value = (item: Element, name: string) =>
  item.getElementsByTagNameNS(namespace, name)[0]?.textContent;

describe("Google Merchant feed", () => {
  it("exports actual price, sale, stock, images and XML-safe Vietnamese content", () => {
    const product = merchantProduct({
      name: 'Áo <b>Đỏ</b> & "Xanh"\u0001',
      genders: ["Nam", "Nữ"],
    });
    const feed = buildMerchantFeed([product]);
    const [item] = parse(feed.xml);
    expect(feed).toMatchObject({ productCount: 1, itemCount: 1 });
    expect(value(item, "title")).toBe('Áo Đỏ & "Xanh"');
    expect(value(item, "description")).toBe("Mô tả sản phẩm & chất liệu.");
    expect(value(item, "id")).toBe(product.sku);
    expect(value(item, "price")).toBe("900000 VND");
    expect(value(item, "sale_price")).toBe("800000 VND");
    expect(value(item, "gender")).toBe("unisex");
    expect(value(item, "image_link")).toMatch(/^https?:\/\/.+\/media\/uploads\/kiem-thu.webp$/);
    expect(value(item, "availability")).toBe("in_stock");
    expect(value(item, "identifier_exists")).toBeUndefined();
    expect(value(item, "mpn")).toBeUndefined();
    expect(value(item, "gtin")).toBeUndefined();
  });

  it("exports each variant exactly once with its own price, image, availability and selected URL", () => {
    const feed = buildMerchantFeed([merchantVariants()]);
    const [blue, red] = parse(feed.xml);
    expect(feed).toMatchObject({ productCount: 1, itemCount: 2 });
    expect(value(blue, "id")).toBe("E2E_GMC_BLUE_M");
    expect(value(blue, "item_group_id")).toBe("product-1");
    expect(value(blue, "price")).toBe("1200000 VND");
    expect(value(blue, "sale_price")).toBe("1100000 VND");
    expect(value(blue, "image_link")).toContain("/xanh.webp");
    expect(value(blue, "link")).toContain("?variant=variant-blue");
    expect(value(blue, "color")).toBe("Xanh");
    expect(value(blue, "size")).toBe("M");
    expect(blue.getElementsByTagNameNS(namespace, "variant_option")).toHaveLength(2);
    expect(
      Array.from(blue.getElementsByTagNameNS(namespace, "variant_option")).map(
        (option) => option.getElementsByTagNameNS(namespace, "name")[0].textContent,
      ),
    ).toEqual(["Màu sắc", "Kích cỡ"]);
    expect(value(red, "price")).toBe("900000 VND");
    expect(value(red, "availability")).toBe("out_of_stock");
    expect(value(red, "image_link")).toContain("/kiem-thu.webp");
  });

  it("keeps distinct groups when two parent products share a SKU permitted by the catalog", () => {
    const first = merchantVariants();
    const second = merchantVariants();
    second.id = "product-2";
    second.variants = second.variants!.map((variant) => ({ ...variant, sku: `${variant.sku}_2` }));
    const items = parse(buildMerchantFeed([first, second]).xml);
    expect(items.map((item) => value(item, "item_group_id"))).toEqual([
      "product-1",
      "product-1",
      "product-2",
      "product-2",
    ]);
  });

  it("excludes non-public, discontinued and noindex products but retains temporary out-of-stock", () => {
    const products = [
      merchantProduct({ publishStatus: "DRAFT" }),
      merchantProduct({ publishStatus: "TRASH" }),
      merchantProduct({ discontinued: true }),
      merchantProduct({ seo: { noIndex: true } }),
      merchantProduct({ stockState: "OUT_OF_STOCK" }),
    ];
    const [item] = parse(buildMerchantFeed(products).xml);
    expect(value(item, "availability")).toBe("out_of_stock");
    expect(buildMerchantFeed(products).itemCount).toBe(1);
  });

  it("does not fabricate missing descriptions and ignores invalid sale pricing like the storefront", () => {
    const product = merchantProduct({
      description: "",
      price: { retailPrice: 900000, salePrice: 1000000, currency: "VND" },
    });
    const [item] = parse(buildMerchantFeed([product]).xml);
    expect(value(item, "description")).toBe(product.name);
    expect(value(item, "sale_price")).toBeUndefined();
  });

  it("refuses duplicate or invalid offer SKUs and invalid prices instead of publishing a partial file", () => {
    expect(() =>
      buildMerchantFeed([
        merchantProduct(),
        merchantProduct({ id: "second", sku: "e2e_gmc_item" }),
      ]),
    ).toThrow("GMC_SKU_DUPLICATE");
    for (const sku of [undefined, "", "x".repeat(51), "line\nfeed"]) {
      expect(() => buildMerchantFeed([merchantProduct({ sku })])).toThrow("GMC_SKU_INVALID");
    }
    expect(() =>
      buildMerchantFeed([merchantProduct({ price: { retailPrice: NaN, currency: "VND" } })]),
    ).toThrow("GMC_PRICE_INVALID");
    expect(() => buildMerchantFeed([merchantProduct({ image: undefined })])).toThrow(
      "GMC_IMAGE_MISSING",
    );
  });

  it("returns a valid empty feed only for genuinely empty or excluded input", () => {
    expect(parse(buildMerchantFeed([]).xml)).toHaveLength(0);
  });
});
