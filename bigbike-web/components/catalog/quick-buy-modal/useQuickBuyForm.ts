"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth/auth-store";
import { fetchMyAddresses, submitQuickBuy } from "@/lib/api/client-api";
import { createQuickBuySchema, type QuickBuyFormValues } from "@/lib/schemas/quick-buy";
import { generateId } from "@/lib/utils";
import type { QuickBuyModalProps } from "./types";

type UseQuickBuyFormArgs = Pick<
  QuickBuyModalProps,
  "open" | "productId" | "selectedVariantId" | "unitPrice" | "onSuccess"
>;

/**
 * Toàn bộ state + hiệu ứng + logic nghiệp vụ của hộp thoại "Mua nhanh":
 * khởi tạo form, prefill từ hồ sơ khi đã đăng nhập và gửi đơn (kèm idempotency key).
 * Đơn online không tính phí vận chuyển. Tách khỏi JSX để file component chỉ còn phần hiển thị.
 */
export function useQuickBuyForm({
  open,
  productId,
  selectedVariantId,
  onSuccess,
}: UseQuickBuyFormArgs) {
  const tQb = useTranslations("Checkout.quickbuy");
  const tV = useTranslations("Checkout.validation");
  const auth = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      ward: "",
      addressLine1: "",
      quantity: 1,
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
        if (def.ward) form.setValue("ward", def.ward ?? "");
        if (def.addressLine1) form.setValue("addressLine1", def.addressLine1);
      })
      .catch(() => { /* ignore — prefill is best-effort */ });
  }, [open, auth]); // eslint-disable-line react-hooks/exhaustive-deps

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
            ward: values.ward ?? "",
            addressLine1: values.addressLine1,
          },
          customerNote: values.customerNote || undefined,
        },
        idempotencyKeyRef.current,
      );
      onSuccess({
        orderNumber: order.orderNumber,
        orderKey: order.orderKey,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : tQb("errSubmitFailed");
      setSubmitError(message);
    }
  }

  const isSubmitting = form.formState.isSubmitting;
  const quantity = form.watch("quantity") ?? 1;
  const quantityId = useId();

  return {
    form,
    onSubmit,
    submitError,
    isSubmitting,
    quantity,
    quantityId,
  };
}
