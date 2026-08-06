import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-intl/middleware", () => ({
  default: () => () => new Response(null, { status: 200 }),
}));

import { proxy } from "../proxy";

function mockRedirect(source: string, target: string) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    if (url.pathname === "/api/internal/redirect" && url.searchParams.get("path") === source) {
      return new Response(JSON.stringify({
        redirectId: "redirect-test",
        target,
        statusCode: 301,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (init?.method === "POST") return new Response(null, { status: 204 });
    return new Response(null, { status: 404 });
  });
}

describe("legacy redirect proxy", () => {
  afterEach(() => vi.restoreAllMocks());

  it("resolves /vi .html aliases in one 301 and preserves the query", async () => {
    mockRedirect("/sp/legacy-product.html", "/product/canonical-product/");

    const response = await proxy(new NextRequest(
      "https://bigbike.vn/vi/sp/legacy-product.html?utm_source=legacy",
    ));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://bigbike.vn/product/canonical-product/?utm_source=legacy",
    );
  });

  it("keeps English locale while resolving a legacy .html alias", async () => {
    mockRedirect("/sp/legacy-product-en.html", "/product/canonical-product/");

    const response = await proxy(new NextRequest(
      "https://bigbike.vn/en/sp/legacy-product-en.html?ref=old",
    ));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://bigbike.vn/en/product/canonical-product/?ref=old",
    );
  });

  it("normalizes ordinary /vi routes with 301", async () => {
    const response = await proxy(new NextRequest("https://bigbike.vn/vi/gio-hang/?coupon=BB"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://bigbike.vn/gio-hang/?coupon=BB");
  });

  it.each([
    ["/en/news/legacy-article/?ref=old", "/en/tin-tuc/legacy-article/?ref=old"],
    ["/en/products/legacy-product/?ref=old", "/en/product/legacy-product/?ref=old"],
  ])("normalizes the former English detail route %s in one 301", async (source, target) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

    const response = await proxy(new NextRequest(`https://bigbike.vn${source}`));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(`https://bigbike.vn${target}`);
  });
});
