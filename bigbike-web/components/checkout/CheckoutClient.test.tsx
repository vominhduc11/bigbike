import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutClient } from "./CheckoutClient";
import { CONTACT_OPEN_EVENT } from "@/lib/contact/contact-launcher";

const checkout = vi.hoisted(() => ({
  submitting: false,
  handleSubmit: vi.fn(),
  setCustomerNote: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "vi",
  useTranslations: () => Object.assign((key: string) => key, { rich: (key: string) => key }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ initialData }: { initialData: unknown }) => ({ data: initialData }),
}));
vi.mock("@/lib/api/public-api", () => ({ listPublicSettings: vi.fn() }));
vi.mock("./parts/CheckoutAddressFields", () => ({ CheckoutAddressFields: () => null }));
vi.mock("./parts/CheckoutSummary", () => ({ CheckoutSummary: () => null }));
vi.mock("./parts/useCheckout", () => ({
  useCheckout: () => ({
    cart: {
      id: "cart-test",
      status: "ACTIVE",
      currency: "VND",
      items: [
        {
          id: "test-item",
          productId: "product-test",
          productVariantId: null,
          sku: "HELMET-TEST",
          productName: "Mũ thử nghiệm",
          variantName: null,
          quantity: 1,
          unitPrice: 1_500_000,
          lineSubtotal: 1_500_000,
          lineDiscount: 0,
          lineTotal: 1_500_000,
          available: true,
        },
      ],
      totals: {
        subtotalAmount: 1_500_000,
        discountAmount: 0,
        shippingAmount: 0,
        feeAmount: 0,
        totalAmount: 1_500_000,
      },
    },
    cartLoading: false,
    submitting: checkout.submitting,
    handleSubmit: checkout.handleSubmit,
    priceChanges: [],
    customerNote: "Ghi chú khách đang nhập",
    setCustomerNote: checkout.setCustomerNote,
    shipToDifferent: false,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  checkout.submitting = false;
  window.sessionStorage.clear();
  window.gtag = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  window.sessionStorage.clear();
  delete window.gtag;
  vi.unstubAllGlobals();
});

describe("Checkout inline support", () => {
  it("opens contact channels without submitting the order or clearing the form", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    window.addEventListener(CONTACT_OPEN_EVENT, onOpen);
    try {
      render(<CheckoutClient />);
      const help = screen.getByRole("button", { name: "needHelp" });
      expect(help).toHaveAttribute("type", "button");
      expect(help).toHaveAttribute("aria-haspopup", "dialog");
      await user.click(help);
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(onOpen.mock.calls[0][0].detail).toBe(help);
      expect(checkout.handleSubmit).not.toHaveBeenCalled();
      expect(checkout.setCustomerNote).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue("Ghi chú khách đang nhập")).toBeInTheDocument();
    } finally {
      window.removeEventListener(CONTACT_OPEN_EVENT, onOpen);
    }
  });

  it("disables support while the order is being submitted", async () => {
    checkout.submitting = true;
    render(<CheckoutClient />);
    expect(screen.getByRole("button", { name: "needHelp" })).toBeDisabled();
  });

  it("records confirmed COD once and masks checkout customer details from replay", async () => {
    const user = userEvent.setup();
    render(<CheckoutClient />);

    const checkbox = screen.getByRole("checkbox", { name: "confirmNotice" });
    const form = checkbox.closest("form");
    expect(form).toHaveAttribute("data-clarity-mask", "true");

    await user.click(checkbox);
    await user.click(checkbox);
    await user.click(checkbox);

    const paymentEvents = vi
      .mocked(window.gtag!)
      .mock.calls.filter((call) => call[0] === "event" && call[1] === "add_payment_info");
    expect(paymentEvents).toHaveLength(1);
    expect(paymentEvents[0][2]).toMatchObject({
      currency: "VND",
      value: 1_500_000,
      payment_type: "COD",
    });
  });
});
