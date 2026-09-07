import type { Product, ProductVariant } from "@/lib/contracts/public";

/** Only an exact, single variant id belonging to this product can select a purchasable row. */
export function resolveLinkedVariant(
  product: Product,
  value?: string | string[],
): ProductVariant | undefined {
  if (typeof value !== "string" || !value || product.discontinued) return undefined;
  return product.variants?.find((variant) => variant.id === value);
}

export function withProductVariant(path: string, variantId: string): string {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("variant", variantId);
  return `${base}?${params.toString()}`;
}

export function variantOptions(variant?: ProductVariant): Record<string, string> {
  return Object.fromEntries((variant?.options ?? []).map(({ name, value }) => [name, value]));
}
