"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/utils/format";
import { useQuickBuyForm } from "./quick-buy-modal/useQuickBuyForm";
import { ShippingMethodsSection } from "./quick-buy-modal/ShippingMethodsSection";
import type { QuickBuyModalProps } from "./quick-buy-modal/types";

export type { QuickBuyModalProps };

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

  const {
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
  } = useQuickBuyForm({ open, productId, selectedVariantId, unitPrice, onSuccess });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="rounded-none max-w-lg max-h-[90dvh] overflow-y-auto p-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-body font-bold uppercase tracking-wide">
            {tQb("title")}
          </DialogTitle>
          <div className="mt-1 text-caption text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground line-clamp-2">{productName}</p>
            {variantLabel && (
              <p className="text-overline">{variantLabel}</p>
            )}
            {unitPrice != null && unitPrice > 0 && (
              <p className="text-caption font-semibold text-brand">
                {formatVnd(unitPrice)}
              </p>
            )}
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="flex flex-col gap-5 px-6 py-4">

              {/* Thông tin liên hệ */}
              <section>
                <p className="text-overline font-semibold uppercase tracking-display text-muted-foreground mb-3">
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
                <p className="text-overline font-semibold uppercase tracking-display text-muted-foreground mb-3">
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
                    labelClassName="text-caption font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    selectContentClassName="z-[var(--bb-z-modal-dropdown)]"
                  />
                  {form.formState.errors.province && (
                    <p className="text-caption font-medium text-destructive">{form.formState.errors.province.message}</p>
                  )}
                  {form.formState.errors.district && (
                    <p className="text-caption font-medium text-destructive">{form.formState.errors.district.message}</p>
                  )}

                  <FormField
                    control={form.control}
                    name="addressLine1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{tQb("line1")} <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isSubmitting} autoComplete="address-line1" placeholder={tQb("line1Placeholder")} />
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
                            className="px-3 h-10 text-ui-18 font-medium hover:bg-muted disabled:opacity-40"
                            onClick={() => field.onChange(Math.max(1, (field.value ?? 1) - 1))}
                            disabled={isSubmitting || (field.value ?? 1) <= 1}
                            aria-label={tQb("qtyDecrease")}
                          >
                            −
                          </button>
                          <span className="px-4 h-10 flex items-center justify-center min-w-[3rem] text-caption font-semibold tabular-nums select-none">
                            {field.value ?? 1}
                          </span>
                          <button
                            type="button"
                            className="px-3 h-10 text-ui-18 font-medium hover:bg-muted disabled:opacity-40"
                            onClick={() => field.onChange((field.value ?? 1) + 1)}
                            disabled={isSubmitting}
                            aria-label={tQb("qtyIncrease")}
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

              {/* Phương thức vận chuyển */}
              {province && (
                <ShippingMethodsSection
                  availableMethodsForRegion={availableMethodsForRegion}
                  shippingEstimate={shippingEstimate}
                  selectedShippingId={selectedShippingId}
                  isSubmitting={isSubmitting}
                  unitPrice={unitPrice}
                  quantity={quantity}
                  onSelect={(id) => form.setValue("shippingMethodId", id)}
                />
              )}

              {/* Phương thức thanh toán */}
              <section>
                <p className="text-overline font-semibold uppercase tracking-display text-muted-foreground mb-3">
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
                        <span className="text-caption font-medium">
                          {t(`paymentMethod.${method}`)}
                        </span>
                        {method === "BACS" && (
                          <span className="text-overline text-muted-foreground">{tQb("paymentBacsHint")}</span>
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
                <p className="text-caption font-medium text-destructive" role="alert">
                  {submitError}
                </p>
              )}
            </div>

            {/* Order summary */}
            {unitPrice != null && unitPrice > 0 && (
              <div className="mx-6 mb-4 border border-border text-caption">
                <div className="flex justify-between px-3 py-2 border-b border-border">
                  <span className="text-muted-foreground">{tQb("summarySubtotal")}</span>
                  <span className="font-medium tabular-nums">
                    {formatVnd(unitPrice * quantity)}
                  </span>
                </div>
                <div className="flex justify-between px-3 py-2 border-b border-border">
                  <span className="text-muted-foreground">{tQb("summaryShipping")}</span>
                  <span className={cn("font-medium tabular-nums", shippingEstimate?.isFree && "text-state-success-text")}>
                    {!province
                      ? <span className="text-muted-foreground text-overline">{tQb("summaryShippingSelectProvince")}</span>
                      : shippingEstimate == null
                        ? <span className="text-muted-foreground text-overline">{tQb("summaryShippingUnknown")}</span>
                        : shippingEstimate.isFree
                          ? tQb("summaryShippingFree")
                          : formatVnd(shippingEstimate.cost)
                    }
                  </span>
                </div>
                <div className="flex justify-between px-3 py-2 font-semibold">
                  <span>{tQb("summaryTotal")}</span>
                  <span className="tabular-nums text-brand">
                    {shippingEstimate != null
                      ? formatVnd(unitPrice * quantity + shippingEstimate.cost)
                      : formatVnd(unitPrice * quantity)
                    }
                    {shippingEstimate == null && province && (
                      <span className="text-overline font-normal text-muted-foreground ml-1">+ {tQb("summaryShippingUnknown")}</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Coupon hint */}
            <p className="px-6 pb-2 text-overline text-muted-foreground">
              {tQb("couponHintText")}{" "}
              <Link
                href="/gio-hang"
                onClick={onClose}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {tQb("couponHintLinkText")}
              </Link>
            </p>

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
