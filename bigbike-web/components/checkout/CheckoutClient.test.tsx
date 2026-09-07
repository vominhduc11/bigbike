import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutClient } from "./CheckoutClient";
import { CHAT_OPEN_EVENT } from "@/lib/chat/chat-launcher";

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
vi.mock("@/lib/analytics", () => ({ trackAddPaymentInfo: vi.fn() }));
vi.mock("./parts/CheckoutAddressFields", () => ({ CheckoutAddressFields: () => null }));
vi.mock("./parts/CheckoutSummary", () => ({ CheckoutSummary: () => null }));
vi.mock("./parts/useCheckout", () => ({
  useCheckout: () => ({
    cart: { items: [{ id: "test-item" }] },
    cartLoading: false,
    submitting: checkout.submitting,
    handleSubmit: checkout.handleSubmit,
    priceChanges: [],
    customerNote: "Ghi chú khách đang nhập",
    setCustomerNote: checkout.setCustomerNote,
    shipToDifferent: false,
    paymentMethod: "COD",
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  checkout.submitting = false;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("Checkout inline support", () => {
  it("opens the assistant without submitting the order or clearing the form", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    window.addEventListener(CHAT_OPEN_EVENT, onOpen);
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
      window.removeEventListener(CHAT_OPEN_EVENT, onOpen);
    }
  });

  it("disables support while the order is being submitted", async () => {
    checkout.submitting = true;
    render(<CheckoutClient />);
    expect(screen.getByRole("button", { name: "needHelp" })).toBeDisabled();
  });
});
