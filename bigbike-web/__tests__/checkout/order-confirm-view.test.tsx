import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderConfirmView } from "@/app/[locale]/(storefront)/don-hang/xac-nhan/OrderConfirmView";
import type { OrderDetail } from "@/lib/contracts/commerce";
import viMessages from "@/messages/vi.json";
import enMessages from "@/messages/en.json";

const order: OrderDetail = {
  id: "order-1",
  orderNumber: "BB-123",
  orderKey: "test-key",
  status: "PENDING",
  paymentMethod: "COD",
  currency: "VND",
  totalAmount: 1250000,
  subtotalAmount: 1250000,
  shippingAmount: 0,
  discountAmount: 0,
  feeAmount: 0,
  taxAmount: 0,
  paidAmount: 0,
  placedAt: "2026-09-07T00:00:00Z",
  customerEmail: null,
  customerPhone: null,
  customerNote: null,
  lineItems: [],
  addresses: [],
  shippingItems: [],
  notes: [],
  payments: [
    {
      id: "payment-1",
      paymentMethod: "COD",
      status: "PENDING",
      amount: 1250000,
      currency: "VND",
      paidAt: null,
    },
  ],
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/layout/StaticPageShell", () => ({
  StaticPageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/i18n/StorefrontLink", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

function view(overrides: Partial<OrderDetail> = {}, locale: "vi" | "en" = "vi") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "vi" ? viMessages : enMessages}
      timeZone="Asia/Ho_Chi_Minh"
    >
      <OrderConfirmView
        orderNumber="BB-123"
        orderKey="test-key"
        order={{ ...order, ...overrides }}
        settingsRecord={{}}
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("COD-only order confirmation", () => {
  it("shows the COD next step and no transfer guidance or action", () => {
    view();
    expect(screen.getByText("Nhận hàng và thanh toán COD")).toBeInTheDocument();
    expect(screen.queryByText(/chuyển khoản/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /chuyển khoản/i })).not.toBeInTheDocument();
  });

  it.each([
    ["BANK_TRANSFER", "Chuyển khoản ngân hàng"],
    ["BACS", "Chuyển khoản ngân hàng"],
    ["CHECK", "Séc"],
    ["CARD", "Thẻ ngân hàng"],
  ])("keeps the historical %s method readable without transfer controls", (method, label) => {
    view({
      paymentMethod: method,
      payments: [{ ...order.payments[0], paymentMethod: method }],
    });
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /chuyển khoản/i })).not.toBeInTheDocument();
  });

  it("keeps the same history labels in English", () => {
    view(
      { paymentMethod: "CARD", payments: [{ ...order.payments[0], paymentMethod: "CARD" }] },
      "en",
    );
    expect(screen.getByText("Bank card")).toBeInTheDocument();
  });
});
