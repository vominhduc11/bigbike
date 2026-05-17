// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/search-suggest/route";

const mockProduct = {
  id: "p1",
  slug: "xe-dap-abc",
  name: "Xe đạp ABC",
  price: { retailPrice: 5000000, salePrice: null },
  image: null,
};

function makeFetchMock(products = [mockProduct]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: { query: "xe", products, articles: [] },
    }),
  });
}

describe("GET /api/search-suggest", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", makeFetchMock());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the dedicated /api/v1/search-suggest backend endpoint", async () => {
    const req = new Request("http://localhost/api/search-suggest?q=xe");
    await GET(req);
    const calledUrl: string = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("/api/v1/search-suggest");
    expect(calledUrl).not.toContain("/api/v1/products");
  });

  it("passes limit=6 (not size/page)", async () => {
    const req = new Request("http://localhost/api/search-suggest?q=xe");
    await GET(req);
    const calledUrl: string = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("limit=6");
    expect(calledUrl).not.toContain("size=");
    expect(calledUrl).not.toContain("page=");
  });

  it("returns products array from data.products", async () => {
    const req = new Request("http://localhost/api/search-suggest?q=xe");
    const res = await GET(req);
    const json = await res.json() as { products: typeof mockProduct[] };
    expect(json.products).toHaveLength(1);
    expect(json.products[0].slug).toBe("xe-dap-abc");
  });

  it("returns empty products for short query (< 2 chars) without hitting backend", async () => {
    const req = new Request("http://localhost/api/search-suggest?q=x");
    const res = await GET(req);
    const json = await res.json() as { products: unknown[] };
    expect(json.products).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns empty products when backend is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const req = new Request("http://localhost/api/search-suggest?q=xe");
    const res = await GET(req);
    const json = await res.json() as { products: unknown[] };
    expect(json.products).toHaveLength(0);
  });
});
