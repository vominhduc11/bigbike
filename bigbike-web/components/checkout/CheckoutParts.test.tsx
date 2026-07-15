import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CheckoutSummary } from "@/components/checkout/parts/CheckoutSummary";
import { CheckoutConfirmRow, CodPaymentBlock, ZaloSupportBlock } from "@/components/checkout/parts/atoms";
import type { Cart } from "@/lib/contracts/commerce";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = (key: string) => key;
    translate.rich = (key: string) => key;
    return translate;
  },
}));

const cart = {
  id: "cart-1",
  currency: "VND",
  items: [
    {
      id: "item-1",
      productId: "product-1",
      productName: "Mũ bảo hiểm AGV K1S",
      variantName: "Trắng, size L",
      quantity: 1,
      unitPrice: 6100000,
      lineTotal: 6100000,
      available: true,
    },
  ],
  totals: {
    subtotalAmount: 6100000,
    discountAmount: 0,
    shippingAmount: 0,
    totalAmount: 6100000,
  },
} as Cart;

describe("CheckoutSummary", () => {
  it("hiển thị sản phẩm và tổng tiền", () => {
    render(
      <CheckoutSummary
        cart={cart}
        cartSubtotal={6100000}
        grandTotal={6100000}
        submitting={false}
        cartLoading={false}
        contactAddress="Địa chỉ từ cài đặt"
      />,
    );
    expect(screen.getByText("Mũ bảo hiểm AGV K1S")).toBeInTheDocument();
    expect(screen.getAllByText("6.100.000 đ").length).toBeGreaterThan(0);
    expect(screen.getByText("Địa chỉ từ cài đặt")).toBeInTheDocument();
  });

  it("dùng URL và tên hiển thị Zalo từ cài đặt", () => {
    render(<ZaloSupportBlock zaloUrl="0901234567" zaloDisplay="Zalo BigBike" />);
    expect(screen.getByRole("link", { name: /zaloSupportCta/i }))
      .toHaveAttribute("href", "https://zalo.me/0901234567");
    expect(screen.getByText("Zalo BigBike")).toBeInTheDocument();
  });
});

describe("Checkout payment", () => {
  it("hiển thị COD và checkbox xác nhận", () => {
    render(
      <>
        <CodPaymentBlock />
        <CheckoutConfirmRow checked={false} onCheckedChange={vi.fn()} />
      </>,
    );
    expect(screen.getByText("paymentMethod.COD")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });
});
