import { StrictMode } from "react";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PurchaseEvent } from "@/components/analytics/PurchaseEvent";
import type { OrderDetail } from "@/lib/contracts/commerce";

const order = {
  id: "analytics-order-1",
  orderNumber: "ANALYTICS-ORDER-1",
  currency: "VND",
  totalAmount: 1100000,
  shippingAmount: 0,
  taxAmount: 0,
  lineItems: [
    {
      id: "line-1",
      sku: "E2E_GMC_BLUE_M",
      productName: "Áo bảo hộ",
      variantName: "Xanh / M",
      brandName: "Thương hiệu kiểm thử",
      categoryName: "Áo bảo hộ",
      unitPrice: 1100000,
      quantity: 1,
    },
  ],
} as OrderDetail;

beforeEach(() => {
  window.sessionStorage.clear();
  window.gtag = vi.fn();
});

afterEach(() => {
  window.sessionStorage.clear();
  delete window.gtag;
});

it("reports one purchase across StrictMode, order polling and three same-tab page remounts", () => {
  const page = render(
    <StrictMode>
      <PurchaseEvent order={order} />
    </StrictMode>,
  );
  page.rerender(
    <StrictMode>
      <PurchaseEvent order={{ ...order, status: "PROCESSING" }} />
    </StrictMode>,
  );
  page.unmount();
  for (let refresh = 0; refresh < 3; refresh++) {
    render(<PurchaseEvent order={{ ...order }} />).unmount();
  }
  expect(window.gtag).toHaveBeenCalledTimes(1);
  expect(window.gtag).toHaveBeenCalledWith(
    "event",
    "purchase",
    expect.objectContaining({
      transaction_id: order.orderNumber,
      items: [
        expect.objectContaining({
          item_id: "E2E_GMC_BLUE_M",
          item_variant: "Xanh / M",
          item_category: "Áo bảo hộ",
        }),
      ],
    }),
  );
  render(
    <PurchaseEvent
      order={{ ...order, id: "analytics-order-2", orderNumber: "ANALYTICS-ORDER-2" }}
    />,
  );
  expect(window.gtag).toHaveBeenCalledTimes(2);
});
