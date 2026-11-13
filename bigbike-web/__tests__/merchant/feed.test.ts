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
  it("normalizes only all-uppercase parent names while preserving brand and models", () => {
    const product = merchantVariants();
    product.name = "ÁO BẢO HỘ KOMINE JK-177";
    product.brand = { id: "komine", slug: "komine", name: "KOMINE" };
    const [item] = parse(buildMerchantFeed([product]).xml);
    expect(value(item, "title")).toBe("Áo bảo hộ KOMINE JK-177 - Xanh / M");
    product.name = "Áo KOMINE JK-177";
    expect(value(parse(buildMerchantFeed([product]).xml)[0], "title")).toBe(
      "Áo KOMINE JK-177 - Xanh / M",
    );
  });

  it("prefers an original >=800 over a thumbnail and keeps every SKU when no image meets 800", () => {
    const product = merchantVariants();
    product.variants![0].gallery = [
      {
        mediaType: "image",
        image: { url: "/media/blue-1600x1600.jpg", width: 1600, height: 1600 },
      },
      { mediaType: "image", image: { url: "/media/blue-original.jpg", width: 900, height: 900 } },
      { mediaType: "image", image: { url: "/media/blue-largest.jpg", width: 1200, height: 1200 } },
    ];
    const feed = buildMerchantFeed([product]);
    expect(feed.itemCount).toBe(2);
    expect(value(parse(feed.xml)[0], "image_link")).toContain("/blue-largest.jpg");
    expect(feed.xml).not.toContain("blue-1600x1600.jpg");
    expect(value(parse(feed.xml)[1], "image_link")).toContain("/kiem-thu.webp");
  });

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

  it("replaces a known small color cover only with a sufficiently large image from its own gallery", () => {
    const product = merchantVariants();
    const [blue, red] = product.variants!;
    blue.image = { url: "/media/blue-small.jpg", width: 50, height: 50 };
    blue.gallery = [
      { mediaType: "image", image: { url: "/media/blue-small.jpg", width: 50, height: 50 } },
      { mediaType: "image", image: { url: "/media/blue-large.jpg", width: 1176, height: 1176 } },
    ];
    red.image = { url: "/media/red-small.jpg", width: 50, height: 50 };
    red.gallery = [
      { mediaType: "image", image: { url: "/media/red-large.jpg", width: 800, height: 800 } },
    ];
    const items = parse(buildMerchantFeed([product]).xml);
    expect(value(items[0], "image_link")).toContain("/blue-large.jpg");
    expect(value(items[1], "image_link")).toContain("/red-large.jpg");
    expect(items[0].textContent).not.toContain("blue-small.jpg");
    expect(items[0].textContent).not.toContain("red-large.jpg");
  });

  it("uses the largest known own image without borrowing a different color", () => {
    const product = merchantVariants();
    const [blue, red] = product.variants!;
    blue.image = { url: "/media/blue-unknown.jpg" };
    blue.gallery = [
      { mediaType: "image", image: { url: "/media/blue-large.jpg", width: 900, height: 900 } },
    ];
    red.image = { url: "/media/red-small.jpg", width: 50, height: 50 };
    red.gallery = [
      { mediaType: "image", image: { url: "/media/red-unknown.jpg" } },
      { mediaType: "image", image: { url: "/media/red-narrow.jpg", width: 900, height: 499 } },
    ];
    product.gallery = [
      { mediaType: "image", image: { url: "/media/shared.jpg", width: 1000, height: 1000 } },
    ];
    const items = parse(buildMerchantFeed([product]).xml);
    expect(value(items[0], "image_link")).toContain("/blue-large.jpg");
    expect(value(items[1], "image_link")).toContain("/red-narrow.jpg");
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

  it("rejects a single product colliding with another product's variant SKU", () => {
    const variants = merchantVariants();
    const single = merchantProduct({ id: "single", sku: "e2e_gmc_blue_m" });
    expect(() => buildMerchantFeed([single, variants])).toThrow("GMC_SKU_DUPLICATE");
    expect(() => buildMerchantFeed([variants, single])).toThrow("GMC_SKU_DUPLICATE");
    single.publishStatus = "DRAFT";
    expect(buildMerchantFeed([single, variants]).itemCount).toBe(2);
  });
});
