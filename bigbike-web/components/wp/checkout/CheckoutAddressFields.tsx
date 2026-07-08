"use client";

import { useTranslations } from "next-intl";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { CheckoutAddressFormValues } from "@/lib/schemas/checkout";
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import { FieldError } from "./atoms";

// Nhóm trường địa chỉ dùng chung cho cả billing và shipping — markup y hệt
// form-checkout.php, chỉ khác idPrefix / autoComplete / form instance và việc
// billing có thêm trường email (shipping không có).
export function CheckoutAddressFields({
  idPrefix,
  autoCompletePrefix,
  register,
  errors,
  includeEmail,
  vnValue,
  onVnChange,
}: {
  idPrefix: "billing" | "shipping";
  autoCompletePrefix: "" | "shipping ";
  register: UseFormRegister<CheckoutAddressFormValues>;
  errors: FieldErrors<CheckoutAddressFormValues>;
  includeEmail: boolean;
  vnValue: { province: string; ward: string };
  onVnChange: (field: keyof CheckoutAddressFormValues, value: string) => void;
}) {
  const t = useTranslations("Checkout");
  const reqMark = <span className="required">*</span>;

  return (
    <>
      <div className="bb-co-field-row">
        <div className="bb-co-field">
          <label htmlFor={`${idPrefix}_full_name`}>
            {t("fullName")} {reqMark}
          </label>
          <input
            id={`${idPrefix}_full_name`}
            className="form-control"
            placeholder={t("fullNamePlaceholder")}
            autoComplete={`${autoCompletePrefix}name`}
            aria-invalid={!!errors.fullName}
            {...register("fullName")}
          />
          <FieldError message={errors.fullName?.message} />
        </div>

        <div className="bb-co-field">
          <label htmlFor={`${idPrefix}_phone`}>
            {t("phone")} {reqMark}
          </label>
          <input
            id={`${idPrefix}_phone`}
            type="tel"
            inputMode="tel"
            maxLength={12}
            className="form-control"
            placeholder={t("phonePlaceholder")}
            autoComplete={`${autoCompletePrefix}tel`}
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
          <FieldError message={errors.phone?.message} />
        </div>
      </div>

      {includeEmail && (
        <div className="bb-co-field">
          <label htmlFor={`${idPrefix}_email`}>
            {t("email")} {reqMark}
          </label>
          <input
            id={`${idPrefix}_email`}
            type="email"
            className="form-control"
            placeholder={t("emailPlaceholder")}
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </div>
      )}

      <div className="bb-co-field">
        <label htmlFor={`${idPrefix}_address_1`}>
          {t("address")} {reqMark}
        </label>
        <input
          id={`${idPrefix}_address_1`}
          className="form-control"
          placeholder={t("addressPlaceholder")}
          autoComplete={`${autoCompletePrefix}address-line1`}
          aria-invalid={!!errors.addressLine1}
          {...register("addressLine1")}
        />
        {idPrefix === "billing" && (
          <p className="hint">Ví dụ: 79/30/52 Âu Cơ, Phường Hòa Bình</p>
        )}
        <FieldError message={errors.addressLine1?.message} />
      </div>

      <div className="space-y-4 mb-[16px]">
        <VnAddressFields
          value={vnValue}
          onChange={onVnChange}
          required
          labelClassName="block text-ui-15 font-bold text-foreground mb-1.5"
        />
        {(errors.province || errors.ward) && (
          <FieldError message={errors.province?.message ?? errors.ward?.message} />
        )}
      </div>
    </>
  );
}
