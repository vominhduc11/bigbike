import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, loginCustomer } from "@/lib/api/client-api";

describe("customer authentication client errors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves Retry-After on a rate-limited sign-in response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "RATE_LIMIT_EXCEEDED" } }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "60" },
      }),
    );

    await expect(loginCustomer("customer@example.com", "incorrect-password")).rejects.toMatchObject(
      new ApiClientError(429, "RATE_LIMIT_EXCEEDED", undefined, 60),
    );
  });
});
