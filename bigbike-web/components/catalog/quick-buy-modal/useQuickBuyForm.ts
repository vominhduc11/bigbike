"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth/auth-store";
import { fetchCheckoutOptions, fetchMyAddresses, submitQuickBuy } from "@/lib/api/client-api";
import { getRegionForProvince } from "@/lib/vn-region-map";
import type { ShippingMethodOption } from "@/lib/contracts/commerce";
import { createQuickBuySchema, type QuickBuyFormValues } from "@/lib/schemas/quick-buy";
import { generateId } from "@/lib/utils";
import type { QuickBuyModalProps } from "./types";

type UseQuickBuyFormArgs = Pick<
  QuickBuyModalProps,
  "open" | "productId" | "selectedVariantId" | "unitPrice" | "onSuccess"
>;

/**
 * Toàn bộ state + hiệu ứng + logic nghiệp vụ của hộp thoại "Mua nhanh":
 * khởi tạo form, prefill từ hồ sơ khi đã đăng nhập, nạp phương thức vận chuyển,
 * tự chọn phương thức theo vùng, tính phí ship và gửi đơn (kèm idempotency key).
 * Tách khỏi JSX để file component chỉ còn phần hiển thị.
 */
export function useQuickBuyForm({
  open,
  productId,
  selectedVariantId,
  unitPrice,
  onSuccess,
}: UseQuickBuyFormArgs) {
  const locale = useLocale();
  const tQb = useTranslations("Checkout.quickbuy");
  const tV = useTranslations("Checkout.validation");
  const auth = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethodOption[]>([]);

  // Idempotency key — regenerated each time modal opens
  const idempotencyKeyRef = useRef<string>(generateId());
  useEffect(() => {
    if (open) idempotencyKeyRef.current = generateId();
  }, [open]);

  const form = useForm<QuickBuyFormValues>({
    resolver: zodResolver(createQuickBuySchema((key) => tV(key))),
    defaultValues: {
      customerName: "",
      phone: "",
      email: "",
      province: "",
      district: "",
      ward: "",
      addressLine1: "",
      quantity: 1,
      shippingMethodId: "",
      paymentMethod: "COD",
      customerNote: "",
    },
  });

  // Prefill from profile when authenticated
  useEffect(() => {
    if (!open || auth.status !== "authenticated") return;
    const { profile } = auth;
    form.setValue("customerName", profile.displayName ?? "");
    form.setValue("phone", profile.phone ?? "");
    form.setValue("email", profile.email ?? "");

    fetchMyAddresses()
      .then((addresses) => {
        const def = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
        if (!def) return;
        if (def.province) form.setValue("province", def.province);
        if (def.district) form.setValue("district", def.district);
        if (def.ward) form.setValue("ward", def.ward ?? "");
        if (def.addressLine1) form.setValue("addressLine1", def.addressLine1);
      })
      .catch(() => { /* ignore — prefill is best-effort */ });
  }, [open, auth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load shipping options once on modal open
  useEffect(() => {
    if (!open) return;
    fetchCheckoutOptions(locale)
      .then((opts) => setShippingMethods(opts.shippingMethods ?? []))
      .catch(() => { /* non-critical — shipping estimate is best-effort */ });
  }, [open, locale]);

  // Reset form and error on close
  useEffect(() => {
    if (!open) {
      form.reset();
      setSubmitError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(values: QuickBuyFormValues) {
    setSubmitError(null);
    try {
      const order = await submitQuickBuy(
        {
          productId,
          productVariantId: selectedVariantId ?? undefined,
          quantity: values.quantity,
          billingAddress: {
            fullName: values.customerName,
            phone: values.phone,
            email: values.email,
            country: "VN",
            province: values.province,
            district: values.district,
            ward: values.ward ?? "",
            addressLine1: values.addressLine1,
          },
          shippingMethodId: values.shippingMethodId || null,
          paymentMethod: values.paymentMethod,
          customerNote: values.customerNote || undefined,
        },
        idempotencyKeyRef.current,
      );
      onSuccess({
        orderNumber: order.orderNumber,
        orderKey: order.orderKey,
        paymentMethod: values.paymentMethod,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : tQb("errSubmitFailed");
      setSubmitError(message);
    }
  }

  const isSubmitting = form.formState.isSubmitting;
  const paymentMethod = form.watch("paymentMethod");
  const province = form.watch("province");
  const quantity = form.watch("quantity") ?? 1;
  const selectedShippingId = form.watch("shippingMethodId");
  const quantityId = useId();

  // Methods available for the currently selected province's region
  const availableMethodsForRegion = (() => {
    if (!shippingMethods.length || !province) return [];
    const region = getRegionForProvince(province);
    const zoneMatched = shippingMethods.filter((m) => m.zoneRegionCode === region);
    return zoneMatched.length > 0
      ? zoneMatched
      : shippingMethods.filter((m) => !m.zoneRegionCode);
  })();

  // Auto-select shipping: keep current selection if still valid, otherwise pick first available
  useEffect(() => {
    if (!province || !shippingMethods.length) return;
    const region = getRegionForProvince(province);
    const zoneMatched = shippingMethods.filter((m) => m.zoneRegionCode === region);
    const available = zoneMatched.length > 0 ? zoneMatched : shippingMethods.filter((m) => !m.zoneRegionCode);
    const currentId = form.getValues("shippingMethodId");
    if (!available.some((m) => m.id === currentId)) {
      form.setValue("shippingMethodId", available[0]?.id ?? "");
    }
  }, [province, shippingMethods]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute cost for the currently selected shipping method
  const shippingEstimate = (() => {
    const method = shippingMethods.find((m) => m.id === selectedShippingId);
    if (!method) return null;
    const subtotal = (unitPrice ?? 0) * quantity;
    if (method.minOrderAmount && subtotal < method.minOrderAmount) return null;
    const isFree = method.freeShippingThreshold != null && subtotal >= method.freeShippingThreshold;
    return { id: method.id, title: method.title, cost: isFree ? 0 : method.cost, isFree, threshold: method.freeShippingThreshold };
  })();

  return {
    form,
    onSubmit,
    submitError,
    isSubmitting,
    paymentMethod,
    province,
    quantity,
    selectedShippingId,
    quantityId,
    availableMethodsForRegion,
    shippingEstimate,
  };
}
