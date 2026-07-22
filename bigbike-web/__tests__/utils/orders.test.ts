import { describe, expect, it } from "vitest";
import { isCustomerCancellable, orderFilterHref, resolveBankTransfer } from "@/lib/utils/orders";

describe("isCustomerCancellable", () => {
  it("allows PENDING and PROCESSING", () => {
    expect(isCustomerCancellable({ status: "PENDING" })).toBe(true);
    expect(isCustomerCancellable({ status: "PROCESSING" })).toBe(true);
  });

  it("blocks SHIPPING and terminal statuses", () => {
    expect(isCustomerCancellable({ status: "SHIPPING" })).toBe(false);
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

describe("resolveBankTransfer", () => {
  const full = new Map<string, string>([
    ["bank_account_holder", " Nguyen Van A "],
    ["bank_account_number", "0123456789"],
    ["bank_name", "Vietcombank"],
    ["bank_branch", "HCM"],
  ]);

  it("returns null for non-BACS payment methods", () => {
    expect(resolveBankTransfer("COD", full)).toBeNull();
    expect(resolveBankTransfer("BANK_TRANSFER", full)).toBeNull();
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
