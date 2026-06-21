"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CustomerAddress, SaveAddressPayload } from "@/lib/contracts/commerce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { VnAddressFields } from "@/components/ui/VnAddressFields";
import { FormNotice } from "@/components/ui/FormNotice";

// 2020-mockup field label: gray, sentence-case, red asterisk appended.
const LEGACY_LABEL = "text-caption text-muted-foreground";

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
  const [vnAddress, setVnAddress] = useState({
    province: editing?.province ?? "",
    district: editing?.district ?? "",
    ward: editing?.ward ?? "",
  });
  const [vnError, setVnError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vnAddress.province || !vnAddress.district || !vnAddress.ward) {
      setVnError(t("errorRequiredAddress"));
      return;
    }
    setVnError("");
    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string).trim();
    onSubmit({
      type: editing?.type ?? "SHIPPING",
      fullName: (fd.get("fullName") as string).trim(),
      phone: (fd.get("phone") as string).trim(),
      email: email || undefined,
      province: vnAddress.province,
      district: vnAddress.district,
      ward: vnAddress.ward,
      addressLine1: (fd.get("addressLine1") as string).trim(),
      isDefault: fd.get("isDefault") === "on",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      {error && (
        <FormNotice tone="danger" className="mb-4">{error}</FormNotice>
      )}

      <div className="grid grid-cols-1 gap-x-6 gap-y-[18px] sm:grid-cols-2 xl:gap-x-8">
        <div className="flex flex-col gap-1.5">
          <label className={LEGACY_LABEL}>{t("fullNameLabel")}<ReqMark /></label>
          <Input
            name="fullName"
            required
            defaultValue={editing?.fullName ?? ""}
            placeholder={t("fullNamePlaceholder")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LEGACY_LABEL}>{t("phoneLabel")}<ReqMark /></label>
          <Input
            name="phone"
            type="tel"
            required
            defaultValue={editing?.phone ?? ""}
            placeholder={t("phonePlaceholder")}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={LEGACY_LABEL}>{t("emailLabel")}</label>
          <Input
            type="email"
            name="email"
            defaultValue={editing?.email ?? accountEmail}
            placeholder={t("emailPlaceholder")}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={LEGACY_LABEL}>{t("addressLabel")}<ReqMark /></label>
          <Input
            name="addressLine1"
            required
            defaultValue={editing?.addressLine1 ?? ""}
            placeholder={t("addressPlaceholder")}
          />
        </div>
        <div className="sm:col-span-2 grid grid-cols-1 gap-x-6 gap-y-[18px] sm:grid-cols-3 xl:gap-x-8">
          {vnError && (
            <p className="sm:col-span-3 text-caption text-destructive">{vnError}</p>
          )}
          <VnAddressFields
            value={vnAddress}
            onChange={(field, val) => setVnAddress((prev) => ({ ...prev, [field]: val }))}
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
          <label className="flex items-center gap-2 text-caption text-muted-foreground">
            <Checkbox name="isDefault" defaultChecked={false} />
            {t("setDefault")}
          </label>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={saving}
          className="w-full sm:w-auto sm:min-w-[160px]"
        >
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}
