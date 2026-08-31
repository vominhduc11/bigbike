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

  it("forwards the selected language to the backend", async () => {
    const req = new Request("http://localhost/api/search-suggest?q=helmet&lang=en");
    await GET(req);
    const calledUrl = new URL((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(calledUrl.searchParams.get("lang")).toBe("en");
  });

  it("returns products array from data.products", async () => {
    const req = new Request("http://localhost/api/search-suggest?q=xe");
    const res = await GET(req);
    const json = await res.json() as { products: typeof mockProduct[] };
    expect(json.products).toHaveLength(1);
    expect(json.products[0].slug).toBe("xe-dap-abc");
  });

  it("returns empty products for blank query without hitting backend", async () => {
    const req = new Request("http://localhost/api/search-suggest?q=%20");
    const res = await GET(req);
    const json = await res.json() as { products: unknown[] };
    expect(json.products).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a recoverable system error when backend is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const req = new Request("http://localhost/api/search-suggest?q=xe");
    const res = await GET(req);
    const json = await res.json() as { error: { code: string } };
    expect(res.status).toBe(502);
    expect(json.error.code).toBe("SEARCH_UNAVAILABLE");
  });

  it("preserves a backend rate-limit response for the retry UI", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many requests" } }),
      { status: 429, headers: { "content-type": "application/json", "retry-after": "60" } },
    )));
    const req = new Request("http://localhost/api/search-suggest?q=xe");
    const res = await GET(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect((await res.json() as { error: { code: string } }).error.code).toBe("RATE_LIMITED");
  });
});
