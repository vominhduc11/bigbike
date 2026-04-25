"use client";

import { use, useEffect, useState } from "react";
import { AccountShell } from "@/components/layout/AccountShell";
import { createAddress, deleteAddress, fetchMyAddresses, updateAddress } from "@/lib/api/client-api";
import type { CustomerAddress, SaveAddressPayload } from "@/lib/contracts/commerce";

type Props = { params: Promise<{ type: string }> };

function EditAddressContent({ type }: { type: string }) {
  const addressType = type === "billing" ? "BILLING" : "SHIPPING";
  const label = addressType === "BILLING" ? "Địa chỉ thanh toán" : "Địa chỉ giao hàng";

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [editing, setEditing] = useState<CustomerAddress | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchMyAddresses()
      .then((all) => setAddresses(all.filter((a) => a.type === addressType)))
      .catch(() => setError("Không tải được danh sách địa chỉ."));
  }, [addressType]);

  function startAdd() {
    setEditing(null);
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function startEdit(addr: CustomerAddress) {
    setEditing(addr);
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function cancelForm() {
    setEditing(null);
    setShowForm(false);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const fd = new FormData(e.currentTarget);

    const payload: SaveAddressPayload = {
      type: addressType,
      fullName: (fd.get("fullName") as string).trim(),
      phone: (fd.get("phone") as string).trim(),
      province: (fd.get("province") as string).trim(),
      district: (fd.get("district") as string).trim(),
      ward: (fd.get("ward") as string).trim(),
      addressLine1: (fd.get("addressLine1") as string).trim(),
      isDefault: fd.get("isDefault") === "on",
    };

    setSaving(true);
    try {
      let updated: CustomerAddress;
      if (editing) {
        updated = await updateAddress(editing.id, payload);
        setAddresses((prev) => prev.map((a) => (a.id === editing.id ? updated : a)));
      } else {
        updated = await createAddress(payload);
        setAddresses((prev) => [...prev, updated]);
      }
      setSuccess(editing ? "Đã cập nhật địa chỉ." : "Đã thêm địa chỉ mới.");
      setEditing(null);
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Xóa địa chỉ này?")) return;
    try {
      await deleteAddress(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      setSuccess("Đã xóa địa chỉ.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không xóa được địa chỉ.");
    }
  }

  return (
    <>
      <div className="wp-account-header">
        <div>
          <h2>Địa chỉ</h2>
          <p className="sub">{label}</p>
        </div>
      </div>

      {success && (
        <div style={{ background: "rgba(98,187,70,0.1)", border: "1px solid rgba(98,187,70,0.3)", borderRadius: 8, padding: "14px 18px", marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "#62bb46", margin: 0 }}>{success}</p>
        </div>
      )}
      {error && (
        <div style={{ background: "rgba(249,6,6,0.08)", border: "1px solid rgba(249,6,6,0.25)", borderRadius: 8, padding: "14px 18px", marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Address list */}
      {addresses.length > 0 && (
        <div className="wp-address-grid" style={{ marginBottom: 20 }}>
          {addresses.map((addr) => (
            <div key={addr.id} className={`wp-address-card${addr.isDefault ? " default" : ""}`}>
              {addr.isDefault && <span className="default-tag">Mặc định</span>}
              <b>{addr.fullName ?? "—"}</b>
              {addr.phone && <p className="phone">{addr.phone}</p>}
              <p>{[addr.addressLine1, addr.ward, addr.district, addr.province].filter(Boolean).join(", ") || "Chưa có địa chỉ"}</p>
              <div className="actions">
                <button type="button" onClick={() => startEdit(addr)}>Chỉnh sửa</button>
                <button type="button" onClick={() => handleDelete(addr.id)} style={{ color: "var(--bb-text-muted)" }}>Xóa</button>
              </div>
            </div>
          ))}
          {!showForm && (
            <button type="button" className="wp-address-add" onClick={startAdd}>+ Thêm địa chỉ mới</button>
          )}
        </div>
      )}

      {addresses.length === 0 && !showForm && (
        <div style={{ marginBottom: 20 }}>
          <button type="button" className="wp-address-add" onClick={startAdd}>+ Thêm địa chỉ mới</button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "22px 24px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bb-text-muted)", marginBottom: 18 }}>
            {editing ? `Chỉnh sửa — ${label}` : `Thêm — ${label}`}
          </p>
          <form onSubmit={handleSubmit}>
            <div className="wp-form-grid">
              <div className="wp-field">
                <label>Họ tên *</label>
                <input className="wp-input" type="text" name="fullName" required defaultValue={editing?.fullName ?? ""} placeholder="Họ và tên" />
              </div>
              <div className="wp-field">
                <label>Số điện thoại *</label>
                <input className="wp-input" type="tel" name="phone" required defaultValue={editing?.phone ?? ""} placeholder="0901234567" />
              </div>
              <div className="wp-field">
                <label>Tỉnh / Thành phố</label>
                <input className="wp-input" type="text" name="province" defaultValue={editing?.province ?? ""} />
              </div>
              <div className="wp-field">
                <label>Quận / Huyện</label>
                <input className="wp-input" type="text" name="district" defaultValue={editing?.district ?? ""} />
              </div>
              <div className="wp-field">
                <label>Phường / Xã</label>
                <input className="wp-input" type="text" name="ward" defaultValue={editing?.ward ?? ""} />
              </div>
              <div className="wp-field" style={{ gridColumn: "1 / -1" }}>
                <label>Địa chỉ *</label>
                <input className="wp-input" type="text" name="addressLine1" required defaultValue={editing?.addressLine1 ?? ""} placeholder="Số nhà, tên đường..." />
              </div>
              <div className="wp-field" style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" name="isDefault" id="isDefault" defaultChecked={editing?.isDefault ?? false} />
                <label htmlFor="isDefault" style={{ margin: 0 }}>Đặt làm địa chỉ mặc định</label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button type="submit" className="wp-btn-primary" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu địa chỉ"}
              </button>
              <button type="button" className="wp-btn-secondary" onClick={cancelForm}>Hủy</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default function EditAddressPage({ params }: Props) {
  const { type } = use(params);
  return (
    <AccountShell loginRedirect={`/tai-khoan/edit-address/${type}`}>
      <EditAddressContent type={type} />
    </AccountShell>
  );
}
