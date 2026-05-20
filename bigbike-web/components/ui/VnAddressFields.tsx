"use client";

import { useMemo } from "react";
import { VN_PROVINCES } from "@/lib/vn-address-data";
import { VN_WARDS } from "@/lib/vn-wards-static";
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
  district: string;
  ward: string;
};

type VnAddressFieldsProps = {
  value: AddressState;
  onChange: (field: keyof AddressState, value: string) => void;
  required?: boolean;
  labelClassName?: string;
  selectContentClassName?: string;
};

export function VnAddressFields({ value, onChange, required, labelClassName = "text-sm font-semibold tracking-[0.06em] uppercase text-muted-foreground", selectContentClassName }: VnAddressFieldsProps) {
  const selectedProvince = useMemo(
    () => VN_PROVINCES.find((p) => p.name === value.province) ?? null,
    [value.province],
  );

  const selectedDistrict = useMemo(
    () => selectedProvince?.districts.find((d) => d.name === value.district) ?? null,
    [selectedProvince, value.district],
  );

  const wards = useMemo(
    () => (selectedDistrict ? (VN_WARDS[selectedDistrict.code] ?? []) : []),
    [selectedDistrict],
  );

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={labelClassName}>
          {"T\u1ec9nh / Th\u00e0nh ph\u1ed1"}{required && <span className="text-brand ml-[3px]">*</span>}
        </label>
        <Select
          required={required}
          value={value.province}
          onValueChange={(v) => {
            onChange("province", v);
            onChange("district", "");
            onChange("ward", "");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={"\u2014 Ch\u1ecdn t\u1ec9nh / th\u00e0nh ph\u1ed1 \u2014"} />
          </SelectTrigger>
          <SelectContent className={cn("max-h-72", selectContentClassName)}>
            {VN_PROVINCES.map((p) => (
              <SelectItem key={p.code} value={p.name}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClassName}>{"Qu\u1eadn / Huy\u1ec7n"}{required && <span className="text-brand ml-[3px]">*</span>}</label>
        {selectedProvince ? (
          <Select
            required={required}
            value={value.district}
            onValueChange={(v) => {
              onChange("district", v);
              onChange("ward", "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={"\u2014 Ch\u1ecdn qu\u1eadn / huy\u1ec7n \u2014"} />
            </SelectTrigger>
            <SelectContent className={cn("max-h-72", selectContentClassName)}>
              {selectedProvince.districts.map((d) => (
                <SelectItem key={d.code} value={d.name}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input placeholder={"Ch\u1ecdn t\u1ec9nh/th\u00e0nh ph\u1ed1 tr\u01b0\u1edbc"} disabled />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={labelClassName}>{"Ph\u01b0\u1eddng / X\u00e3"}{required && <span className="text-brand ml-[3px]">*</span>}</label>
        {selectedDistrict && wards.length > 0 ? (
          <Select
            required={required}
            value={value.ward}
            onValueChange={(v) => onChange("ward", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={"\u2014 Ch\u1ecdn ph\u01b0\u1eddng / x\u00e3 \u2014"} />
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
            placeholder={selectedDistrict ? "T\u00ean ph\u01b0\u1eddng / x\u00e3..." : "Ch\u1ecdn qu\u1eadn/huy\u1ec7n tr\u01b0\u1edbc"}
            disabled={!selectedDistrict}
            autoComplete="address-level3"
          />
        )}
      </div>
    </>
  );
}
