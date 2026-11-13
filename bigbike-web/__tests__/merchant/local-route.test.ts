// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, HEAD } from "@/app/google-local-inventory.tsv/route";
import { loadMerchantCatalog } from "@/lib/merchant/catalog";
import { merchantProduct } from "./fixtures";
const config = vi.hoisted(() => ({ GMC_STORE_CODE: "E2E_STORE" }));
vi.mock("@/env", () => ({ env: config }));
vi.mock("@/lib/merchant/catalog", () => ({ loadMerchantCatalog: vi.fn() }));
afterEach(() => {
  config.GMC_STORE_CODE = "E2E_STORE";
  vi.restoreAllMocks();
});
describe("TSV HTTP contract", () => {
  it("serves fresh TSV and bodyless HEAD", async () => {
    vi.mocked(loadMerchantCatalog).mockResolvedValue([merchantProduct()]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/tab-separated-values; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-merchant-item-count")).toBe("1");
    expect(res.headers.has("x-merchant-generated-at")).toBe(true);
    expect(await res.text()).toContain("E2E_STORE\t");
    expect(await (await HEAD()).text()).toBe("");
  });
  it("returns retryable 503 without leaking source details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(loadMerchantCatalog).mockRejectedValue(new Error("private upstream"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("300");
    expect(await res.text()).not.toContain("private");
    config.GMC_STORE_CODE = "";
    expect((await GET()).status).toBe(503);
  });
});
