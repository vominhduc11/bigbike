import type { Product } from "@/lib/contracts/public";

export type DiscontinuedSuggestionSource = {
  name: string;
  brandName?: string | null;
};

const KIND_TERMS: Array<{ kind: string; terms: string[] }> = [
  { kind: "jacket", terms: ["ao", "jacket", "vest", "jersey", "coat", "giap"] },
  { kind: "pants", terms: ["quan", "pants", "trouser"] },
  { kind: "gloves", terms: ["gang", "glove"] },
  { kind: "helmet", terms: ["mu", "helmet"] },
  { kind: "boots", terms: ["giay", "boot"] },
  { kind: "bag", terms: ["tui", "bag", "balo", "backpack"] },
];

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesTerm(text: string, term: string): boolean {
  return text.split(" ").includes(term);
}

/** The prompt's product-kind fallback is intentionally name-based; it adds no data field. */
export function inferProductKind(name: string | null | undefined): string | null {
  const normalized = normalize(name);
  return KIND_TERMS.find(({ terms }) => terms.some((term) => includesTerm(normalized, term)))?.kind ?? null;
}

function sameBrand(candidate: Product, source: DiscontinuedSuggestionSource): boolean {
  const sourceBrand = normalize(source.brandName);
  return Boolean(sourceBrand && sourceBrand === normalize(candidate.brand?.name));
}

function hasUsablePrice(product: Product): boolean {
  const retailPrice = product.price?.retailPrice ?? 0;
  const salePrice = product.price?.salePrice;
  return retailPrice > 0 && (salePrice == null || (salePrice > 0 && salePrice < retailPrice));
}

function withGalleryImage(product: Product): Product {
  if (product.image?.url?.trim()) return product;
  const galleryImage = product.gallery?.find((media) => media.mediaType !== "video" && media.image?.url?.trim())?.image;
  return galleryImage ? { ...product, image: galleryImage } : product;
}

function hasUsableImage(product: Product): boolean {
  return Boolean(product.image?.url?.trim());
}

/**
 * Pick visible, priced, image-backed products for the discontinued-page carousel.
 * Brand outranks name-derived product kind, which outranks the remaining candidates.
 */
export function selectDiscontinuedSuggestions(
  candidates: Product[],
  source: DiscontinuedSuggestionSource,
  limit = 8,
): Product[] {
  const sourceKind = inferProductKind(source.name);
  const seen = new Set<string>();

  return candidates
    .map(withGalleryImage)
    .filter((product) => {
      if (seen.has(product.id) || product.discontinued || !hasUsablePrice(product) || !hasUsableImage(product)) {
        return false;
      }
      seen.add(product.id);
      return true;
    })
    .map((product, index) => {
      const brandMatch = sameBrand(product, source);
      const kindMatch = Boolean(sourceKind && sourceKind === inferProductKind(product.name));
      return { product, index, score: (brandMatch ? 2 : 0) + (kindMatch ? 1 : 0) };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(0, limit))
    .map(({ product }) => product);
}

