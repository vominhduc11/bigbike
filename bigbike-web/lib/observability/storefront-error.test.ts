import { describe, expect, it } from "vitest";
import { isReportableStorefrontFailure } from "./storefront-error";
import { sanitizeStorefrontPath, scrubSentryEvent } from "./sentry-privacy";

describe("storefront error reporting privacy", () => {
  it("keeps only a route path and removes customer-bearing event fields", () => {
    expect(sanitizeStorefrontPath("https://shop.test/checkout?email=a%40b.test&orderKey=secret")).toBe("/checkout");
    expect(scrubSentryEvent({
      user: { email: "customer@example.test" },
      request: { data: { password: "secret" } },
      extra: { phone: "0900000000" },
      breadcrumbs: [{ message: "chat message" }],
      exception: { values: [{ value: "password=secret", stacktrace: { frames: [] } }] },
      tags: { "storefront.route": "/checkout" },
    })).toEqual({
      user: undefined,
      request: undefined,
      extra: undefined,
      breadcrumbs: [],
      exception: { values: [{ type: "StorefrontError", value: "Storefront error" }] },
      fingerprint: undefined,
      tags: { "storefront.route": "/checkout" },
    });
  });

  it("reports only technical or server failures", () => {
    expect(isReportableStorefrontFailure({ status: 400 })).toBe(false);
    expect(isReportableStorefrontFailure({ status: 401 })).toBe(false);
    expect(isReportableStorefrontFailure({ status: 404 })).toBe(false);
    expect(isReportableStorefrontFailure({ status: 429 })).toBe(false);
    expect(isReportableStorefrontFailure({ status: 500 })).toBe(true);
    expect(isReportableStorefrontFailure(new Error("network unavailable"))).toBe(true);
  });
});
