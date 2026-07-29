import { beforeEach, describe, expect, it, vi } from "vitest";

const { listProducts, listCategories, listBrands, listArticles } = vi.hoisted(() => ({
  listProducts: vi.fn(),
  listCategories: vi.fn(),
  listBrands: vi.fn(),
  listArticles: vi.fn(),
}));

vi.mock("@/lib/api/public-api", () => ({
  listProducts,
  listCategories,
  listBrands,
  listArticles,
}));

import sitemap from "@/app/sitemap";

describe("catalog sitemap canonical URLs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProducts.mockResolvedValue({ data: [], pagination: { totalPages: 1 } });
    listBrands.mockResolvedValue({ data: [], pagination: { totalPages: 1 } });
    listArticles.mockResolvedValue({ data: [], pagination: { totalPages: 1 } });
    listCategories.mockResolvedValue({
      data: [
        {
          slug: "non-bao-hiem-moto",
          slugEn: "motorcycle-helmets",
          updatedAt: "2026-07-29T00:00:00Z",
        },
      ],
      pagination: { totalPages: 1 },
    });
  });

  it("publishes /sp/ and the new VI category base without legacy catalog paths", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls.some((url) => url.endsWith("/sp/"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/danh-muc/non-bao-hiem-moto/"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/categories/motorcycle-helmets/"))).toBe(true);
    expect(urls.some((url) => url.includes("/danh-muc-san-pham/"))).toBe(false);
    expect(urls.some((url) => url.endsWith("/san-pham/"))).toBe(false);
  });
});
