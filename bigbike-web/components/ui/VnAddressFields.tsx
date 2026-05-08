"use client";

import { useEffect, useMemo, useState } from "react";
import { VN_PROVINCES } from "@/lib/vn-address-data";

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

  useEffect(() => {
    if (!selectedDistrict) {
      setWards([]);
      return;
    }
    setWardsLoading(true);
    fetchWards(selectedDistrict.code).then((w) => {
      setWards(w);
      setWardsLoading(false);
    });
  }, [selectedDistrict?.code]);

  return (
    <>
      <div className="wp-field">
        <label>
          Tỉnh / Thành phố{required && <span className="req"> *</span>}
        </label>
        <select
          className={`wp-input${value.province ? " filled" : ""}`}
          required={required}
          value={value.province}
          onChange={(e) => {
            onChange("province", e.target.value);
            onChange("district", "");
            onChange("ward", "");
          }}
        >
          <option value="">— Chọn tỉnh / thành phố —</option>
          {VN_PROVINCES.map((p) => (
            <option key={p.code} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="wp-field">
        <label>Quận / Huyện</label>
        {selectedProvince ? (
          <select
            className={`wp-input${value.district ? " filled" : ""}`}
            value={value.district}
            onChange={(e) => {
              onChange("district", e.target.value);
              onChange("ward", "");
            }}
          >
            <option value="">— Chọn quận / huyện —</option>
            {selectedProvince.districts.map((d) => (
              <option key={d.code} value={d.name}>{d.name}</option>
            ))}
          </select>
        ) : (
          <input
            className="wp-input"
            placeholder="Chọn tỉnh/thành phố trước"
            disabled
            value=""
            readOnly
          />
        )}
      </div>

      <div className="wp-field">
        <label>Phường / Xã</label>
        {selectedDistrict ? (
          <select
            className={`wp-input${value.ward ? " filled" : ""}`}
            value={value.ward}
            disabled={wardsLoading}
            onChange={(e) => onChange("ward", e.target.value)}
          >
            <option value="">
              {wardsLoading ? "Đang tải..." : "— Chọn phường / xã —"}
            </option>
            {wards.map((w) => (
              <option key={w.code} value={w.name}>{w.name}</option>
            ))}
          </select>
        ) : (
          <input
            className="wp-input"
            placeholder="Chọn quận/huyện trước"
            disabled
            value=""
            readOnly
          />
        )}
      </div>
    </>
  );
}
