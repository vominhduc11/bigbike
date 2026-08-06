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

type Row = Record<string, unknown>;
const page = (data: Row[] = []) => ({ data, pagination: { totalPages: 1 }, error: null });

/**
 * Backend resolve `seo.noIndex` theo `lang` của request (SeoIndexPolicy — SEO_RULE_001/002),
 * nên sitemap đọc mỗi danh sách hai lượt. Helper này cho phép mock riêng từng lượt.
 */
function byLang(vi_: Row[], en: Row[] = vi_) {
  return ({ lang }: { lang?: string }) => Promise.resolve(page(lang === "en" ? en : vi_));
}

const CATEGORY = {
  id: "cat-1",
  slug: "non-bao-hiem-moto",
  slugEn: "motorcycle-helmets",
  updatedAt: "2026-07-29T00:00:00Z",
};

function seedDefaults() {
  listProducts.mockImplementation(byLang([]));
  listBrands.mockImplementation(byLang([]));
  listArticles.mockImplementation(byLang([]));
  listCategories.mockImplementation(byLang([CATEGORY]));
}

describe("catalog sitemap canonical URLs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedDefaults();
  });

  it("publishes /sp/ and the new VI category base without legacy catalog paths", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => url.endsWith("/sp/"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/danh-muc/non-bao-hiem-moto/"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/categories/motorcycle-helmets/"))).toBe(true);
    expect(urls.some((url) => url.includes("/danh-muc-san-pham/"))).toBe(false);
    expect(urls.some((url) => url.endsWith("/san-pham/"))).toBe(false);
  });
});

// Sự cố production 2026-08-06: sitemap xin size=1000, CatalogController validate
// @Min(1) @Max(100) → 400 → loadList nuốt lỗi thành `data: []` → sitemap chỉ còn 24 URL
// tĩnh trong khi DB có 181 sản phẩm PUBLISHED.
describe("sitemap: giới hạn kích thước trang của API công khai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedDefaults();
  });

  it("không bao giờ xin quá 100 mục mỗi trang (@Max(100) ở CatalogController)", async () => {
    await sitemap();

    for (const listFn of [listProducts, listCategories, listBrands, listArticles]) {
      expect(listFn).toHaveBeenCalled();
      for (const [query] of listFn.mock.calls) {
        expect(query.size).toBeGreaterThanOrEqual(1);
        expect(query.size).toBeLessThanOrEqual(100);
      }
    }
  });

  it("đọc mỗi danh sách hai lượt vi + en (cờ noIndex resolve theo lang)", async () => {
    await sitemap();

    for (const listFn of [listProducts, listCategories, listBrands, listArticles]) {
      const langs = listFn.mock.calls.map(([query]) => query.lang);
      expect(langs).toContain("vi");
      expect(langs).toContain("en");
    }
  });

  it("đi hết mọi trang khi API báo còn nhiều trang", async () => {
    listProducts.mockImplementation(({ page: p }: { page: number }) =>
      Promise.resolve({
        data: [{ id: `p-${p}`, slug: `sp-${p}`, slugEn: null, updatedAt: null }],
        pagination: { totalPages: 3 },
        error: null,
      }),
    );

    const urls = (await sitemap()).map((entry) => entry.url);

    // 3 trang × 2 ngôn ngữ = 6 lượt gọi.
    expect(listProducts).toHaveBeenCalledTimes(6);
    expect(urls.some((url) => url.endsWith("/product/sp-1/"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/product/sp-3/"))).toBe(true);
  });
});

describe("sitemap: hỏng thì phải báo lỗi, không xuất bản bản thiếu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedDefaults();
  });

  it.each([
    ["products", () => listProducts],
    ["categories", () => listCategories],
    ["brands", () => listBrands],
    ["articles", () => listArticles],
  ])("ném lỗi khi nguồn %s hỏng ở trang đầu", async (_source, pick) => {
    pick().mockResolvedValue({
      data: [],
      pagination: null,
      error: { message: "must be less than or equal to 100", status: 400 },
    });

    await expect(sitemap()).rejects.toThrow(/Sitemap bỏ dở/);
  });

  it("ném lỗi cả khi nguồn hỏng ở trang thứ hai (bản thiếu một nửa cũng không được xuất bản)", async () => {
    listArticles.mockImplementation(({ page: p }: { page: number }) =>
      p === 1
        ? Promise.resolve({
            data: [{ id: "a-1", slug: "bai-1", slugEn: null, updatedAt: null, seo: null }],
            pagination: { totalPages: 2 },
            error: null,
          })
        : Promise.resolve({ data: [], pagination: null, error: { message: "backend timeout" } }),
    );

    await expect(sitemap()).rejects.toThrow(/nguồn "articles(:en)?" lỗi ở trang 2/);
  });

  it("không ném lỗi khi danh sách rỗng thật sự (không có error)", async () => {
    await expect(sitemap()).resolves.toBeInstanceOf(Array);
  });
});

// SEO_RULE_001 (cờ tách theo ngôn ngữ) + SEO_RULE_002 (ngưỡng đủ nội dung EN).
// Backend đã gộp cả hai vào `seo.noIndex` resolve theo `lang`; sitemap chỉ việc đọc.
describe("sitemap: cờ cho-Google-hiển-thị theo từng ngôn ngữ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedDefaults();
  });

  const PRODUCT = { id: "p-1", slug: "mu-bao-hiem", slugEn: "helmet", updatedAt: null };

  it("tắt bản EN: chỉ còn URL tiếng Việt, và bỏ luôn hreflang", async () => {
    listProducts.mockImplementation(
      byLang([{ ...PRODUCT, seo: null }], [{ ...PRODUCT, seo: { noIndex: true } }]),
    );

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls.some((url) => url.endsWith("/product/mu-bao-hiem/"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/en/product/helmet/"))).toBe(false);

    const viEntry = entries.find((entry) => entry.url.endsWith("/product/mu-bao-hiem/"));
    expect(viEntry?.alternates).toBeUndefined();
  });

  it("tắt bản VI: chỉ còn URL tiếng Anh", async () => {
    listProducts.mockImplementation(
      byLang([{ ...PRODUCT, seo: { noIndex: true } }], [{ ...PRODUCT, seo: null }]),
    );

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => url.endsWith("/product/mu-bao-hiem/"))).toBe(false);
    expect(urls.some((url) => url.endsWith("/en/product/helmet/"))).toBe(true);
  });

  it("tắt cả hai: không còn URL nào của sản phẩm đó", async () => {
    listProducts.mockImplementation(byLang([{ ...PRODUCT, seo: { noIndex: true } }]));

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => url.includes("mu-bao-hiem"))).toBe(false);
    expect(urls.some((url) => url.includes("/product/helmet/"))).toBe(false);
  });

  it("bật cả hai: có đủ 2 URL và hreflang vi/en/x-default", async () => {
    listProducts.mockImplementation(byLang([{ ...PRODUCT, seo: null }]));

    const entries = await sitemap();
    const viEntry = entries.find((entry) => entry.url.endsWith("/product/mu-bao-hiem/"));

    expect(entries.some((entry) => entry.url.endsWith("/en/product/helmet/"))).toBe(true);
    expect(viEntry?.alternates?.languages).toMatchObject({
      vi: expect.stringContaining("/product/mu-bao-hiem/"),
      en: expect.stringContaining("/en/product/helmet/"),
      "x-default": expect.stringContaining("/product/mu-bao-hiem/"),
    });
  });

  it("áp dụng cho cả bài viết, danh mục và thương hiệu, không riêng sản phẩm", async () => {
    const article = { id: "a-1", slug: "bai-viet", slugEn: null, updatedAt: null };
    const brand = { id: "b-1", slug: "givi", updatedAt: null };

    listArticles.mockImplementation(
      byLang([{ ...article, seo: null }], [{ ...article, seo: { noIndex: true } }]),
    );
    listBrands.mockImplementation(
      byLang([{ ...brand, seo: null }], [{ ...brand, seo: { noIndex: true } }]),
    );
    listCategories.mockImplementation(
      byLang([{ ...CATEGORY, seo: null }], [{ ...CATEGORY, seo: { noIndex: true } }]),
    );

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => url.endsWith("/tin-tuc/bai-viet/"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/en/tin-tuc/bai-viet/"))).toBe(false);
    expect(urls.some((url) => url.endsWith("/brands/givi/"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/en/brands/givi/"))).toBe(false);
    expect(urls.some((url) => url.endsWith("/danh-muc/non-bao-hiem-moto/"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/categories/motorcycle-helmets/"))).toBe(false);
  });

  it("trang tĩnh không bị ảnh hưởng — luôn có cả 2 ngôn ngữ", async () => {
    listProducts.mockImplementation(byLang([{ ...PRODUCT, seo: { noIndex: true } }]));

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.some((url) => url.endsWith("/sp/"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/en/products/"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/gioi-thieu/"))).toBe(true);
    expect(urls.some((url) => url.endsWith("/en/about/"))).toBe(true);
  });
});
