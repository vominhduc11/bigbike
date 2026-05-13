"use client";

import { useEffect, useMemo, useState } from "react";
import { VN_PROVINCES } from "@/lib/vn-address-data";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AddressState = {
  province: string;
  district: string;
  ward: string;
};

type VnAddressFieldsProps = {
  value: AddressState;
  onChange: (field: keyof AddressState, value: string) => void;
  required?: boolean;
};

type Ward = { code: string; name: string };

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

async function fetchWards(districtCode: string): Promise<Ward[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/address/districts/${districtCode}/wards`);
    if (!res.ok) return [];
    const payload = await res.json();
    return (payload.data as Ward[]) ?? [];
  } catch {
    return [];
  }
}

export function VnAddressFields({ value, onChange, required }: VnAddressFieldsProps) {
  const selectedProvince = useMemo(
    () => VN_PROVINCES.find((p) => p.name === value.province) ?? null,
    [value.province],
  );

  const selectedDistrict = useMemo(
    () => selectedProvince?.districts.find((d) => d.name === value.district) ?? null,
    [selectedProvince, value.district],
  );

  const [wards, setWards] = useState<Ward[]>([]);
  const [wardsLoading, setWardsLoading] = useState(false);

  // Extract primitive so dep array is stable and effect closure doesn't capture the object
  const districtCode = selectedDistrict?.code ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!districtCode) {
        if (!cancelled) { setWards([]); setWardsLoading(false); }
        return;
      }
      if (!cancelled) setWardsLoading(true);
      const w = await fetchWards(districtCode);
      if (!cancelled) { setWards(w); setWardsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [districtCode]);

  return (
    <>
      <div className="wp-field">
        <label>
          Tỉnh / Thành phố{required && <span className="req"> *</span>}
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
            <SelectValue placeholder="— Chọn tỉnh / thành phố —" />
          </SelectTrigger>
          <SelectContent>
            {VN_PROVINCES.map((p) => (
              <SelectItem key={p.code} value={p.name}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="wp-field">
        <label>Quận / Huyện</label>
        {selectedProvince ? (
          <Select
            value={value.district}
            onValueChange={(v) => {
              onChange("district", v);
              onChange("ward", "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="— Chọn quận / huyện —" />
            </SelectTrigger>
            <SelectContent>
              {selectedProvince.districts.map((d) => (
                <SelectItem key={d.code} value={d.name}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input placeholder="Chọn tỉnh/thành phố trước" disabled />
        )}
      </div>

      <div className="wp-field">
        <label>Phường / Xã</label>
        {selectedDistrict ? (
          <Select
            value={value.ward}
            disabled={wardsLoading}
            onValueChange={(v) => onChange("ward", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={wardsLoading ? "Đang tải..." : "— Chọn phường / xã —"} />
            </SelectTrigger>
            <SelectContent>
              {wards.map((w) => (
                <SelectItem key={w.code} value={w.name}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input placeholder="Chọn quận/huyện trước" disabled />
        )}
      </div>
    </>
  );
}
