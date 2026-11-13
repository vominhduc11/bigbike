import { describe, expect, it } from "vitest";
import { buildMerchantFeed } from "@/lib/merchant/feed";
import { buildLocalInventoryFeed } from "@/lib/merchant/local-inventory";
import { merchantProduct, merchantVariants } from "./fixtures";

describe("local inventory", () => {
  it("matches every XML id, availability and effective price, without quantity", () => {
    const products = [merchantVariants(), merchantProduct({ id: "simple", sku: "SIMPLE&1" })];
    const xml = new DOMParser().parseFromString(buildMerchantFeed(products).xml, "application/xml");
    const local = buildLocalInventoryFeed(products, "E2E_STORE");
    const [header, ...rows] = local.tsv.trimEnd().split("\n");
    expect(header).toBe("store_code\tid\tavailability\tprice");
    expect(rows).toHaveLength(xml.querySelectorAll("item").length);
    [...xml.querySelectorAll("item")].forEach((item, index) => {
      const field = (name: string) =>
        item.getElementsByTagNameNS("http://base.google.com/ns/1.0", name)[0]?.textContent;
      expect(rows[index].split("\t")).toEqual([
        "E2E_STORE",
        field("id"),
        field("availability"),
        field("sale_price") || field("price"),
      ]);
    });
  });
  it("removes excluded products and never conceals invalid data", () => {
    const local = buildLocalInventoryFeed([merchantProduct({ discontinued: true })], "E2E_STORE");
    expect(local.itemCount).toBe(0);
    expect(local.tsv).toBe("store_code\tid\tavailability\tprice\n");
    expect(() => buildLocalInventoryFeed([merchantProduct({ sku: "" })], "E2E_STORE")).toThrow();
  });
  it.each(["", "bad\tcode", "bad\ncode", " padded", "x".repeat(65)])(
    "rejects unsafe or missing store code %j",
    (code) => {
      expect(() => buildLocalInventoryFeed([], code)).toThrow("GMC_STORE_CODE_INVALID");
    },
  );
});
