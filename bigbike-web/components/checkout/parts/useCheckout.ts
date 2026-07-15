"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateId } from "@/lib/utils";
import { submitCheckout } from "@/lib/api/client-api";
import { hasCustomerSessionHint, useAuth } from "@/lib/auth/auth-store";
import { useCart } from "@/lib/cart-context";
import { useAddresses, useCartQuery, useProfile } from "@/lib/query/hooks";
import type { PriceChange } from "@/lib/contracts/commerce";
import { createCheckoutAddressSchema, type CheckoutAddressFormValues } from "@/lib/schemas/checkout";
import { pushDataLayer, toGtmCartItems } from "@/lib/analytics";
import { toOrderConfirmPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { pickDefaultAddress } from "./helpers";

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
  const [pendingOrderNav, setPendingOrderNav] = useState<{ orderNumber: string; orderKey: string } | null>(null);
  const [gtmFired, setGtmFired] = useState(false);
  const [customerNote, setCustomerNote] = useState("");
  const [shipToDifferent, setShipToDifferent] = useState(false);
  const idempotencyKey = useRef<string>(generateId());
  const hasPrefilledRef = useRef(false);

  const { data: cart, isLoading: cartLoading, error: cartError } = useCartQuery();
  const shouldLoadCustomer =
    auth.status === "authenticated" || (auth.status === "loading" && hasCustomerSessionHint());
  const { data: profile } = useProfile({ enabled: shouldLoadCustomer });
  const { data: addresses } = useAddresses({ enabled: shouldLoadCustomer });

  const {
    register,
    trigger,
    watch,
    setValue,
    formState: { errors: addressErrors },
  } = useForm<CheckoutAddressFormValues>({
    resolver: zodResolver(createCheckoutAddressSchema(tValidation, true)),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      country: "VN",
      province: "",
      ward: "",
      addressLine1: "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const formAddress = watch();

  // Form địa chỉ giao riêng — chỉ dùng khi khách chọn "giao tới địa chỉ khác".
  // Backend không validate shippingAddress (chỉ billing), nên ràng buộc nằm ở zod đây.
  const {
    register: registerShip,
    trigger: triggerShip,
    watch: watchShip,
    setValue: setValueShip,
    formState: { errors: shipErrors },
  } = useForm<CheckoutAddressFormValues>({
    resolver: zodResolver(createCheckoutAddressSchema(tValidation)),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      country: "VN",
      province: "",
      ward: "",
      addressLine1: "",
    },
  });

  const formShip = watchShip();

  useEffect(() => {
    if (!cart || gtmFired) return;
    pushDataLayer("begin_checkout", {
      currency: cart.currency ?? "VND",
      value: cart.totals.totalAmount,
      items: toGtmCartItems(cart.items),
    });
    setGtmFired(true);
  }, [cart, gtmFired]);

  useEffect(() => {
    if (hasPrefilledRef.current) return;
    if (!profile) return;
    if (addresses === undefined) return;
    hasPrefilledRef.current = true;

    const addr = pickDefaultAddress(addresses);
    if (addr) {
      setValue("fullName", addr.fullName ?? profile.displayName ?? "");
      setValue("phone", addr.phone ?? profile.phone ?? "");
      setValue("email", addr.email ?? profile.email ?? "");
      setValue("province", addr.province ?? "");
      setValue("ward", addr.ward ?? "");
      setValue("addressLine1", addr.addressLine1 ?? "");
    } else {
      if (profile.displayName) setValue("fullName", profile.displayName);
      if (profile.phone) setValue("phone", profile.phone);
      if (profile.email) setValue("email", profile.email);
    }
  }, [profile, addresses, setValue]);

  const resolvedAddress = useMemo(
    () => ({
      fullName: formAddress.fullName ?? "",
      phone: formAddress.phone ?? "",
      email: formAddress.email ?? "",
      country: formAddress.country || "VN",
      province: formAddress.province ?? "",
      ward: formAddress.ward ?? "",
      addressLine1: formAddress.addressLine1 ?? "",
    }),
    [formAddress],
  );

  const resolvedShip = useMemo(
    () => ({
      fullName: formShip.fullName ?? "",
      phone: formShip.phone ?? "",
      email: formShip.email ?? "",
      country: formShip.country || "VN",
      province: formShip.province ?? "",
      ward: formShip.ward ?? "",
      addressLine1: formShip.addressLine1 ?? "",
    }),
    [formShip],
  );

  // Đơn online không tính phí vận chuyển → tổng = subtotal - giảm giá (cart.totalAmount).
  const cartSubtotal = cart?.totals.subtotalAmount ?? 0;
  const grandTotal = cart?.totals.totalAmount ?? 0;

  async function placeOrder() {
    if (!cart?.items.length) {
      setSubmitError(t("errorEmptyCart"));
      return;
    }

    const validAddress = await trigger();
    if (!validAddress) {
      setSubmitError(t("errorMissingShipping"));
      return;
    }
    if (shipToDifferent) {
      const validShip = await triggerShip();
      if (!validShip) {
        setSubmitError(t("errorMissingShipping"));
        return;
      }
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
          shippingAddress: shipToDifferent
            ? {
                fullName: resolvedShip.fullName,
                phone: resolvedShip.phone,
                email: resolvedShip.email,
                country: resolvedShip.country,
                province: resolvedShip.province,
                ward: resolvedShip.ward,
                addressLine1: resolvedShip.addressLine1,
              }
            : undefined,
          // COD là phương thức duy nhất trên storefront và UI hiển thị cố định COD —
          // payload phải gửi đúng như đã hứa với khách (owner decision 2026-07-15, PAY_RULE_001).
          paymentMethod: "COD",
          customerNote: customerNote.trim() || undefined,
        },
        idempotencyKey.current,
      );
      refreshCount();
      if (order.priceChanges && order.priceChanges.length > 0) {
        setPriceChanges(order.priceChanges);
        setPendingOrderNav({ orderNumber: order.orderNumber, orderKey: order.orderKey });
      } else {
        router.push(toOrderConfirmPath(order.orderNumber, order.orderKey, locale));
      }
    } catch (err: unknown) {
      setSubmitError((err as Error).message);
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
      router.push(toOrderConfirmPath(pendingOrderNav.orderNumber, pendingOrderNav.orderKey, locale));
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
    formAddress,
    setValue,
    customerNote,
    setCustomerNote,
    shipToDifferent,
    setShipToDifferent,
    registerShip,
    shipErrors,
    formShip,
    setValueShip,
    cartSubtotal,
    grandTotal,
    submitting,
  };
}
