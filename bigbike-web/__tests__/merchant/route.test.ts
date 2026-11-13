// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, HEAD } from "@/app/google-merchant.xml/route";
import { loadMerchantCatalog } from "@/lib/merchant/catalog";
import { merchantProduct } from "./fixtures";

vi.mock("@/lib/merchant/catalog", () => ({ loadMerchantCatalog: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

describe("Merchant XML HTTP contract", () => {
  it("serves downloadable XML with counts and no caching; HEAD has the same headers without a body", async () => {
    vi.mocked(loadMerchantCatalog).mockResolvedValue([merchantProduct()]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    expect(response.headers.get("x-merchant-item-count")).toBe("1");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const generatedAt = Date.parse(response.headers.get("x-merchant-generated-at")!);
    expect(Date.now() - generatedAt).toBeGreaterThanOrEqual(0);
    expect(Date.now() - generatedAt).toBeLessThan(1000);
    expect(await response.text()).toContain("<rss");
    const head = await HEAD();
    expect(head.status).toBe(200);
    expect(head.headers.get("x-merchant-item-count")).toBe("1");
    expect(head.headers.has("x-merchant-generated-at")).toBe(true);
    expect(await head.text()).toBe("");
  });

  it("returns retryable 503 and does not expose upstream errors or an empty feed", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(loadMerchantCatalog).mockRejectedValue(new Error("internal sensitive upstream URL"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("300");
    expect(response.headers.has("x-merchant-generated-at")).toBe(false);
    expect(await response.text()).not.toMatch(/internal|<rss/);
    expect(log).toHaveBeenCalledWith("[google-merchant]", "GMC_SOURCE_UNAVAILABLE");
  });
});
