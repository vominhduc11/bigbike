import type { CheckoutPayload, OrderSummary } from "@/lib/contracts/commerce";
import { generateId } from "@/lib/utils";

const KEY = "bigbike:checkout:attempt:v1";
export type CheckoutAttempt = {
  cartId: string;
  key: string;
  payload: CheckoutPayload;
  order?: OrderSummary;
};
let memory: CheckoutAttempt | null = null;

export function readCheckoutAttempt(): CheckoutAttempt | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return memory;
    const value = JSON.parse(raw) as CheckoutAttempt;
    return value.cartId && value.key && value.payload ? value : null;
  } catch {
    return memory;
  }
}

export function saveCheckoutAttempt(attempt: CheckoutAttempt): void {
  memory = attempt;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(attempt));
  } catch {
    /* storage unavailable */
  }
}

export function clearCheckoutAttempt(orderNumber?: string): void {
  if (orderNumber && readCheckoutAttempt()?.order?.orderNumber !== orderNumber) return;
  memory = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export function prepareCheckoutAttempt(cartId: string, payload: CheckoutPayload): CheckoutAttempt {
  const existing = readCheckoutAttempt();
  // An uncertain request must be replayed verbatim, even if the form was edited.
  if (existing && existing.cartId === cartId) return existing;
  const attempt = { cartId, key: generateId(), payload };
  saveCheckoutAttempt(attempt);
  return attempt;
}
