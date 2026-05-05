import { describe, expectTypeOf, it } from "vitest";
import type { OrderPayment, OrderShippingItem } from "@/lib/contracts/commerce";

describe("order detail commerce contract", () => {
  it("matches backend shipping item field names", () => {
    expectTypeOf<OrderShippingItem>().toEqualTypeOf<{
      id: string
      methodCode: string | null
      methodTitle: string
      amount: number
    }>();
  });

  it("matches backend payment field names", () => {
    expectTypeOf<OrderPayment>().toEqualTypeOf<{
      id: string
      paymentMethod: string
      status: string
      amount: number
      currency: string
      paidAt: string | null
    }>();
  });
});
