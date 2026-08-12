// @vitest-environment node
import { describe, expect, it } from "vitest";
import { backendRequestHeaders, passthroughBackendError } from "./backend-proxy";

describe("backend BFF rate-limit forwarding", () => {
  it("forwards one canonical client address and request id", () => {
    const request = new Request("https://bigbike.vn/api/search-suggest?q=mt", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
        "x-request-id": "edge-request-123",
      },
    });

    const headers = backendRequestHeaders(request);
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.10");
    expect(headers.get("x-request-id")).toBe("edge-request-123");
  });

  it("does not forward a client-controlled forwarding chain", () => {
    const request = new Request("https://bigbike.vn/api/search-suggest?q=mt", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });

    expect(backendRequestHeaders(request).get("x-forwarded-for")).toBeNull();
  });

  it("preserves backend 429 body and Retry-After", async () => {
    const upstream = new Response(JSON.stringify({
      error: { code: "RATE_LIMIT_EXCEEDED", message: "Quá nhiều yêu cầu." },
      meta: { requestId: "backend-request", timestamp: "2026-08-12T00:00:00Z" },
    }), {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": "12",
        "cache-control": "no-store",
      },
    });

    const response = await passthroughBackendError(upstream);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ error: { code: "RATE_LIMIT_EXCEEDED" } });
  });
});
