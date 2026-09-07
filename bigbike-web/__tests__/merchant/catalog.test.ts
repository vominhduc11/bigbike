// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadMerchantCatalog } from "@/lib/merchant/catalog";
import { getMerchantProductDetail, getMerchantProductPage } from "@/lib/api/public-api";
import { merchantProduct } from "./fixtures";

vi.mock("@/lib/api/public-api", () => ({
  getMerchantProductPage: vi.fn(),
  getMerchantProductDetail: vi.fn(),
}));
const products = [
  merchantProduct(),
  merchantProduct({ id: "product-2", slug: "san-pham-2", sku: "E2E_GMC_2" }),
];
const page = (number: number, data = [products[number - 1]]) => ({
  data,
  pagination: {
    page: number,
    pageSize: 1,
    totalItems: 2,
    totalPages: 2,
    hasNext: number === 1,
    hasPrevious: number > 1,
  },
  meta: { requestId: "test", timestamp: "2026-09-07T00:00:00Z" },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getMerchantProductPage).mockImplementation(async (number) => page(number));
  vi.mocked(getMerchantProductDetail).mockImplementation(async (slug) =>
    products.find((product) => product.slug === slug)!,
  );
});

describe("Complete Merchant catalog reads", () => {
  it("reads all pages and full details, sharing concurrent work only", async () => {
    const [first, shared] = await Promise.all([loadMerchantCatalog(), loadMerchantCatalog()]);
    expect(first).toEqual(products);
    expect(shared).toBe(first);
    expect(getMerchantProductPage).toHaveBeenCalledTimes(2);
    expect(getMerchantProductDetail).toHaveBeenCalledTimes(2);
    await loadMerchantCatalog();
    expect(getMerchantProductPage).toHaveBeenCalledTimes(4);
  });

  it("refuses failed detail/page requests, never returning the rest as a successful catalog", async () => {
    vi.mocked(getMerchantProductPage).mockRejectedValueOnce(new Error("upstream"));
    await expect(loadMerchantCatalog()).rejects.toThrow("upstream");
    vi.mocked(getMerchantProductDetail).mockRejectedValueOnce(new Error("detail failed"));
    await expect(loadMerchantCatalog()).rejects.toThrow("detail failed");
  });

  it("refuses missing rows, duplicate ids and changed pagination", async () => {
    vi.mocked(getMerchantProductPage).mockResolvedValueOnce(page(1, []));
    await expect(loadMerchantCatalog()).rejects.toThrow("GMC_CATALOG_INCOMPLETE");
    vi.mocked(getMerchantProductPage).mockImplementation(async (number) =>
      page(number, [products[0]]),
    );
    await expect(loadMerchantCatalog()).rejects.toThrow("GMC_CATALOG_DUPLICATE_OR_INVALID");
    vi.mocked(getMerchantProductPage).mockImplementation(async (number) => ({
      ...page(number),
      pagination: { ...page(number).pagination, totalItems: number === 2 ? 3 : 2 },
    }));
    await expect(loadMerchantCatalog()).rejects.toThrow("GMC_PAGINATION_INVALID");
  });

  it("refuses a missing pagination envelope and catalogs above the supported limit", async () => {
    vi.mocked(getMerchantProductPage).mockResolvedValueOnce({ data: [] } as never);
    await expect(loadMerchantCatalog()).rejects.toThrow("GMC_PAGINATION_INVALID");
    vi.mocked(getMerchantProductPage).mockResolvedValueOnce({
      ...page(1),
      pagination: { ...page(1).pagination, totalItems: 51, totalPages: 51 },
    });
    await expect(loadMerchantCatalog()).rejects.toThrow("GMC_PAGINATION_INVALID");
  });

  it("allows an explicit empty catalog", async () => {
    vi.mocked(getMerchantProductPage).mockResolvedValueOnce({
      ...page(1, []),
      pagination: { ...page(1).pagination, totalItems: 0, totalPages: 0, hasNext: false },
    });
    await expect(loadMerchantCatalog()).resolves.toEqual([]);
    expect(getMerchantProductDetail).not.toHaveBeenCalled();
  });
});
