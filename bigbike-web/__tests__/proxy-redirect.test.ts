import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-intl/middleware", () => ({
  default: () => () => new Response(null, { status: 200 }),
}));

import { clearRedirectCachesForTests, proxy } from "../proxy";

function mockRedirect(source: string, target: string) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    if (url.pathname === "/api/internal/redirect" && url.searchParams.get("path") === source) {
      return new Response(JSON.stringify({
        redirectId: "redirect-test",
        target,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (init?.method === "POST") return new Response(null, { status: 204 });
    return new Response(null, { status: 404 });
  });
}

describe("legacy redirect proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearRedirectCachesForTests();
  });

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

  it("maps the old size query pagination to the current catalog in one 301", async () => {
    mockRedirect("/size/xxl", "/sp/?kich-co=XXL");

    const response = await proxy(new NextRequest(
      "https://bigbike.vn/size/xxl/?paged=2",
    ));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://bigbike.vn/sp/?kich-co=XXL&page=2",
    );
  });

  it("serves terminal removals as 410 with an indexing-removal header", async () => {
    const fetchSpy = mockRedirect("/removed-legacy-product", "/");
    fetchSpy.mockImplementation(async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      if (url.pathname === "/api/internal/redirects/active") {
        return new Response(JSON.stringify([{
          id: "gone-test",
          sourcePattern: "/removed-legacy-product",
          targetUrl: "/",
          statusCode: 410,
        }]), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (init?.method === "POST") return new Response(null, { status: 204 });
      return new Response(null, { status: 404 });
    });

    const response = await proxy(new NextRequest("https://bigbike.vn/removed-legacy-product/"));

    expect(response.status).toBe(410);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("normalizes ordinary /vi routes with 301", async () => {
    const response = await proxy(new NextRequest("https://bigbike.vn/vi/gio-hang/?coupon=BB"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://bigbike.vn/gio-hang/?coupon=BB");
  });

  it("resolves a slash-less legacy source in one 301 without a 308 hop first", async () => {
    // sourcePattern lưu không kèm "/" cuối (489 luật legacy dạng này). Nếu proxy
    // chuẩn hoá "/" trước khi tra bảng thì URL tốn 2 hop — phải là 1.
    mockRedirect("/mu-bao-hiem", "/danh-muc/mu-bao-hiem");

    const response = await proxy(new NextRequest("https://bigbike.vn/mu-bao-hiem"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://bigbike.vn/danh-muc/mu-bao-hiem/");
  });

  it("still 308-normalizes a slash-less path that has no redirect rule", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));

    const response = await proxy(new NextRequest("https://bigbike.vn/danh-muc/mu-bao-hiem"));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://bigbike.vn/danh-muc/mu-bao-hiem/");
  });

  it("falls back to 308 instead of looping when a rule only adds the trailing slash", async () => {
    mockRedirect("/tin-tuc", "/tin-tuc/");

    const response = await proxy(new NextRequest("https://bigbike.vn/tin-tuc"));

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://bigbike.vn/tin-tuc/");
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

  it.each([
    ["/legacy-loop-query/", "/legacy-loop-query?campaign=old"],
    ["/legacy-loop-fragment/", "/legacy-loop-fragment#details"],
    ["/legacy-loop-absolute/", "https://bigbike.vn/legacy-loop-absolute/"],
  ])("fails closed instead of serving a direct loop from %s", async (source, target) => {
    const fetchSpy = mockRedirect(source.replace(/\/$/, ""), target);

    const response = await proxy(new NextRequest(`https://bigbike.vn${source}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("fails closed on an off-domain target from legacy data", async () => {
    const fetchSpy = mockRedirect("/legacy-external", "https://evil.example/phishing");

    const response = await proxy(new NextRequest("https://bigbike.vn/legacy-external/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(fetchSpy.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("uses one healthy active snapshot for concurrent requests", async () => {
    let activeCalls = 0;
    let singleCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      if (url.pathname === "/api/internal/redirects/active") {
        activeCalls += 1;
        return new Response(JSON.stringify([{
          id: "bulk-redirect",
          sourcePattern: "/sp/bulk-legacy.html",
          targetUrl: "/product/bulk-target/",
          statusCode: 301,
        }]), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/api/internal/redirect") {
        singleCalls += 1;
        return new Response(null, { status: 404 });
      }
      if (init?.method === "POST") return new Response(null, { status: 204 });
      return new Response(null, { status: 404 });
    });

    const [first, second] = await Promise.all([
      proxy(new NextRequest("https://bigbike.vn/sp/bulk-legacy.html")),
      proxy(new NextRequest("https://bigbike.vn/sp/bulk-legacy.html")),
    ]);

    expect({ first: first.status, second: second.status, activeCalls, singleCalls }).toEqual({
      first: 301,
      second: 301,
      activeCalls: 1,
      singleCalls: 0,
    });
  });

  it("does not make a transient snapshot failure sticky", async () => {
    let activeCalls = 0;
    let singleCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      if (url.pathname === "/api/internal/redirects/active") {
        activeCalls += 1;
        if (activeCalls === 1) return new Response(null, { status: 503 });
        return new Response(JSON.stringify([{
          id: "recovered-redirect",
          sourcePattern: "/sp/recovered-legacy.html",
          targetUrl: "/product/recovered-target/",
          statusCode: 301,
        }]), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/api/internal/redirect") {
        singleCalls += 1;
        return new Response(null, { status: 503 });
      }
      if (init?.method === "POST") return new Response(null, { status: 204 });
      return new Response(null, { status: 404 });
    });

    const first = await proxy(new NextRequest("https://bigbike.vn/sp/recovered-legacy.html"));
    const second = await proxy(new NextRequest("https://bigbike.vn/sp/recovered-legacy.html"));

    expect({ first: first.status, second: second.status, activeCalls, singleCalls }).toEqual({
      first: 200,
      second: 301,
      activeCalls: 2,
      singleCalls: 1,
    });
  });

  it("clears both the snapshot and positive L1 entries", async () => {
    let activeCalls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      if (url.pathname === "/api/internal/redirects/active") {
        activeCalls += 1;
        return new Response(JSON.stringify([{
          id: "clear-redirect",
          sourcePattern: "/sp/clear-legacy.html",
          targetUrl: "/product/clear-target/",
          statusCode: 301,
        }]), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (init?.method === "POST") return new Response(null, { status: 204 });
      return new Response(null, { status: 404 });
    });

    await proxy(new NextRequest("https://bigbike.vn/sp/clear-legacy.html"));
    clearRedirectCachesForTests();
    await proxy(new NextRequest("https://bigbike.vn/sp/clear-legacy.html"));

    expect(activeCalls).toBe(2);
  });
});
