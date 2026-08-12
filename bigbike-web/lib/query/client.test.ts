import { describe, expect, it, vi } from "vitest";
import { retryDelay, shouldRetryQuery } from "./client";

describe("storefront query retry policy", () => {
  it("does not automatically retry a rate-limit or other client error", () => {
    expect(shouldRetryQuery(0, { status: 429 })).toBe(false);
    expect(shouldRetryQuery(0, { status: 400 })).toBe(false);
  });

  it("uses bounded exponential backoff with jitter for transient server failures", () => {
    expect(shouldRetryQuery(0, { status: 503 })).toBe(true);
    expect(shouldRetryQuery(2, { status: 503 })).toBe(false);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(retryDelay(1)).toBe(2_125);
    vi.restoreAllMocks();
  });
});
