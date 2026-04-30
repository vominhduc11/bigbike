"use client";

import { useMemo } from "react";
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

export function VnAddressFields({ value, onChange, required }: VnAddressFieldsProps) {
  const selectedProvince = useMemo(
    () => VN_PROVINCES.find((p) => p.name === value.province) ?? null,
    [value.province],
  );

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
        <input
          className={`wp-input${value.ward ? " filled" : ""}`}
          placeholder={value.district ? "Nhập phường / xã..." : "Chọn quận/huyện trước"}
          disabled={!value.district}
          value={value.ward}
          onChange={(e) => onChange("ward", e.target.value)}
        />
      </div>
    </>
  );
}
