import { describe, expect, it } from "vitest";
import { isCustomerCancellable, orderFilterHref } from "@/lib/utils/orders";

describe("isCustomerCancellable", () => {
  it("allows PENDING and PROCESSING", () => {
    expect(isCustomerCancellable({ status: "PENDING" })).toBe(true);
    expect(isCustomerCancellable({ status: "PROCESSING" })).toBe(true);
  });

  it("blocks terminal statuses", () => {
    for (const status of ["COMPLETED", "CANCELLED"]) {
      expect(isCustomerCancellable({ status })).toBe(false);
    }
  });
});

describe("orderFilterHref", () => {
  const base = "/tai-khoan/don-hang/";

  it("returns the base path for the 'all' filter (no status)", () => {
    expect(orderFilterHref(base)).toBe(base);
    expect(orderFilterHref(base, undefined)).toBe(base);
  });

  it("appends the status query when a status is given", () => {
    expect(orderFilterHref(base, "PENDING")).toBe(`${base}?status=PENDING`);
    expect(orderFilterHref(base, "COMPLETED")).toBe(`${base}?status=COMPLETED`);
  });
});
