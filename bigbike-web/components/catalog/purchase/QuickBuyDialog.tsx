"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogGrabber,
  DialogHeader,
  DialogTitle,
  dialogMobileBottomSheet,
} from "@/components/ui/dialog";
import { CheckoutAddressFields } from "@/components/checkout/parts/CheckoutAddressFields";
import { CodPaymentBlock } from "@/components/checkout/parts/atoms";
import { submitQuickBuy } from "@/lib/api/client-api";
import { createCheckoutAddressSchema, type CheckoutAddressFormValues } from "@/lib/schemas/checkout";
import { generateId } from "@/lib/utils";
import { formatVndNumber } from "@/lib/utils/format";
import { toOrderConfirmPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  productVariantId?: string | null;
  /** Nhãn biến thể đã chọn (vd "Đen / L") — chỉ để hiển thị tóm tắt. */
  variantLabel?: string;
  quantity: number;
  unitPrice: number;
};

/**
 * Điểm vào "Mua nhanh" trên PDP: khách đặt đúng 1 sản phẩm không qua giỏ hàng
 * (POST /api/v1/checkout/quick-buy). Form địa chỉ tái dùng CheckoutAddressFields
 * của trang Thanh toán; phương thức thanh toán hiển thị cố định COD và payload
 * luôn gửi `paymentMethod = "COD"` (owner decision 2026-07-15 — PAY_RULE_001).
 */
export function QuickBuyDialog({
  open,
  onOpenChange,
  productId,
  productName,
  productVariantId,
  variantLabel,
  quantity,
  unitPrice,
}: Props) {
  const tb = useTranslations("PdpBuyBox");
  const t = useTranslations("Checkout");
  const tValidation = useTranslations("Checkout.validation");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // 1 key cho mỗi lần mở trang PDP — retry sau lỗi mạng không tạo đơn trùng
  // (reservation của lần gửi lỗi đã rollback cùng transaction phía backend).
  const idempotencyKey = useRef<string>(generateId());

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
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
  const [customerNote, setCustomerNote] = useState("");

  const total = unitPrice * quantity;

  async function placeQuickBuyOrder(values: CheckoutAddressFormValues) {
    setSubmitError("");
    setSubmitting(true);
    try {
      const order = await submitQuickBuy(
        {
          productId,
          productVariantId: productVariantId || undefined,
          quantity,
          billingAddress: {
            fullName: values.fullName,
            phone: values.phone,
            email: values.email ?? "",
            country: values.country || "VN",
            province: values.province,
            ward: values.ward,
            addressLine1: values.addressLine1,
          },
          paymentMethod: "COD",
          customerNote: customerNote.trim() || undefined,
        },
        idempotencyKey.current,
      );
      router.push(toOrderConfirmPath(order.orderNumber, order.orderKey, locale));
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : tb("quickBuyFailed"));
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className={dialogMobileBottomSheet}>
        <DialogGrabber />
        <DialogHeader>
          <DialogTitle>{tb("quickBuyTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(placeQuickBuyOrder)} noValidate className="space-y-4 p-5">
          {/* Tóm tắt món hàng đang đặt — sản phẩm + biến thể + số lượng + tổng COD */}
          <div className="border border-border bg-secondary p-4">
            <p className="m-0 font-body text-a4-content font-semibold text-foreground">
              {productName}
              {variantLabel ? <span className="font-normal text-muted-foreground"> — {variantLabel}</span> : null}
            </p>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <span className="text-a5-meta text-muted-foreground">
                {formatVndNumber(unitPrice)} ₫ × {quantity}
              </span>
              <span className="font-body text-a3-section font-bold text-brand">
                {tb("quickBuyTotal")}: {formatVndNumber(total)} ₫
              </span>
            </div>
          </div>

          <CheckoutAddressFields
            idPrefix="billing"
            autoCompletePrefix=""
            register={register}
            errors={errors}
            includeEmail
            vnValue={{
              province: formAddress.province ?? "",
              ward: formAddress.ward ?? "",
            }}
            onVnChange={(field, val) => setValue(field, val, { shouldValidate: true })}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="quick_buy_note" className="font-body text-a5-meta font-bold text-foreground">
              {t("noteLabel")} <span className="optional">{t("noteOptional")}</span>
            </label>
            <Textarea
              id="quick_buy_note"
              placeholder={t("notePlaceholder")}
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </div>

          <CodPaymentBlock />

          {submitError ? (
            <div className="border border-destructive bg-accent p-4 text-destructive" role="alert">
              {submitError}
            </div>
          ) : null}

          <Button type="submit" className="h-auto min-h-[52px] w-full rounded-none" disabled={submitting}>
            {submitting ? t("placingOrder") : tb("quickBuySubmit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
