import type { Product, ProductVariant } from "@/lib/contracts/public";
import { derivePricing } from "@/lib/pricing";
import { resolveMediaUrl } from "@/lib/utils/format";
import { normalizeMetaDescription } from "@/lib/utils/text";
import { toCanonicalUrl, toProductPath } from "@/lib/utils/routes";
import { withProductVariant } from "@/lib/utils/product-variant-link";
import { isColorAttribute, normalizeValue } from "@/lib/utils/variant-match";

export type LocalInventoryItem = { id: string; availability: string; price: string };
export type MerchantFeed = {
  xml: string;
  productCount: number;
  itemCount: number;
  inventory: LocalInventoryItem[];
};
const SIZE_ATTRIBUTES = new Set(["size", "kich co", "kich thuoc", "co", "pa size", "pa kich co"]);

/** XML 1.0 permits tabs/newlines but forbids control characters and unpaired surrogates. */
function cleanXml(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const code = character.codePointAt(0)!;
      return (
        code === 9 ||
        code === 10 ||
        code === 13 ||
        (code >= 0x20 && code <= 0xd7ff) ||
        (code >= 0xe000 && code <= 0xfffd) ||
        (code >= 0x10000 && code <= 0x10ffff)
      );
    })
    .join("");
}

function xml(value: string): string {
  return cleanXml(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function text(value: string | null | undefined, limit: number): string {
  return Array.from(normalizeMetaDescription(value, Number.MAX_SAFE_INTEGER))
    .slice(0, limit)
    .join("")
    .trim();
}

function field(name: string, value: string | undefined): string {
  return value ? `<g:${name}>${xml(value)}</g:${name}>` : "";
}

function sku(value: string | undefined): string {
  const id = value?.trim() ?? "";
  if (!id || Array.from(id).length > 50 || cleanXml(id) !== id || /[\t\r\n]/.test(id)) {
    throw new Error("GMC_SKU_INVALID");
  }
  return id;
}

function imageUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(toCanonicalUrl(resolveMediaUrl(value.trim()) ?? value.trim()));
  if (!/^https?:$/.test(url.protocol) || url.username || url.password)
    throw new Error("GMC_IMAGE_URL_INVALID");
  return url.toString();
}

function images(product: Product, variant?: ProductVariant): string[] {
  const ownGallery = (variant?.gallery ?? []).filter((media) => media.mediaType === "image");
  const hasOwnImages = Boolean(variant?.image?.url) || ownGallery.some((media) => media.image?.url);
  const gallery = hasOwnImages
    ? ownGallery
    : (product.gallery ?? []).filter((media) => media.mediaType === "image");
  const cover = hasOwnImages ? variant?.image : product.image;
  const candidates = [cover, ...gallery.map((media) => media.image)]
    .filter((asset) => Boolean(asset?.url?.trim()))
    .map((asset) => {
      const width = asset?.width ?? 0;
      const height = asset?.height ?? 0;
      const url = imageUrl(asset?.url)!;
      return {
        url,
        area: width > 0 && height > 0 ? width * height : 0,
        preferred:
          width >= 800 && height >= 800 && !/-\d+x\d+(?=[-.])/i.test(new URL(url).pathname),
      };
    });
  // Never cross to another color or drop an SKU just because its best image is small.
  candidates.sort((a, b) => Number(b.preferred) - Number(a.preferred) || b.area - a.area);
  const primary = candidates[0];
  const selected = candidates.filter(
    (asset) =>
      asset === primary ||
      (!(primary?.preferred && /-\d+x\d+(?=[-.])/i.test(new URL(asset.url).pathname)) &&
        !(primary && primary.area > asset.area && asset.area > 0 && asset.area < 500 * 500)),
  );
  return [...new Set(selected.map((asset) => asset.url))].slice(0, 11);
}

function merchantName(product: Product): string {
  const name = text(product.name, 150).normalize("NFC");
  if (name !== name.toLocaleUpperCase("vi") || name === name.toLocaleLowerCase("vi")) return name;
  const brand = product.brand?.name?.normalize("NFC");
  // Keep known brand spelling and alphanumeric manufacturer/model tokens intact.
  const words = name
    .split(/(\s+)/)
    .map((word) => (/[\p{L}].*\d|\d.*[\p{L}]/u.test(word) ? word : word.toLocaleLowerCase("vi")));
  let normalized = words.join("");
  if (brand) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu"),
      () => brand,
    );
  }
  return normalized.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase("vi"));
}

function description(product: Product): string {
  const content = [
    product.shortDescription,
    product.quickAnswerSummary,
    product.description,
    ...(product.descriptionBlocks ?? [])
      .filter((block) => block.type === "paragraph")
      .map((block) => block.html),
    product.seo?.description,
    product.name,
  ];
  return content.map((value) => text(value, 5000)).find(Boolean) ?? "";
}

function gender(product: Product): string | undefined {
  const male = product.genders?.includes("Nam");
  const female = product.genders?.includes("Nữ");
  return male && female ? "unisex" : male ? "male" : female ? "female" : undefined;
}

function optionName(name: string): string {
  if (isColorAttribute(name)) return "Màu sắc";
  if (SIZE_ATTRIBUTES.has(normalizeValue(name))) return "Kích cỡ";
  return text(name, 250);
}

/** GMC_RULE_002–005: public data only, one real sellable SKU per item, never fabricated identifiers. */
export function buildMerchantFeed(products: Product[]): MerchantFeed {
  const eligible = products.filter(
    (product) =>
      product.publishStatus === "PUBLISHED" && !product.discontinued && !product.seo?.noIndex,
  );
  const ids = new Set<string>();
  const groups = new Set<string>();
  const items: string[] = [];
  const inventory: LocalInventoryItem[] = [];

  for (const product of eligible) {
    const parentName = merchantName(product);
    const body = description(product);
    if (!parentName || !body || !product.slug) throw new Error("GMC_PRODUCT_CONTENT_INVALID");
    const variants = product.variants ?? [];
    const groupId = variants.length ? sku(product.id) : undefined;
    if (groupId) {
      const groupKey = groupId.normalize("NFC").toLowerCase();
      if (groups.has(groupKey)) throw new Error("GMC_GROUP_ID_DUPLICATE");
      groups.add(groupKey);
    }

    for (const variant of variants.length ? variants : [undefined]) {
      const id = sku(variant ? variant.sku : product.sku);
      const key = id.normalize("NFC").toLowerCase();
      if (ids.has(key)) throw new Error("GMC_SKU_DUPLICATE");
      ids.add(key);

      const pricing = derivePricing(variant?.price ?? product.price);
      const currency = (variant?.price ?? product.price)?.currency;
      if (
        currency !== "VND" ||
        !Number.isSafeInteger(pricing.retail) ||
        pricing.retail <= 0 ||
        !Number.isSafeInteger(pricing.current) ||
        pricing.current <= 0
      )
        throw new Error("GMC_PRICE_INVALID");
      if (
        variant &&
        (!variant.id || !variant.name?.trim() || typeof variant.isAvailable !== "boolean")
      ) {
        throw new Error("GMC_VARIANT_INVALID");
      }
      if (!variant && !["IN_STOCK", "OUT_OF_STOCK"].includes(product.stockState))
        throw new Error("GMC_STOCK_INVALID");

      const path = toProductPath(product.slug, "vi");
      const link = toCanonicalUrl(variant ? withProductVariant(path, variant.id) : path);
      const pictureUrls = images(product, variant);
      if (!pictureUrls.length) throw new Error("GMC_IMAGE_MISSING");
      const options = variant?.options ?? [];
      if (
        options.length > 30 ||
        options.some((option) => !option.name?.trim() || !option.value?.trim())
      ) {
        throw new Error("GMC_VARIANT_OPTIONS_INVALID");
      }
      const color = options.find((option) => isColorAttribute(option.name))?.value;
      const size = options.find((option) =>
        SIZE_ATTRIBUTES.has(normalizeValue(option.name)),
      )?.value;
      const inStock = variant ? variant.isAvailable : product.stockState === "IN_STOCK";

      inventory.push({
        id,
        availability: inStock ? "in_stock" : "out_of_stock",
        price: `${pricing.current} VND`,
      });
      items.push(
        `<item>${[
          field("id", id),
          field("title", text(variant ? `${parentName} - ${variant.name}` : parentName, 150)),
          field("description", body),
          field("link", link),
          field("image_link", pictureUrls[0]),
          ...pictureUrls.slice(1).map((url) => field("additional_image_link", url)),
          field("availability", inStock ? "in_stock" : "out_of_stock"),
          field("price", `${pricing.retail} VND`),
          field("sale_price", pricing.sale ? `${pricing.sale} VND` : undefined),
          field("condition", "new"),
          field("brand", text(product.brand?.name, 70)),
          field("product_type", text(product.category?.name ?? product.categories?.[0]?.name, 750)),
          field("gender", gender(product)),
          field("item_group_id", groupId),
          field("item_group_title", groupId ? parentName : undefined),
          field("color", text(color, 100)),
          field("size", text(size, 100)),
          ...options.map(
            (option) =>
              `<g:variant_option>${field("name", optionName(option.name))}${field("value", text(option.value, 250))}</g:variant_option>`,
          ),
        ].join("")}</item>`,
      );
    }
  }

  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>BigBike</title><link>${xml(toCanonicalUrl("/"))}</link><description>Sản phẩm BigBike</description>${items.join("\n")}</channel></rss>`,
    productCount: eligible.length,
    itemCount: items.length,
    inventory,
  };
}
