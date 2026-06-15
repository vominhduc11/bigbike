import { describe, expect, it } from "vitest";
import { isCustomerCancellable, orderFilterHref, resolveBankTransfer } from "@/lib/utils/orders";

describe("isCustomerCancellable", () => {
  it("allows UNPAID PENDING / ON_HOLD", () => {
    expect(isCustomerCancellable({ status: "PENDING", paymentStatus: "UNPAID", fulfillmentStatus: "UNFULFILLED" })).toBe(true);
    expect(isCustomerCancellable({ status: "ON_HOLD", paymentStatus: "UNPAID", fulfillmentStatus: "UNFULFILLED" })).toBe(true);
  });

  it("allows UNPAID PROCESSING when goods have not shipped/delivered", () => {
    expect(isCustomerCancellable({ status: "PROCESSING", paymentStatus: "UNPAID", fulfillmentStatus: "UNFULFILLED" })).toBe(true);
    expect(isCustomerCancellable({ status: "PROCESSING", paymentStatus: "UNPAID", fulfillmentStatus: "PROCESSING" })).toBe(true);
  });

  it("blocks PROCESSING once shipped or delivered", () => {
    expect(isCustomerCancellable({ status: "PROCESSING", paymentStatus: "UNPAID", fulfillmentStatus: "SHIPPED" })).toBe(false);
    expect(isCustomerCancellable({ status: "PROCESSING", paymentStatus: "UNPAID", fulfillmentStatus: "DELIVERED" })).toBe(false);
  });

  it("blocks any order once payment is collected (must go through refund)", () => {
    expect(isCustomerCancellable({ status: "PENDING", paymentStatus: "PAID", fulfillmentStatus: "UNFULFILLED" })).toBe(false);
    expect(isCustomerCancellable({ status: "PROCESSING", paymentStatus: "PAID", fulfillmentStatus: "PROCESSING" })).toBe(false);
    expect(isCustomerCancellable({ status: "ON_HOLD", paymentStatus: "REFUNDED", fulfillmentStatus: "UNFULFILLED" })).toBe(false);
  });

  it("blocks terminal / non-cancellable statuses", () => {
    for (const status of ["COMPLETED", "CANCELLED", "REFUNDED", "FAILED"]) {
      expect(isCustomerCancellable({ status, paymentStatus: "UNPAID", fulfillmentStatus: "UNFULFILLED" })).toBe(false);
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

describe("resolveBankTransfer", () => {
  const full = new Map<string, string>([
    ["bank_account_holder", " Nguyen Van A "],
    ["bank_account_number", "0123456789"],
    ["bank_name", "Vietcombank"],
    ["bank_branch", "HCM"],
  ]);

  it("returns null for non-BACS payment methods", () => {
    expect(resolveBankTransfer("COD", full)).toBeNull();
    expect(resolveBankTransfer("", full)).toBeNull();
    expect(resolveBankTransfer(null, full)).toBeNull();
    expect(resolveBankTransfer(undefined, full)).toBeNull();
  });

  it("resolves a configured account (BACS is case-insensitive, values trimmed)", () => {
    const r = resolveBankTransfer("bacs", full);
    expect(r).not.toBeNull();
    expect(r?.configured).toBe(true);
    expect(r?.holder).toBe("Nguyen Van A");
    expect(r?.number).toBe("0123456789");
    expect(r?.bankName).toBe("Vietcombank");
    expect(r?.branch).toBe("HCM");
  });

  it("is not configured until both holder and number are filled in", () => {
    expect(resolveBankTransfer("BACS", new Map())?.configured).toBe(false);
    expect(resolveBankTransfer("BACS", new Map([["bank_account_holder", "A"]]))?.configured).toBe(false);
    expect(resolveBankTransfer("BACS", new Map([["bank_account_number", "1"]]))?.configured).toBe(false);
  });
});
