import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-intl/middleware", () => ({
  default: () => () => {
    throw new Error("Vietnamese internal product routing must bypass locale normalization");
  },
}));

import { clearRedirectCachesForTests, proxy } from "@/proxy";

describe("GMC product landing routing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearRedirectCachesForTests();
  });

  it("rewrites a Vietnamese variant landing internally without redirecting to itself", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
    const response = await proxy(
      new NextRequest("https://bigbike.vn/product/e2e-merchant/?variant=variant-blue"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://bigbike.vn/vi/internal/product/e2e-merchant/?variant=variant-blue",
    );
  });

  it("lets the internal landing reach its page without a second locale redirect", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const response = await proxy(
      new NextRequest("https://bigbike.vn/vi/internal/product/e2e-merchant/?variant=variant-blue"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
