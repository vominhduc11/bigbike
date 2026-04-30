"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AccountShell } from "@/components/layout/AccountShell";
import { createAddress, deleteAddress, fetchMyAddresses, updateAddress } from "@/lib/api/client-api";
import type { CustomerAddress, SaveAddressPayload } from "@/lib/contracts/commerce";

type Props = { params: Promise<{ type: string }> };

type ValidAddressType = "billing" | "shipping";

function InvalidAddressType({ type }: { type: string }) {
  return (
    <>
      <div className="wp-account-header">
        <div>
          <h2>Địa chỉ không hợp lệ</h2>
          <p className="sub">Loại địa chỉ không được hỗ trợ.</p>
        </div>
      </div>
      <div className="wp-empty-state">
        <p className="wp-muted-text">
          Không tìm thấy loại địa chỉ &ldquo;{type}&rdquo;.{" "}
          <Link href="/tai-khoan" style={{ color: "var(--bb-brand-primary, #F90606)" }}>
            Quay lại tài khoản
          </Link>
        </p>
      </div>
    </>
  );
}

function EditAddressContent({ type }: { type: ValidAddressType }) {
  const addressType = type === "billing" ? "BILLING" : "SHIPPING";
  const label = addressType === "BILLING" ? "Địa chỉ thanh toán" : "Địa chỉ giao hàng";

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CustomerAddress | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let ignore = false;
    fetchMyAddresses()
      .then((all) => { if (!ignore) setAddresses(all.filter((a) => a.type === addressType)); })
      .catch(() => { if (!ignore) setError("Không tải được danh sách địa chỉ."); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
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
        <div className="wp-alert-success">
          <p>{success}</p>
        </div>
      )}
      {error && (
        <div className="wp-alert-error">
          <p>{error}</p>
        </div>
      )}

      {/* Address list */}
      {loading ? (
        <div className="wp-address-grid" aria-busy="true" style={{ marginBottom: 20 }}>
          {[1, 2].map((i) => (
            <div key={i} className="wp-address-card">
              <span className="bb-skel bb-skel--title bb-skel-w-50" />
              <span className="bb-skel bb-skel--text bb-skel-w-40" style={{ marginTop: 8 }} />
              <span className="bb-skel bb-skel--text bb-skel-w-100" style={{ marginTop: 10 }} />
              <span className="bb-skel bb-skel--text bb-skel-w-80" style={{ marginTop: 4 }} />
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 10 }}>
                <span className="bb-skel bb-skel--text" style={{ width: 60 }} />
                <span className="bb-skel bb-skel--text" style={{ width: 40 }} />
              </div>
            </div>
          ))}
        </div>
      ) : addresses.length > 0 ? (
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
      ) : !showForm ? (
        <div style={{ marginBottom: 20 }}>
          <button type="button" className="wp-address-add" onClick={startAdd}>+ Thêm địa chỉ mới</button>
        </div>
      ) : null}

      {/* Form */}
      {showForm && (
        <div className="wp-info-card-form">
          <p className="wp-info-label" style={{ marginBottom: 18 }}>
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
            <div className="wp-form-actions">
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
  const isValid = type === "billing" || type === "shipping";
  return (
    <AccountShell loginRedirect={`/tai-khoan/edit-address/${type}`}>
      {isValid
        ? <EditAddressContent type={type as ValidAddressType} />
        : <InvalidAddressType type={type} />
      }
    </AccountShell>
  );
}
