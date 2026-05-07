import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/products/[id]/snapshot/route";

const mockSnapshot = {
  pricing: { retailPrice: 5000000, compareAtPrice: null, salePrice: null, discountPercent: 0, currency: "VND" },
  stock: { stockState: "IN_STOCK", label: "Còn hàng", forceOutOfStock: false, quantity: 10 },
  variants: [],
};

function makeFetchMock(data = mockSnapshot, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 404,
    json: async () => ({ data }),
  });
}

describe("GET /api/products/[id]/snapshot", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", makeFetchMock());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("proxies to /api/v1/products/{id}/snapshot (not the full product endpoint)", async () => {
    const req = new Request("http://localhost/api/products/abc-123/snapshot");
    await GET(req, { params: Promise.resolve({ id: "abc-123" }) });
    const calledUrl: string = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(calledUrl).toContain("/api/v1/products/abc-123/snapshot");
    expect(calledUrl).not.toMatch(/\/api\/v1\/products\/abc-123[^/]/);
  });

  it("returns the backend data object directly (not wrapped)", async () => {
    const req = new Request("http://localhost/api/products/abc-123/snapshot");
    const res = await GET(req, { params: Promise.resolve({ id: "abc-123" }) });
    const json = await res.json() as typeof mockSnapshot;
    expect(json.pricing).toBeDefined();
    expect(json.pricing.retailPrice).toBe(5000000);
    expect(json.stock).toBeDefined();
    expect(json.stock.stockState).toBe("IN_STOCK");
  });

  it("forwards 404 from backend", async () => {
    vi.stubGlobal("fetch", makeFetchMock(mockSnapshot, false));
    const req = new Request("http://localhost/api/products/not-found/snapshot");
    const res = await GET(req, { params: Promise.resolve({ id: "not-found" }) });
    expect(res.status).toBe(404);
  });

  it("returns 502 when backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const req = new Request("http://localhost/api/products/abc/snapshot");
    const res = await GET(req, { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(502);
  });
});
