import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useCheckout } from "@/components/checkout/parts/useCheckout";
import {
  clearCheckoutAttempt,
  prepareCheckoutAttempt,
  readCheckoutAttempt,
  saveCheckoutAttempt,
} from "@/lib/checkout-session";
import type { Cart, CheckoutPayload, OrderSummary } from "@/lib/contracts/commerce";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  trigger: vi.fn(),
  setValue: vi.fn(),
  register: vi.fn(),
  useForm: vi.fn(),
  getFieldState: vi.fn(() => ({ isTouched: false })),
  getAnalyticsClientId: vi.fn(),
  translate: (key: string) => key,
  address: {
    fullName: "Test",
    phone: "0900000001",
    email: "test@example.test",
    country: "VN",
    province: "HCM",
    ward: "Ward",
    addressLine1: "Street",
  },
  cart: {
    id: "cart-1",
    items: [{ id: "item-1" }],
    totals: { subtotalAmount: 100, totalAmount: 100 },
  } as Cart,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("next-intl", () => ({ useLocale: () => "vi", useTranslations: () => mocks.translate }));
vi.mock("react-hook-form", () => ({
  useWatch: () => mocks.address,
  useForm: (options: unknown) => {
    mocks.useForm(options);
    return {
      register: mocks.register,
      trigger: mocks.trigger,
      setValue: mocks.setValue,
      getValues: (field?: keyof typeof mocks.address) =>
        field ? mocks.address[field] : mocks.address,
      getFieldState: mocks.getFieldState,
      formState: { errors: {} },
    };
  },
}));
vi.mock("@/lib/api/client-api", () => ({ submitCheckout: mocks.submit }));
vi.mock("@/lib/auth/auth-store", () => ({
  useAuth: () => ({ status: "anonymous" }),
  hasCustomerSessionHint: () => false,
}));
vi.mock("@/lib/cart-context", () => ({ useCart: () => ({ refreshCount: mocks.refresh }) }));
vi.mock("@/lib/query/hooks", () => ({
  useCartQuery: () => ({ data: mocks.cart }),
  useProfile: () => ({}),
  useAddresses: () => ({}),
}));
vi.mock("@/lib/analytics", () => ({
  trackBeginCheckout: vi.fn(),
  trackAddShippingInfo: vi.fn(),
  getAnalyticsClientId: mocks.getAnalyticsClientId,
}));
vi.mock("@/lib/observability/storefront-error", () => ({ reportStorefrontFailure: vi.fn() }));

const order = {
  id: "order-1",
  orderNumber: "BB-1",
  orderKey: "key",
  paymentMethod: "COD",
  priceChanges: [],
} as unknown as OrderSummary;
const payload = {
  billingAddress: mocks.address,
  locale: "vi",
} as CheckoutPayload;
const submitEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>;
beforeEach(() => {
  vi.clearAllMocks();
  clearCheckoutAttempt();
  localStorage.clear();
  sessionStorage.clear();
  mocks.cart = { ...mocks.cart, id: "cart-1", items: [{ id: "item-1" }] } as Cart;
  mocks.trigger.mockResolvedValue(true);
  mocks.submit.mockResolvedValue(order);
  mocks.getAnalyticsClientId.mockResolvedValue("123456789.987654321");
  mocks.useForm.mockReset();
  mocks.getFieldState.mockReturnValue({ isTouched: false });
});

it("validates both address forms on first blur, then revalidates corrections on change", () => {
  renderHook(() => useCheckout());
  expect(mocks.useForm).toHaveBeenCalledTimes(2);
  for (const [options] of mocks.useForm.mock.calls) {
    expect(options).toMatchObject({ mode: "onTouched", reValidateMode: "onChange" });
  }
});

it("bridges province blur into validation without changing the flat display source", () => {
  const { result } = renderHook(() => useCheckout());

  act(() => result.current.onVnChange("province", "HCM"));
  act(() => result.current.onVnBlur("province"));
  expect(mocks.setValue).toHaveBeenCalledWith("province", "HCM", {
    shouldTouch: true,
    shouldValidate: true,
  });

  act(() => result.current.onVnChangeShip("ward", "Ward"));
  act(() => result.current.onVnBlurShip("ward"));
  expect(mocks.setValue).toHaveBeenCalledWith("ward", "Ward", {
    shouldTouch: true,
    shouldValidate: true,
  });
});

it("locks before asynchronous form validation so repeated clicks submit once", async () => {
  let resolveValidation!: (value: boolean) => void;
  mocks.trigger.mockReturnValue(
    new Promise<boolean>((resolve) => {
      resolveValidation = resolve;
    }),
  );
  const { result } = renderHook(() => useCheckout());
  await act(async () => {
    const first = result.current.handleSubmit(submitEvent);
    const second = result.current.handleSubmit(submitEvent);
    resolveValidation(true);
    await Promise.all([first, second]);
  });
  expect(mocks.submit).toHaveBeenCalledOnce();
  expect(mocks.submit).toHaveBeenCalledWith(
    expect.objectContaining({ analyticsClientId: "123456789.987654321" }),
    expect.any(String),
  );
  expect(mocks.replace).toHaveBeenCalledWith(expect.stringContaining("so=BB-1"));
});

it("recovers a lost response with the stored request and key even after cart conversion", async () => {
  const attempt = prepareCheckoutAttempt("converted-cart", payload);
  mocks.cart = { ...mocks.cart, id: "new-empty-cart", items: [] };
  renderHook(() => useCheckout());
  await waitFor(() => expect(mocks.submit).toHaveBeenCalledExactlyOnceWith(payload, attempt.key));
  await waitFor(() =>
    expect(mocks.replace).toHaveBeenCalledWith(expect.stringContaining("so=BB-1")),
  );
});

it("restores a created order with price changes without another checkout call", async () => {
  const attempt = prepareCheckoutAttempt("cart-1", payload);
  saveCheckoutAttempt({
    ...attempt,
    order: { ...order, priceChanges: [{ productName: "Test", oldPrice: 100, newPrice: 110 }] },
  });
  mocks.cart = { ...mocks.cart, id: "empty-cart", items: [] };
  const { result } = renderHook(() => useCheckout());
  await waitFor(() => expect(result.current.pendingOrderNav?.orderNumber).toBe("BB-1"));
  expect(mocks.submit).not.toHaveBeenCalled();
  act(() => result.current.confirmPendingOrder());
  expect(mocks.replace).toHaveBeenCalledWith(expect.stringContaining("so=BB-1"));
});

it("keeps failed form validation from creating a checkout attempt", async () => {
  mocks.trigger.mockResolvedValue(false);
  const { result } = renderHook(() => useCheckout());
  await act(() => result.current.handleSubmit(submitEvent));
  expect(mocks.submit).not.toHaveBeenCalled();
  expect(readCheckoutAttempt()).toBeNull();
  expect(result.current.submitting).toBe(false);
});
