import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCheckoutAttempt,
  prepareCheckoutAttempt,
  readCheckoutAttempt,
  saveCheckoutAttempt,
} from "@/lib/checkout-session";
import { toCheckoutResultPath } from "@/lib/utils/routes";
import type { CheckoutPayload, OrderSummary } from "@/lib/contracts/commerce";

const payload = {
  paymentMethod: "BANK_TRANSFER",
  billingAddress: { fullName: "Test" },
} as CheckoutPayload;
beforeEach(() => {
  clearCheckoutAttempt();
  sessionStorage.clear();
});
describe("checkout attempt recovery", () => {
  it("reuses the original key and payload after a lost response", () => {
    const first = prepareCheckoutAttempt("cart-1", payload);
    const second = prepareCheckoutAttempt("cart-1", { ...payload, paymentMethod: "COD" });
    expect(second).toEqual(first);
    expect(readCheckoutAttempt()).toEqual(first);
  });
  it("retains the created order and price changes until that order is opened", () => {
    const attempt = prepareCheckoutAttempt("cart-1", payload);
    const order = {
      orderNumber: "BB-1",
      orderKey: "key",
      paymentMethod: "BANK_TRANSFER",
      priceChanges: [{ productName: "Test", oldPrice: 1, newPrice: 2 }],
    } as OrderSummary;
    saveCheckoutAttempt({ ...attempt, order });
    clearCheckoutAttempt("different-order");
    expect(readCheckoutAttempt()?.order).toEqual(order);
    clearCheckoutAttempt("BB-1");
    expect(readCheckoutAttempt()).toBeNull();
  });
  it("starts a fresh key for a different cart", () => {
    const first = prepareCheckoutAttempt("cart-1", payload);
    expect(prepareCheckoutAttempt("cart-2", payload).key).not.toBe(first.key);
  });
  it("survives unavailable browser storage", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const first = prepareCheckoutAttempt("cart-1", payload);
    expect(readCheckoutAttempt()).toEqual(first);
    get.mockRestore();
    set.mockRestore();
  });
  it("routes COD directly and BANK_TRANSFER through the transfer step", () => {
    const order = { orderNumber: "BB-1", orderKey: "key", paymentMethod: "COD" };
    expect(toCheckoutResultPath(order, "vi")).not.toContain("step=");
    expect(toCheckoutResultPath({ ...order, paymentMethod: "BANK_TRANSFER" }, "en")).toContain(
      "step=bank-transfer",
    );
  });
});
