"use client";

import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CustomerAddress, SaveAddressPayload } from "@/lib/contracts/commerce";
import { createAddressSchema, type AddressFormValues } from "@/lib/schemas/customer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import { FormNotice } from "@/components/ui/FormNotice";

// 2020-mockup field label: gray, sentence-case, red asterisk appended.
const LEGACY_LABEL = "text-a5-meta text-muted-foreground";

function ReqMark() {
  return <span className="text-brand">*</span>;
}

type AddressFormProps = {
  editing: CustomerAddress | null;
  accountEmail: string;
  saving: boolean;
  error: string;
  onSubmit: (payload: SaveAddressPayload) => void;
};

/** Form thêm/sửa địa chỉ (trong popup). Validate tỉnh/huyện/xã ở client; ô "đặt mặc định" chỉ khi THÊM mới. */
export function AddressForm({ editing, accountEmail, saving, error, onSubmit }: AddressFormProps) {
  const t = useTranslations("Account.addresses");
  const tValidation = useTranslations("FormValidation");
  const addressValidation = (key: string) => key === "required" ? t("errorRequiredAddress") : tValidation(key);
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<AddressFormValues>({
    resolver: zodResolver(createAddressSchema(addressValidation)),
    defaultValues: {
      type: editing?.type === "BILLING" ? "BILLING" : "SHIPPING",
      fullName: editing?.fullName ?? "",
      phone: editing?.phone ?? "",
      email: editing?.email ?? accountEmail,
      province: editing?.province ?? "",
      ward: editing?.ward ?? "",
      addressLine1: editing?.addressLine1 ?? "",
      isDefault: false,
    },
  });
  const vnAddress = useWatch({ control, name: ["province", "ward"] });

  function submit(values: AddressFormValues) {
    onSubmit({
      ...values,
      email: values.email || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="p-6" noValidate>
      {error && (
        <FormNotice tone="danger" className="mb-4">{error}</FormNotice>
      )}

      <div className="grid grid-cols-1 gap-x-6 gap-y-4.5 sm:grid-cols-2 xl:gap-x-8">
        <div className="flex flex-col gap-1.5">
          <label className={LEGACY_LABEL}>{t("fullNameLabel")}<ReqMark /></label>
          <Input
            {...register("fullName")}
            placeholder={t("fullNamePlaceholder")}
          />
          {errors.fullName && <p className="text-a4-content text-destructive">{errors.fullName.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LEGACY_LABEL}>{t("phoneLabel")}<ReqMark /></label>
          <Input
            {...register("phone")}
            type="tel"
            placeholder={t("phonePlaceholder")}
          />
          {errors.phone && <p className="text-a4-content text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={LEGACY_LABEL}>{t("emailLabel")}</label>
          <Input
            type="email"
            {...register("email")}
            placeholder={t("emailPlaceholder")}
          />
          {errors.email && <p className="text-a4-content text-destructive">{errors.email.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={LEGACY_LABEL}>{t("addressLabel")}<ReqMark /></label>
          <Input
            {...register("addressLine1")}
            placeholder={t("addressPlaceholder")}
          />
          {errors.addressLine1 && <p className="text-a4-content text-destructive">{errors.addressLine1.message}</p>}
        </div>
        <div className="sm:col-span-2 grid grid-cols-1 gap-x-6 gap-y-4.5 sm:grid-cols-3 xl:gap-x-8">
          {(errors.province || errors.ward) && (
            <p className="sm:col-span-3 text-a4-content text-destructive">{errors.province?.message ?? errors.ward?.message}</p>
          )}
          <VnAddressFields
            value={{ province: vnAddress[0], ward: vnAddress[1] }}
            onChange={(field, value) => setValue(field, value, { shouldValidate: true })}
            required
            labelClassName={LEGACY_LABEL}
            selectContentClassName="z-[var(--bb-z-modal-dropdown)]"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {/* Default-address toggle only on "add" — the 2020 edit modal has none;
            an existing address is made default via the card's "Đặt mặc định" button. */}
        {!editing && (
          <label className="flex items-center gap-2 text-a5-meta text-muted-foreground">
            <Controller name="isDefault" control={control} render={({ field }) => (
              <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
            )} />
            {t("setDefault")}
          </label>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={saving}
          className="w-full sm:w-auto sm:min-w-40"
        >
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
