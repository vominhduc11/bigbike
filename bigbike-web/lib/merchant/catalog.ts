import { getMerchantProductDetail, getMerchantProductPage } from "@/lib/api/public-api";
import type { Product } from "@/lib/contracts/public";

const PAGE_LIMIT = 50;
const CONCURRENCY = 8;
let pending: Promise<Product[]> | undefined;

/** Share only concurrent work, never a completed/failed catalog snapshot. */
export function loadMerchantCatalog(): Promise<Product[]> {
  if (!pending) {
    const controller = new AbortController();
    pending = readCatalog(
      AbortSignal.any([controller.signal, AbortSignal.timeout(45_000)]),
    ).finally(() => {
      controller.abort();
      pending = undefined;
    });
  }
  return pending;
}

async function readCatalog(signal: AbortSignal): Promise<Product[]> {
  const summaries: Product[] = [];
  const ids = new Set<string>();
  let totalItems: number | undefined;
  let totalPages = 1;

  for (let page = 1; page <= totalPages; page++) {
    const response = await getMerchantProductPage(page, signal);
    const pagination = response?.pagination;
    if (
      !Array.isArray(response?.data) ||
      !pagination ||
      pagination.page !== page ||
      !Number.isInteger(pagination.totalItems) ||
      pagination.totalItems < 0 ||
      !Number.isInteger(pagination.totalPages) ||
      pagination.totalPages < 0 ||
      !Number.isInteger(pagination.pageSize) ||
      pagination.pageSize < 1 ||
      pagination.pageSize > 100 ||
      Math.max(1, pagination.totalPages) !==
        Math.max(1, Math.ceil(pagination.totalItems / pagination.pageSize)) ||
      pagination.totalPages > PAGE_LIMIT ||
      (totalItems !== undefined &&
        (pagination.totalItems !== totalItems || pagination.totalPages !== totalPages))
    ) {
      throw new Error("GMC_PAGINATION_INVALID");
    }
    totalItems = pagination.totalItems;
    totalPages = pagination.totalPages;
    const expected = Math.min(
      pagination.pageSize,
      Math.max(0, totalItems - (page - 1) * pagination.pageSize),
    );
    if (response.data.length !== expected) throw new Error("GMC_CATALOG_INCOMPLETE");
    for (const product of response.data) {
      if (!product?.id || !product.slug || ids.has(product.id))
        throw new Error("GMC_CATALOG_DUPLICATE_OR_INVALID");
      ids.add(product.id);
      summaries.push(product);
    }
  }
  if (summaries.length !== totalItems) throw new Error("GMC_CATALOG_INCOMPLETE");

  const products: Product[] = new Array(summaries.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, summaries.length) }, async () => {
      while (cursor < summaries.length) {
        const index = cursor++;
        const summary = summaries[index];
        const product = await getMerchantProductDetail(summary.slug, signal);
        if (product.id !== summary.id) throw new Error("GMC_PRODUCT_CHANGED_DURING_READ");
        products[index] = product;
      }
    }),
  );
  return products;
}
