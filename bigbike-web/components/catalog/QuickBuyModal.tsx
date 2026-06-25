"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogGrabber,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  dialogMobileBottomSheet,
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
import { formatVnd } from "@/lib/utils/format";
import { useQuickBuyForm } from "./quick-buy-modal/useQuickBuyForm";
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
  const tQb = useTranslations("Checkout.quickbuy");

  const {
    form,
    onSubmit,
    submitError,
    isSubmitting,
    quantity,
    quantityId,
  } = useQuickBuyForm({ open, productId, selectedVariantId, unitPrice, onSuccess });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={`rounded-none max-w-lg max-h-[90dvh] overflow-y-auto p-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground ${dialogMobileBottomSheet}`}>
        <DialogGrabber />
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
                <div className="flex justify-between px-3 py-2 font-semibold">
                  <span>{tQb("summaryTotal")}</span>
                  <span className="tabular-nums text-brand">
                    {formatVnd(unitPrice * quantity)}
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
