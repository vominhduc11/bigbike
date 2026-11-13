import type { Product } from "@/lib/contracts/public";
import { buildMerchantFeed } from "./feed";

export function validateStoreCode(value: string | undefined): string {
  if (
    !value ||
    value !== value.trim() ||
    Array.from(value).length > 64 ||
    /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}]/u.test(value)
  ) {
    throw new Error("GMC_STORE_CODE_INVALID");
  }
  return value;
}

export function buildLocalInventoryFeed(products: Product[], storeCode: string) {
  const code = validateStoreCode(storeCode);
  const feed = buildMerchantFeed(products);
  const rows = feed.inventory.map((item) =>
    [code, item.id, item.availability, item.price].join("\t"),
  );
  return {
    tsv: ["store_code\tid\tavailability\tprice", ...rows].join("\n") + "\n",
    productCount: feed.productCount,
    itemCount: feed.itemCount,
  };
}
