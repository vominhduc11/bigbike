"use client";

import { useTranslations } from "next-intl";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { CheckoutAddressFormValues } from "@/lib/schemas/checkout";
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import { Input } from "@/components/ui/input";
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
  const reqMark = <span className="text-brand">*</span>;
  const fieldClass = "flex flex-col gap-1.5";
  const labelClass = "font-body text-caption font-bold text-foreground";

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className={fieldClass}>
          <label htmlFor={`${idPrefix}_full_name`} className={labelClass}>
            {t("fullName")} {reqMark}
          </label>
          <Input
            id={`${idPrefix}_full_name`}
            placeholder={t("fullNamePlaceholder")}
            autoComplete={`${autoCompletePrefix}name`}
            aria-invalid={!!errors.fullName}
            {...register("fullName")}
          />
          <FieldError message={errors.fullName?.message} />
        </div>

        <div className={fieldClass}>
          <label htmlFor={`${idPrefix}_phone`} className={labelClass}>
            {t("phone")} {reqMark}
          </label>
          <Input
            id={`${idPrefix}_phone`}
            type="tel"
            inputMode="tel"
            maxLength={12}
            placeholder={t("phonePlaceholder")}
            autoComplete={`${autoCompletePrefix}tel`}
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
          <FieldError message={errors.phone?.message} />
        </div>
      </div>

      {includeEmail && (
        <div className={fieldClass}>
          <label htmlFor={`${idPrefix}_email`} className={labelClass}>
            {t("email")} {reqMark}
          </label>
          <Input
            id={`${idPrefix}_email`}
            type="email"
            placeholder={t("emailPlaceholder")}
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </div>
      )}

      <div className={fieldClass}>
        <label htmlFor={`${idPrefix}_address_1`} className={labelClass}>
          {t("address")} {reqMark}
        </label>
        <Input
          id={`${idPrefix}_address_1`}
          placeholder={t("addressPlaceholder")}
          autoComplete={`${autoCompletePrefix}address-line1`}
          aria-invalid={!!errors.addressLine1}
          {...register("addressLine1")}
        />
        {idPrefix === "billing" && (
          <p className="m-0 text-caption text-muted-foreground">{t("addressExampleHint")}</p>
        )}
        <FieldError message={errors.addressLine1?.message} />
      </div>

      <div className="mb-4 space-y-4">
        <VnAddressFields
          value={vnValue}
          onChange={onVnChange}
          required
          labelClassName={labelClass}
        />
        {(errors.province || errors.ward) && (
          <FieldError message={errors.province?.message ?? errors.ward?.message} />
        )}
      </div>
    </>
  );
}
