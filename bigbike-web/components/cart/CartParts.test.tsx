import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CartItemRow } from "@/components/cart/parts/CartItemRow";
import { CartSummary } from "@/components/cart/parts/CartSummary";
import type { Cart, CartItem } from "@/lib/contracts/commerce";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "vi",
}));

const item = {
  id: "item-1",
  productId: "product-1",
  productName: "Mũ bảo hiểm AGV K1S",
  quantity: 1,
  unitPrice: 6100000,
  lineTotal: 6100000,
  available: true,
} as CartItem;

describe("CartItemRow", () => {
  it("hiển thị sản phẩm và gọi đúng thao tác số lượng/xóa", () => {
    const onStep = vi.fn();
    const onRemove = vi.fn();
    render(
      <CartItemRow
        item={item}
        draftQuantity={1}
        isMutating={false}
        onStep={onStep}
        onDraft={vi.fn()}
        onBlur={vi.fn()}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText("Mũ bảo hiểm AGV K1S")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "increaseQtyAria" }));
    expect(onStep).toHaveBeenCalledWith("item-1", 1);
    fireEvent.click(screen.getByRole("button", { name: "removeItem" }));
    expect(onRemove).toHaveBeenCalledWith("item-1");
  });
});

describe("CartSummary", () => {
  it("hiển thị tổng tiền và đường dẫn checkout khi tất cả sản phẩm khả dụng", () => {
    const cart = {
      id: "cart-1",
      items: [item],
      currency: "VND",
      totals: {
        subtotalAmount: 6100000,
        discountAmount: 0,
        shippingAmount: 0,
        totalAmount: 6100000,
      },
    } as Cart;
    render(<CartSummary cart={cart} hasUnavailable={false} />);
    expect(screen.getAllByText(/6\.100\.000\sđ/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "checkoutSubmit" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "checkoutSubmit" })[0]).toHaveAttribute("href", "/dat-hang");
  });
});
