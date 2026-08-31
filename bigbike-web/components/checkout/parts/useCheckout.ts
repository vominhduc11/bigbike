"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateId } from "@/lib/utils";
import { submitCheckout } from "@/lib/api/client-api";
import { hasCustomerSessionHint, useAuth } from "@/lib/auth/auth-store";
import { useCart } from "@/lib/cart-context";
import { useAddresses, useCartQuery, useProfile } from "@/lib/query/hooks";
import type { PriceChange } from "@/lib/contracts/commerce";
import {
  createCheckoutAddressSchema,
  type CheckoutAddressFormValues,
} from "@/lib/schemas/checkout";
import { pushDataLayer, toGtmCartItems } from "@/lib/analytics";
import { toOrderConfirmPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import type { CheckoutPaymentMethod } from "./atoms";
import { pickDefaultAddress } from "./helpers";
import { reportStorefrontFailure } from "@/lib/observability/storefront-error";

type VnAddress = { province: string; ward: string };
const EMPTY_VN_ADDRESS: VnAddress = { province: "", ward: "" };
const EMPTY_CHECKOUT_ADDRESS: CheckoutAddressFormValues = {
  fullName: "",
  phone: "",
  email: "",
  country: "VN",
  province: "",
  ward: "",
  addressLine1: "",
};

const CHECKOUT_DRAFT_KEY = "bigbike:checkout:draft:v1";

type CheckoutDraft = {
  cartId: string | number | null;
  billingAddress: CheckoutAddressFormValues;
  shippingAddress: CheckoutAddressFormValues;
  customerNote: string;
  shipToDifferent: boolean;
  paymentMethod: CheckoutPaymentMethod;
};

function readCheckoutDraft(): CheckoutDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutDraft & { savedAt?: number };
    if (!parsed.savedAt || Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(CHECKOUT_DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveCheckoutDraft(draft: CheckoutDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CHECKOUT_DRAFT_KEY,
      JSON.stringify({ ...draft, savedAt: Date.now() }),
    );
  } catch {
    // Trình duyệt có thể chặn storage; form vẫn hoạt động bình thường.
  }
}

function clearCheckoutDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CHECKOUT_DRAFT_KEY);
  } catch {
    /* storage may be blocked */
  }
}

/**
 * Toàn bộ state + logic nghiệp vụ của trang Thanh toán: 2 form địa chỉ (billing +
 * giao tới địa chỉ khác) react-hook-form/zod, prefill từ profile/address,
 * GTM begin_checkout, price-change và đặt đơn (idempotency key). Đơn online không
 * tính phí vận chuyển. Tách khỏi JSX để file component chỉ còn markup.
 */
export function useCheckout() {
  const t = useTranslations("Checkout");
  const tValidation = useTranslations("Checkout.validation");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { refreshCount } = useCart();
  const auth = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [pendingOrderNav, setPendingOrderNav] = useState<{
    orderNumber: string;
    orderKey: string;
  } | null>(null);
  const gtmCartId = useRef<string | null>(null);
  const [customerNote, setCustomerNote] = useState("");
  const [shipToDifferent, setShipToDifferent] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("COD");
  const idempotencyKey = useRef<string>(generateId());
  const [draftReady, setDraftReady] = useState(false);

  // Tỉnh/Phường KHÔNG sống trong react-hook-form như 4 ô còn lại (Họ tên/SĐT/Email/
  // Địa chỉ) — dùng state phẳng làm nguồn sự thật cho UI + payload gửi đi, chỉ đồng
  // bộ vào react-hook-form ngay trước khi validate (trigger()) trong placeOrder() để
  // vẫn tận dụng được thông báo lỗi zod có sẵn. Lý do xem comment ở effect prefill
  // bên dưới.
  const [vnAddress, setVnAddress] = useState<VnAddress>(EMPTY_VN_ADDRESS);
  const [vnShip, setVnShip] = useState<VnAddress>(EMPTY_VN_ADDRESS);

  function onVnChange(field: "province" | "ward", value: string) {
    setVnAddress((prev) =>
      field === "province" ? { province: value, ward: "" } : { ...prev, ward: value },
    );
  }

  function onVnChangeShip(field: "province" | "ward", value: string) {
    setVnShip((prev) =>
      field === "province" ? { province: value, ward: "" } : { ...prev, ward: value },
    );
  }

  const { data: cart, isLoading: cartLoading, error: cartError } = useCartQuery();
  const shouldLoadCustomer =
    auth.status === "authenticated" || (auth.status === "loading" && hasCustomerSessionHint());
  const { data: profile } = useProfile({ enabled: shouldLoadCustomer });
  const { data: addresses } = useAddresses({ enabled: shouldLoadCustomer });

  const billingResolver = useMemo(
    () => zodResolver(createCheckoutAddressSchema(tValidation, true)),
    [tValidation],
  );
  const {
    register,
    trigger,
    control,
    setValue,
    getValues,
    formState: { errors: addressErrors },
  } = useForm<CheckoutAddressFormValues>({
    resolver: billingResolver,
    defaultValues: EMPTY_CHECKOUT_ADDRESS,
  });

  // useWatch chỉ còn dùng cho 4 ô register()-based (fullName/phone/email/
  // addressLine1) — Tỉnh/Phường lấy từ vnAddress/vnShip ở trên.
  const formAddress = useWatch({ control });

  // Form địa chỉ giao riêng — chỉ dùng khi khách chọn "giao tới địa chỉ khác".
  // Backend không validate shippingAddress (chỉ billing), nên ràng buộc nằm ở zod đây.
  const shipResolver = useMemo(
    () => zodResolver(createCheckoutAddressSchema(tValidation)),
    [tValidation],
  );
  const {
    register: registerShip,
    trigger: triggerShip,
    control: controlShip,
    setValue: setValueShip,
    getValues: getValuesShip,
    formState: { errors: shipErrors },
  } = useForm<CheckoutAddressFormValues>({
    resolver: shipResolver,
    defaultValues: EMPTY_CHECKOUT_ADDRESS,
  });

  const formShippingAddress = useWatch({ control: controlShip });

  useEffect(() => {
    if (!cart || gtmCartId.current === cart.id) return;
    pushDataLayer("begin_checkout", {
      currency: cart.currency ?? "VND",
      value: cart.totals.totalAmount,
      items: toGtmCartItems(cart.items),
    });
    gtmCartId.current = cart.id;
  }, [cart]);

  // Không dùng "chạy một lần" (useRef khoá) — nếu request profile/addresses tới
  // chậm hơn lần mount trước, hoặc trang được giữ lại (không remount) khi khách rời
  // rồi quay lại Đặt hàng, khoá một-lần sẽ chặn vĩnh viễn việc set lại các ô. Điền
  // mỗi khi ô đang trống thay vì khoá theo mount, để không phụ thuộc vào việc
  // component có bị Next.js giữ lại hay không — đồng thời không ghi đè giá trị
  // khách đã tự gõ/chọn.
  //
  // setTimeout(0) là bắt buộc, không phải tối ưu: Next.js App Router bọc điều hướng
  // trong startTransition của React. Nếu set state ngay trong effect (đã thử cả
  // setValue() thô, Controller, flushSync — flushSync ép commit đồng bộ nhưng KHÔNG
  // tách state ra khỏi transition bao quanh), giá trị lên đúng 1 nhịp render rồi
  // bị "cuốn" theo khi transition được React xử lý lại và mất — tái hiện được ổn định
  // 100% khi khách rời trang Đặt hàng rồi quay lại bằng link trong app (không reload).
  // Đẩy sang setTimeout(0) đưa việc set state ra khỏi phạm vi transition đó, không
  // còn bị cuốn theo nữa. Xác minh bằng test tự động lặp lại 5 lần liên tiếp.
  useEffect(() => {
    if (!profile) return;
    if (addresses === undefined) return;

    const current = getValues();
    const addr = pickDefaultAddress(addresses);
    const timer = setTimeout(() => {
      if (addr) {
        if (!current.fullName) setValue("fullName", addr.fullName ?? profile.displayName ?? "");
        if (!current.phone) setValue("phone", addr.phone ?? profile.phone ?? "");
        if (!current.email) setValue("email", addr.email ?? profile.email ?? "");
        if (!current.addressLine1) setValue("addressLine1", addr.addressLine1 ?? "");
        setVnAddress((prev) => ({
          province: prev.province || (addr.province ?? ""),
          ward: prev.ward || (addr.ward ?? ""),
        }));
      } else {
        if (!current.fullName && profile.displayName) setValue("fullName", profile.displayName);
        if (!current.phone && profile.phone) setValue("phone", profile.phone);
        if (!current.email && profile.email) setValue("email", profile.email);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [profile, addresses, setValue, getValues]);

  // Giữ bản nháp form checkout trong trình duyệt để khách không mất thông tin
  // khi backend/nginx tạm ngắt. Không lưu mật khẩu, token hoặc dữ liệu thanh toán.
  useEffect(() => {
    if (!cart || draftReady) return;
    const draft = readCheckoutDraft();
    if (draft && (!draft.cartId || String(draft.cartId) === String(cart.id))) {
      const timer = setTimeout(() => {
        const billing = draft.billingAddress ?? EMPTY_CHECKOUT_ADDRESS;
        const shipping = draft.shippingAddress ?? EMPTY_CHECKOUT_ADDRESS;
        setValue("fullName", billing.fullName ?? "");
        setValue("phone", billing.phone ?? "");
        setValue("email", billing.email ?? "");
        setValue("addressLine1", billing.addressLine1 ?? "");
        setVnAddress({ province: billing.province ?? "", ward: billing.ward ?? "" });
        setValueShip("fullName", shipping.fullName ?? "");
        setValueShip("phone", shipping.phone ?? "");
        setValueShip("addressLine1", shipping.addressLine1 ?? "");
        setVnShip({ province: shipping.province ?? "", ward: shipping.ward ?? "" });
        setCustomerNote(draft.customerNote ?? "");
        setShipToDifferent(draft.shipToDifferent === true);
        setPaymentMethod(draft.paymentMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : "COD");
        setDraftReady(true);
      }, 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setDraftReady(true), 0);
    return () => clearTimeout(timer);
  }, [cart, draftReady, setValue, setValueShip]);

  const resolvedAddress = useMemo(
    () => ({
      fullName: formAddress.fullName ?? "",
      phone: formAddress.phone ?? "",
      email: formAddress.email ?? "",
      country: formAddress.country || "VN",
      province: vnAddress.province,
      ward: vnAddress.ward,
      addressLine1: formAddress.addressLine1 ?? "",
    }),
    [formAddress, vnAddress],
  );

  const resolvedShippingAddress = useMemo(
    () => ({
      fullName: formShippingAddress.fullName ?? "",
      phone: formShippingAddress.phone ?? "",
      email: formShippingAddress.email ?? "",
      country: formShippingAddress.country || "VN",
      province: vnShip.province,
      ward: vnShip.ward,
      addressLine1: formShippingAddress.addressLine1 ?? "",
    }),
    [formShippingAddress, vnShip],
  );

  const checkoutDraft = useMemo<CheckoutDraft>(
    () => ({
      cartId: cart?.id ?? null,
      billingAddress: resolvedAddress,
      shippingAddress: resolvedShippingAddress,
      customerNote,
      shipToDifferent,
      paymentMethod,
    }),
    [
      cart?.id,
      customerNote,
      paymentMethod,
      resolvedAddress,
      resolvedShippingAddress,
      shipToDifferent,
    ],
  );

  useEffect(() => {
    if (!cart || !draftReady || !cart.items.length) return undefined;
    const timer = setTimeout(() => saveCheckoutDraft(checkoutDraft), 10 * 1000);
    return () => clearTimeout(timer);
  }, [cart, checkoutDraft, draftReady]);

  // Đơn online không tính phí vận chuyển → tổng = subtotal - giảm giá (cart.totalAmount).
  const cartSubtotal = cart?.totals.subtotalAmount ?? 0;
  const grandTotal = cart?.totals.totalAmount ?? 0;

  async function placeOrder() {
    if (!cart?.items.length) {
      setSubmitError(t("errorEmptyCart"));
      return;
    }

    // Đồng bộ Tỉnh/Phường (state phẳng, nguồn sự thật) vào react-hook-form ngay
    // trước khi validate, để tận dụng thông báo lỗi zod có sẵn mà không phụ thuộc
    // hành vi reset khó đoán của react-hook-form cho 2 field này giữa các lần render.
    setValue("province", vnAddress.province, { shouldValidate: false });
    setValue("ward", vnAddress.ward, { shouldValidate: false });
    const validAddress = await trigger();
    if (!validAddress) {
      setSubmitError(t("errorMissingShipping"));
      return;
    }
    let shipResolvedAddress = {
      fullName: "",
      phone: "",
      email: "",
      country: "VN",
      province: "",
      ward: "",
      addressLine1: "",
    };
    if (shipToDifferent) {
      setValueShip("province", vnShip.province, { shouldValidate: false });
      setValueShip("ward", vnShip.ward, { shouldValidate: false });
      const validShip = await triggerShip();
      if (!validShip) {
        setSubmitError(t("errorMissingShipping"));
        return;
      }
      const shipValues = getValuesShip();
      shipResolvedAddress = {
        fullName: shipValues.fullName ?? "",
        phone: shipValues.phone ?? "",
        email: shipValues.email ?? "",
        country: shipValues.country || "VN",
        province: vnShip.province,
        ward: vnShip.ward,
        addressLine1: shipValues.addressLine1 ?? "",
      };
    }

    setSubmitError("");
    setSubmitting(true);
    try {
      const order = await submitCheckout(
        {
          billingAddress: {
            fullName: resolvedAddress.fullName,
            phone: resolvedAddress.phone,
            email: resolvedAddress.email,
            country: resolvedAddress.country,
            province: resolvedAddress.province,
            ward: resolvedAddress.ward,
            addressLine1: resolvedAddress.addressLine1,
          },
          shippingAddress: shipToDifferent ? shipResolvedAddress : undefined,
          paymentMethod,
          customerNote: customerNote.trim() || undefined,
          locale,
        },
        idempotencyKey.current,
      );
      clearCheckoutDraft();
      refreshCount();
      if (order.priceChanges && order.priceChanges.length > 0) {
        setPriceChanges(order.priceChanges);
        setPendingOrderNav({ orderNumber: order.orderNumber, orderKey: order.orderKey });
      } else {
        router.push(toOrderConfirmPath(order.orderNumber, order.orderKey, locale));
      }
    } catch (error) {
      reportStorefrontFailure("checkout", error);
      setSubmitError(t("submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    await placeOrder();
  }

  function confirmPendingOrder() {
    if (pendingOrderNav) {
      router.push(
        toOrderConfirmPath(pendingOrderNav.orderNumber, pendingOrderNav.orderKey, locale),
      );
    }
  }

  return {
    cart,
    cartLoading,
    cartError,
    submitError,
    priceChanges,
    pendingOrderNav,
    handleSubmit,
    confirmPendingOrder,
    register,
    addressErrors,
    vnAddress,
    onVnChange,
    customerNote,
    setCustomerNote,
    shipToDifferent,
    setShipToDifferent,
    paymentMethod,
    setPaymentMethod,
    registerShip,
    shipErrors,
    vnShip,
    onVnChangeShip,
    cartSubtotal,
    grandTotal,
    submitting,
  };
}
