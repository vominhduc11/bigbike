"use client";

import { useMemo } from "react";
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

export function VnAddressFields({ value, onChange, required, labelClassName = "text-a5-meta font-semibold tracking-wide uppercase text-muted-foreground", selectContentClassName }: VnAddressFieldsProps) {
  const selectedProvince = useMemo(
    () => VN_PROVINCES.find((p) => p.name === value.province) ?? null,
    [value.province],
  );

  const wards = selectedProvince?.wards ?? [];

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={labelClassName}>
          {"Tỉnh / Thành phố"}{required && <span className="text-brand ml-[3px]">*</span>}
        </label>
        <Select
          required={required}
          value={value.province}
          onValueChange={(v) => {
            onChange("province", v);
            onChange("ward", "");
          }}
        >
          <SelectTrigger aria-label={"Tỉnh / Thành phố"}>
            <SelectValue placeholder={"— Chọn tỉnh / thành phố —"} />
          </SelectTrigger>
          <SelectContent className={cn("max-h-72", selectContentClassName)}>
            {VN_PROVINCES.map((p) => (
              <SelectItem key={p.code} value={p.name}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClassName}>{"Phường / Xã"}{required && <span className="text-brand ml-[3px]">*</span>}</label>
        {selectedProvince && wards.length > 0 ? (
          <Select
            required={required}
            value={value.ward}
            onValueChange={(v) => onChange("ward", v)}
          >
            <SelectTrigger aria-label={"Phường / Xã"}>
              <SelectValue placeholder={"— Chọn phường / xã —"} />
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
            placeholder={selectedProvince ? "Tên phường / xã..." : "Chọn tỉnh/thành phố trước"}
            disabled={!selectedProvince}
            autoComplete="address-level2"
          />
        )}
      </div>
    </>
  );
}
