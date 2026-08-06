/**
 * Shared base URL for the e2e suite. The storefront under test is the live
 * running instance; override with E2E_BASE_URL when pointing at another env.
 */
export const BASE_URL =
  process.env.E2E_BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "https://bigbike.vn";

export const BASE_ORIGIN = (() => {
  try {
    return new URL(BASE_URL).origin;
  } catch {
    return BASE_URL;
  }
})();
