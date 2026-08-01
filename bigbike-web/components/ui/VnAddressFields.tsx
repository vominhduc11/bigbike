"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { VN_PROVINCES } from "@/lib/vn-address-data";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type AddressState = {
  province: string;
  ward: string;
};

type VnAddressFieldsProps = {
  value: AddressState;
  onChange: (field: keyof AddressState, value: string) => void;
  required?: boolean;
  labelClassName?: string;
  selectContentClassName?: string;
};

export function VnAddressFields({ value, onChange, required, labelClassName = "font-body text-a5-meta font-semibold text-muted-foreground", selectContentClassName }: VnAddressFieldsProps) {
  const t = useTranslations("AddressFields");
  const selectedProvince = useMemo(
    () => VN_PROVINCES.find((p) => p.name === value.province) ?? null,
    [value.province],
  );

  const wards = selectedProvince?.wards ?? [];

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={labelClassName}>
          {t("provinceLabel")}{required && <span className="text-brand ml-[3px]">*</span>}
        </label>
        <Select
          required={required}
          value={value.province}
          onValueChange={(v) => {
            onChange("province", v);
            onChange("ward", "");
          }}
        >
          <SelectTrigger aria-label={t("provinceLabel")}>
            <SelectValue placeholder={t("provincePlaceholder")} />
          </SelectTrigger>
          <SelectContent className={cn("max-h-72", selectContentClassName)}>
            {VN_PROVINCES.map((p) => (
              <SelectItem key={p.code} value={p.name}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClassName}>{t("wardLabel")}{required && <span className="text-brand ml-[3px]">*</span>}</label>
        {selectedProvince && wards.length > 0 ? (
          <Select
            required={required}
            value={value.ward}
            onValueChange={(v) => onChange("ward", v)}
          >
            <SelectTrigger aria-label={t("wardLabel")}>
              <SelectValue placeholder={t("wardPlaceholder")} />
            </SelectTrigger>
            <SelectContent className={cn("max-h-72", selectContentClassName)}>
              {wards.map((w) => (
                <SelectItem key={w.code} value={w.name}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={value.ward}
            onChange={(e) => onChange("ward", e.target.value)}
            placeholder={selectedProvince ? t("wardInputPlaceholder") : t("provinceFirstPlaceholder")}
            disabled={!selectedProvince}
            autoComplete="address-level2"
          />
        )}
      </div>
    </>
  );
}
