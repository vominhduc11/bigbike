import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next-intl/middleware", () => ({
  default: () => () => {
    throw new Error("Alias must not be localized away");
  },
}));
import { proxy } from "@/proxy";
afterEach(() => vi.restoreAllMocks());
const query = "?utm_source=qr&utm_medium=offline&utm_campaign=qr-danh-gia";
describe("reserved Google review routes", () => {
  it.each([
    ["/danh-gia", "vi"],
    ["/review", "en"],
    ["/en/review", "en"],
  ])("%s renders before the redirect registry", async (path, locale) => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const response = await proxy(new NextRequest(`https://bigbike.vn${path}/${query}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      `https://bigbike.vn/${locale}/internal/google-review/${query}`,
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["/danh-gia", "/review", "/en/review"])(
    "%s slashless preserves alias and UTM",
    async (path) => {
      const response = await proxy(new NextRequest(`https://bigbike.vn${path}${query}`));
      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(`https://bigbike.vn${path}/${query}`);
    },
  );
});
