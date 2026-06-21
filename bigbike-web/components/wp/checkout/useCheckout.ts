"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateId } from "@/lib/utils";
import { submitCheckout } from "@/lib/api/client-api";
import { useCart } from "@/lib/cart-context";
import { useAddresses, useCartQuery, useCheckoutOptions, useProfile } from "@/lib/query/hooks";
import type { PriceChange } from "@/lib/contracts/commerce";
import { createCheckoutAddressSchema, type CheckoutAddressFormValues } from "@/lib/schemas/checkout";
import { pushDataLayer, toGtmCartItems } from "@/lib/analytics";
import { formatVnd } from "@/lib/utils/format";
import { toOrderConfirmPath } from "@/lib/utils/routes";
import { getVietnamRegion } from "@/lib/utils/vn-region";
import {
  effectiveMethodCost,
  isZoneMismatch,
  normalizeMethodCode,
  pickDefaultAddress,
} from "./helpers";

/**
 * Toàn bộ state + logic nghiệp vụ của trang Thanh toán: 2 form địa chỉ (billing +
 * giao tới địa chỉ khác) react-hook-form/zod, nạp shipping/payment options, prefill
 * từ profile/address, GTM begin_checkout, khớp vùng giao (zone), min-order,
 * price-change và đặt đơn (idempotency key). Tách khỏi JSX để file component chỉ còn markup.
 */
export function useCheckout() {
  const t = useTranslations("Checkout");
  const tValidation = useTranslations("Checkout.validation");
  const router = useRouter();
  const { refreshCount } = useCart();

  const [paymentMethod, setPaymentMethod] = useState("");
  const [shippingMethodId, setShippingMethodId] = useState("");
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
  const {
    data: checkoutOptions,
    isLoading: optionsLoading,
    isError: optionsError,
    refetch: refetchOptions,
  } = useCheckoutOptions();
  const { data: profile } = useProfile();
  const { data: addresses } = useAddresses();

  const {
    register,
    trigger,
    watch,
    setValue,
    formState: { errors: addressErrors },
  } = useForm<CheckoutAddressFormValues>({
    resolver: zodResolver(createCheckoutAddressSchema(tValidation)),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      country: "VN",
      province: "",
      district: "",
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
      district: "",
      ward: "",
      addressLine1: "",
    },
  });

  const formShip = watchShip();

  useEffect(() => {
    if (!checkoutOptions) return;
    setPaymentMethod((prev) => prev || checkoutOptions.paymentMethods[0]?.code || "");
    setShippingMethodId((prev) => prev || checkoutOptions.shippingMethods[0]?.id || "");
  }, [checkoutOptions]);

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
      setValue("district", addr.district ?? "");
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
      district: formAddress.district ?? "",
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
      district: formShip.district ?? "",
      ward: formShip.ward ?? "",
      addressLine1: formShip.addressLine1 ?? "",
    }),
    [formShip],
  );

  const cartSubtotal = cart?.totals.subtotalAmount ?? 0;
  const cartTotal = cart?.totals.totalAmount ?? 0;
  const shippingMethods = checkoutOptions?.shippingMethods ?? [];
  const paymentMethods = checkoutOptions?.paymentMethods ?? [];
  const selectedShipping = shippingMethods.find((m) => m.id === shippingMethodId);
  const effectiveShippingCost = effectiveMethodCost(selectedShipping, cartSubtotal);
  const grandTotal = cartTotal + effectiveShippingCost;
  const minOrderAmount = selectedShipping?.minOrderAmount ?? null;
  const belowMinOrder = minOrderAmount !== null && minOrderAmount > 0 ? cartSubtotal < minOrderAmount : false;
  // Vùng giao tính theo địa chỉ hàng thực sự được gửi tới (shipping nếu có, không thì billing).
  const deliveryProvince = shipToDifferent ? resolvedShip.province : resolvedAddress.province;
  const userRegion = getVietnamRegion(deliveryProvince);
  const selectedShippingZoneMismatch = selectedShipping ? isZoneMismatch(selectedShipping, userRegion) : false;

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
    if (!paymentMethod) {
      setSubmitError(t("errorMissingPayment"));
      return;
    }
    if (!shippingMethodId) {
      setSubmitError(t("errorShippingUnavailable"));
      return;
    }
    if (selectedShippingZoneMismatch) {
      setSubmitError(t("shippingZoneMismatch"));
      return;
    }
    if (belowMinOrder && minOrderAmount) {
      setSubmitError(t("belowMinOrder", { amount: formatVnd(minOrderAmount) }));
      return;
    }
    if (normalizeMethodCode(paymentMethod) === "BACS" && !resolvedAddress.email.trim()) {
      setSubmitError(t("errorEmailRequiredForBacs"));
      return;
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
            district: resolvedAddress.district,
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
                district: resolvedShip.district,
                ward: resolvedShip.ward,
                addressLine1: resolvedShip.addressLine1,
              }
            : undefined,
          shippingMethodId: shippingMethodId || null,
          paymentMethod,
          customerNote: customerNote.trim() || undefined,
        },
        idempotencyKey.current,
      );
      refreshCount();
      if (order.priceChanges && order.priceChanges.length > 0) {
        setPriceChanges(order.priceChanges);
        setPendingOrderNav({ orderNumber: order.orderNumber, orderKey: order.orderKey });
      } else {
        router.push(toOrderConfirmPath(order.orderNumber, order.orderKey));
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
      router.push(toOrderConfirmPath(pendingOrderNav.orderNumber, pendingOrderNav.orderKey));
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
    effectiveShippingCost,
    grandTotal,
    selectedShipping,
    shippingMethods,
    shippingMethodId,
    setShippingMethodId,
    paymentMethods,
    paymentMethod,
    setPaymentMethod,
    optionsLoading,
    optionsError,
    refetchOptions,
    userRegion,
    submitting,
    belowMinOrder,
    selectedShippingZoneMismatch,
  };
}
