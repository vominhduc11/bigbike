import { cache } from "react";
import { getFreshProductBySlug } from "./public-api";
import { productFallbackStore } from "./product-fallback-store";

/** Metadata and page share one fresh attempt; feeds never use this fallback. */
export const getResilientProductBySlug = cache((slug: string, locale: string) =>
  productFallbackStore.load(slug, locale, () => getFreshProductBySlug(slug, locale)),
);
