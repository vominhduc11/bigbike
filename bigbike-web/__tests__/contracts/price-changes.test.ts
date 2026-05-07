import { describe, expectTypeOf, it } from "vitest";
import type { OrderSummary, PriceChange } from "@/lib/contracts/commerce";

describe("PriceChange contract (Phase 1 fix)", () => {
  it("PriceChange has the three required fields matching backend OrderSummaryResponse.PriceChange", () => {
    expectTypeOf<PriceChange>().toEqualTypeOf<{
      productName: string;
      oldPrice: number;
      newPrice: number;
    }>();
  });

  it("OrderSummary.priceChanges is optional (absent when no price changes occurred)", () => {
    expectTypeOf<OrderSummary["priceChanges"]>().toEqualTypeOf<
      PriceChange[] | undefined
    >();
  });

  it("OrderSummary still has all base fields", () => {
    expectTypeOf<OrderSummary>().toHaveProperty("id");
    expectTypeOf<OrderSummary>().toHaveProperty("orderNumber");
    expectTypeOf<OrderSummary>().toHaveProperty("totalAmount");
    expectTypeOf<OrderSummary>().toHaveProperty("currency");
  });
});
