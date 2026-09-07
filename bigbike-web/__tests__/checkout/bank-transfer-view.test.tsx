import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderConfirmView } from "@/app/[locale]/(storefront)/don-hang/xac-nhan/OrderConfirmView";
import type { OrderDetail } from "@/lib/contracts/commerce";
import viMessages from "@/messages/vi.json";
import enMessages from "@/messages/en.json";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/layout/StaticPageShell", () => ({
  StaticPageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/i18n/StorefrontLink", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

const order: OrderDetail = {
  id: "order-1",
  orderNumber: "BB-123",
  orderKey: "test-key",
  status: "PENDING",
  paymentMethod: "BANK_TRANSFER",
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
      paymentMethod: "BANK_TRANSFER",
      status: "PENDING",
      amount: 1250000,
      currency: "VND",
      paidAt: null,
    },
  ],
};
const settings = {
  bank_name: "Test Bank",
  bank_account_number: "0012345678",
  bank_account_holder: "Test Shop",
  bank_branch: "Test Branch",
};
function view(props: Partial<React.ComponentProps<typeof OrderConfirmView>> = {}, locale = "vi") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "vi" ? viMessages : enMessages}
      timeZone="Asia/Ho_Chi_Minh"
    >
      <OrderConfirmView
        orderNumber={order.orderNumber}
        orderKey="test-key"
        order={order}
        settingsRecord={settings}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
describe("bank-transfer guidance", () => {
  it.each(["Tiếp tục", "Chuyển khoản sau"])("%s only navigates to the recorded order", (label) => {
    view({ transferStep: true });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Thông tin chuyển khoản");
    expect(screen.getByText("0012345678")).toBeInTheDocument();
    expect(screen.getByText("Test Shop")).toBeInTheDocument();
    expect(screen.getByText("BIGBIKE BB-123")).toBeInTheDocument();
    expect(screen.getByText(/Chờ thanh toán/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(router.replace).toHaveBeenCalledExactlyOnceWith(
      "/don-hang/xac-nhan/?so=BB-123&key=test-key",
    );
    expect(order.payments[0].status).toBe("PENDING");
  });
  it("keeps transfer details on confirmation and excludes COD instructions", () => {
    view();
    expect(screen.getByText("0012345678")).toBeInTheDocument();
    expect(screen.queryByText("Nhận hàng và thanh toán COD")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chuyển khoản sau" })).not.toBeInTheDocument();
  });
  it("COD ignores a transfer-step query and hides payment status", () => {
    view({
      transferStep: true,
      order: {
        ...order,
        paymentMethod: "COD",
        payments: [{ ...order.payments[0], paymentMethod: "COD" }],
      },
    });
    expect(screen.getByText("Nhận hàng và thanh toán COD")).toBeInTheDocument();
    expect(screen.queryByText(/Chờ thanh toán/)).not.toBeInTheDocument();
    expect(screen.queryByText("0012345678")).not.toBeInTheDocument();
  });
  it("preserves BACS reading without a new receipt status", () => {
    view({
      order: {
        ...order,
        paymentMethod: "BACS",
        payments: [{ ...order.payments[0], paymentMethod: "BACS" }],
      },
    });
    expect(screen.getByText("0012345678")).toBeInTheDocument();
    expect(screen.queryByText(/Chờ thanh toán/)).not.toBeInTheDocument();
  });
  it("missing bank name shows support while allowing continuation", () => {
    view({ transferStep: true, settingsRecord: { ...settings, bank_name: "" } });
    expect(screen.getByText(/Thông tin ngân hàng chưa đầy đủ/)).toBeInTheDocument();
    expect(screen.queryByText("0012345678")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
  });
  it("settings failure offers retry without rendering stale account data", () => {
    const retrySettings = vi.fn();
    view({ transferStep: true, settingsError: true, retrySettings });
    expect(screen.queryByText("0012345678")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(retrySettings).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Chuyển khoản sau" })).toBeEnabled();
  });
  it("renders English copy and only shows Paid for a confirmed full receipt", () => {
    view({ order: { ...order, payments: [{ ...order.payments[0], status: "SUCCEEDED" }] } }, "en");
    expect(screen.getByText("Payment: Paid")).toBeInTheDocument();
    expect(screen.queryByText("Receive your order and pay COD")).not.toBeInTheDocument();
  });
  it("does not infer payment success from completion or mismatched amount", () => {
    view({
      order: {
        ...order,
        status: "COMPLETED",
        payments: [{ ...order.payments[0], amount: 1, status: "SUCCEEDED" }],
      },
    });
    expect(screen.getByText(/Cần kiểm tra thông tin thanh toán/)).toBeInTheDocument();
  });
});
