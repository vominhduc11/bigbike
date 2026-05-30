"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth/auth-store";
import { fetchCheckoutOptions, fetchMyAddresses, submitQuickBuy } from "@/lib/api/client-api";
import { getRegionForProvince } from "@/lib/vn-region-map";
import type { ShippingMethodOption } from "@/lib/contracts/commerce";
import { createQuickBuySchema, type QuickBuyFormValues } from "@/lib/schemas/quick-buy";
import { zodResolver } from "@hookform/resolvers/zod";
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// UUID v4 helper — minimal, no dep
function uuid4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export type QuickBuyModalProps = {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  selectedVariantId?: string | null;
  variantLabel?: string | null;
  unitPrice?: number | null;
  onSuccess: (order: { orderNumber: string; orderKey: string; paymentMethod: string }) => void;
};

export function QuickBuyModal({
  open,
  onClose,
  productId,
  productName,
  selectedVariantId,
  variantLabel,
  unitPrice,
  onSuccess,
}: QuickBuyModalProps) {
  const t = useTranslations("Checkout");
  const tQb = useTranslations("Checkout.quickbuy");
  const tV = useTranslations("Checkout.validation");
  const auth = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethodOption[]>([]);

  // Idempotency key — regenerated each time modal opens
  const idempotencyKeyRef = useRef<string>(uuid4());
  useEffect(() => {
    if (open) idempotencyKeyRef.current = uuid4();
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
    fetchCheckoutOptions()
      .then((opts) => setShippingMethods(opts.shippingMethods ?? []))
      .catch(() => { /* non-critical — shipping estimate is best-effort */ });
  }, [open]);

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
          shippingMethodId: shippingEstimate?.id ?? null,
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
  const quantityId = useId();

  // Compute shipping estimate from checkout options — mirrors resolveShippingCost on backend
  const shippingEstimate = (() => {
    if (!shippingMethods.length || !province) return null;
    const subtotal = (unitPrice ?? 0) * quantity;
    const region = getRegionForProvince(province);
    // Pick best method: zone-matched first, then universal (null zone)
    const match =
      shippingMethods.find((m) => m.zoneRegionCode === region) ??
      shippingMethods.find((m) => !m.zoneRegionCode) ??
      null;
    if (!match) return null;
    if (match.minOrderAmount && subtotal < match.minOrderAmount) return null;
    const isFree = match.freeShippingThreshold != null && subtotal >= match.freeShippingThreshold;
    return { id: match.id, cost: isFree ? 0 : match.cost, isFree, threshold: match.freeShippingThreshold };
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="rounded-none max-w-lg max-h-[90dvh] overflow-y-auto p-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-base font-bold uppercase tracking-wide">
            {tQb("title")}
          </DialogTitle>
          <div className="mt-1 text-sm text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground line-clamp-2">{productName}</p>
            {variantLabel && (
              <p className="text-xs">{variantLabel}</p>
            )}
            {unitPrice != null && unitPrice > 0 && (
              <p className="text-sm font-semibold text-brand">
                {unitPrice.toLocaleString("vi-VN")}₫
              </p>
            )}
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col gap-5 px-6 py-4">

              {/* Thông tin liên hệ */}
              <section>
                <p className="text-xs font-semibold uppercase tracking-display text-muted-foreground mb-3">
                  {tQb("contactSection")}
                </p>
                <div className="flex flex-col gap-3">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tQb("fullName")} <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isSubmitting} autoComplete="name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tQb("phone")} <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" disabled={isSubmitting} autoComplete="tel" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tQb("email")} <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} type="email" disabled={isSubmitting} autoComplete="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              {/* Địa chỉ nhận hàng */}
              <section>
                <p className="text-xs font-semibold uppercase tracking-display text-muted-foreground mb-3">
                  {tQb("addressSection")}
                </p>
                <div className="flex flex-col gap-3">
                  <VnAddressFields
                    value={{
                      province: form.watch("province"),
                      district: form.watch("district"),
                      ward: form.watch("ward") ?? "",
                    }}
                    onChange={(field, value) => {
                      form.setValue(field as "province" | "district" | "ward", value, { shouldValidate: true });
                    }}
                    required
                    labelClassName="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    selectContentClassName="z-[var(--bb-z-modal-dropdown)]"
                  />
                  {form.formState.errors.province && (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.province.message}</p>
                  )}
                  {form.formState.errors.district && (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.district.message}</p>
                  )}

                  <FormField
                    control={form.control}
                    name="addressLine1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tQb("line1")} <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isSubmitting} autoComplete="address-line1" placeholder="Số nhà, tên đường..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              {/* Số lượng */}
              <section>
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor={quantityId}>{tQb("quantity")}</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-0 w-fit border border-input">
                          <button
                            type="button"
                            id={quantityId}
                            className="px-3 h-10 text-lg font-medium hover:bg-muted disabled:opacity-40"
                            onClick={() => field.onChange(Math.max(1, (field.value ?? 1) - 1))}
                            disabled={isSubmitting || (field.value ?? 1) <= 1}
                            aria-label="Giảm số lượng"
                          >
                            −
                          </button>
                          <span className="px-4 h-10 flex items-center justify-center min-w-[3rem] text-sm font-semibold tabular-nums select-none">
                            {field.value ?? 1}
                          </span>
                          <button
                            type="button"
                            className="px-3 h-10 text-lg font-medium hover:bg-muted disabled:opacity-40"
                            onClick={() => field.onChange((field.value ?? 1) + 1)}
                            disabled={isSubmitting}
                            aria-label="Tăng số lượng"
                          >
                            +
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              {/* Phương thức thanh toán */}
              <section>
                <p className="text-xs font-semibold uppercase tracking-display text-muted-foreground mb-3">
                  {tQb("paymentSection")}
                </p>
                <div className="flex flex-col gap-2">
                  {(["COD", "BACS"] as const).map((method) => (
                    <label
                      key={method}
                      className={cn(
                        "flex items-start gap-3 p-3 border cursor-pointer transition-colors",
                        paymentMethod === method
                          ? "border-foreground bg-muted/40"
                          : "border-border hover:border-foreground/40",
                        isSubmitting && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={method}
                        checked={paymentMethod === method}
                        onChange={() => form.setValue("paymentMethod", method)}
                        disabled={isSubmitting}
                        className="mt-0.5 accent-foreground"
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">
                          {t(`paymentMethod.${method}`)}
                        </span>
                        {method === "BACS" && (
                          <span className="text-xs text-muted-foreground">{tQb("paymentBacsHint")}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              {/* Ghi chú */}
              <FormField
                control={form.control}
                name="customerNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tQb("note")}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={2}
                        disabled={isSubmitting}
                        placeholder={tQb("notePlaceholder")}
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit error */}
              {submitError && (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {submitError}
                </p>
              )}
            </div>

            {/* Order summary */}
            {unitPrice != null && unitPrice > 0 && (
              <div className="mx-6 mb-4 border border-border text-sm">
                <div className="flex justify-between px-3 py-2 border-b border-border">
                  <span className="text-muted-foreground">{tQb("summarySubtotal")}</span>
                  <span className="font-medium tabular-nums">
                    {(unitPrice * quantity).toLocaleString("vi-VN")}₫
                  </span>
                </div>
                <div className="flex justify-between px-3 py-2 border-b border-border">
                  <span className="text-muted-foreground">{tQb("summaryShipping")}</span>
                  <span className={cn("font-medium tabular-nums", shippingEstimate?.isFree && "text-state-success-text")}>
                    {!province
                      ? <span className="text-muted-foreground text-xs">{tQb("summaryShippingSelectProvince")}</span>
                      : shippingEstimate == null
                        ? <span className="text-muted-foreground text-xs">{tQb("summaryShippingUnknown")}</span>
                        : shippingEstimate.isFree
                          ? tQb("summaryShippingFree")
                          : `${shippingEstimate.cost.toLocaleString("vi-VN")}₫`
                    }
                  </span>
                </div>
                <div className="flex justify-between px-3 py-2 font-semibold">
                  <span>{tQb("summaryTotal")}</span>
                  <span className="tabular-nums text-brand">
                    {shippingEstimate != null
                      ? `${(unitPrice * quantity + shippingEstimate.cost).toLocaleString("vi-VN")}₫`
                      : `${(unitPrice * quantity).toLocaleString("vi-VN")}₫`
                    }
                    {shippingEstimate == null && province && (
                      <span className="text-xs font-normal text-muted-foreground ml-1">+ {tQb("summaryShippingUnknown")}</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter className="flex-row gap-2 px-6 pb-6 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-none"
                onClick={onClose}
                disabled={isSubmitting}
              >
                {tQb("cancel")}
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-none"
                disabled={isSubmitting}
              >
                {isSubmitting ? tQb("submitting") : tQb("submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
