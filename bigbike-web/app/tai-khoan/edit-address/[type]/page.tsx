"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AccountShell } from "@/components/layout/AccountShell";
import { createAddress, deleteAddress, fetchMyAddresses, updateAddress } from "@/lib/api/client-api";
import type { CustomerAddress, SaveAddressPayload } from "@/lib/contracts/commerce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { VnAddressFields } from "@/components/ui/VnAddressFields";

type Props = { params: Promise<{ type: string }> };

type ValidAddressType = "billing" | "shipping";

function InvalidAddressType({ type }: { type: string }) {
  return (
    <>
      <div className="flex justify-between items-end mb-5 pb-4 border-b border-border">
        <div>
          <h2 className="font-display uppercase text-[26px] tracking-[0.01em] m-0 text-foreground">Địa chỉ không hợp lệ</h2>
          <p className="text-xs text-muted-foreground mt-1 m-0">Loại địa chỉ không được hỗ trợ.</p>
        </div>
      </div>
      <div className="text-center py-[60px] text-muted-foreground">
        <p className="text-muted-foreground text-sm m-0">
          Không tìm thấy loại địa chỉ &ldquo;{type}&rdquo;.{" "}
          <Link href="/tai-khoan/" className="bb-link">
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
  const [vnAddress, setVnAddress] = useState({ province: "", district: "", ward: "" });

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
    setVnAddress({ province: "", district: "", ward: "" });
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function startEdit(addr: CustomerAddress) {
    setEditing(addr);
    setVnAddress({ province: addr.province ?? "", district: addr.district ?? "", ward: addr.ward ?? "" });
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function cancelForm() {
    setEditing(null);
    setVnAddress({ province: "", district: "", ward: "" });
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
      province: vnAddress.province,
      district: vnAddress.district,
      ward: vnAddress.ward,
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
      <div className="flex justify-between items-end mb-5 pb-4 border-b border-border">
        <div>
          <h2 className="font-display uppercase text-[26px] tracking-[0.01em] m-0 text-foreground">Địa chỉ</h2>
          <p className="text-xs text-muted-foreground mt-1 m-0">{label}</p>
        </div>
      </div>

      {success && (
        <div className="bg-[var(--bb-state-success-bg)] border border-[var(--bb-state-success-border)] p-[14px_18px] mb-5 text-sm text-[var(--bb-state-success-text)]">
          <p className="m-0">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-[var(--bb-state-danger-bg)] border border-[var(--bb-state-danger-border)] p-[14px_18px] mb-5 text-sm text-destructive">
          <p className="m-0">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 mb-5" aria-busy="true">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card border border-border p-[18px_20px] relative">
              <span className="bb-skel bb-skel--title bb-skel-w-50" />
              <span className="bb-skel bb-skel--text bb-skel-w-40" style={{ marginTop: 8 }} />
              <span className="bb-skel bb-skel--text bb-skel-w-100" style={{ marginTop: 10 }} />
              <span className="bb-skel bb-skel--text bb-skel-w-80" style={{ marginTop: 4 }} />
              <div className="mt-3.5 flex gap-2.5 border-t border-border pt-3">
                <span className="bb-skel bb-skel--text" style={{ width: 60 }} />
                <span className="bb-skel bb-skel--text" style={{ width: 40 }} />
              </div>
            </div>
          ))}
        </div>
      ) : addresses.length > 0 ? (
        <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 mb-5">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`bg-card border p-[18px_20px] relative${addr.isDefault ? " border-[rgba(255,12,9,0.36)]" : " border-border"}`}
            >
              {addr.isDefault && (
                <span className="absolute top-[14px] right-[14px] bg-brand text-white text-[9px] px-[7px] py-[3px] tracking-[0.1em] font-bold uppercase">
                  Mặc định
                </span>
              )}
              <b className="block font-display text-sm tracking-[0.04em] uppercase text-foreground mb-1">{addr.fullName ?? "—"}</b>
              {addr.phone && <p className="text-[11px] text-muted-foreground tracking-[0.04em] mb-[10px] m-0">{addr.phone}</p>}
              <p className="text-xs text-muted-foreground leading-[1.5] m-0 mb-[14px]">
                {[addr.addressLine1, addr.ward, addr.district, addr.province].filter(Boolean).join(", ") || "Chưa có địa chỉ"}
              </p>
              <div className="flex gap-2 pt-3 border-t border-border">
                <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(addr)}>Chỉnh sửa</Button>
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => handleDelete(addr.id)}>Xóa</Button>
              </div>
            </div>
          ))}
          {!showForm && (
            <Button
              type="button"
              variant="ghost"
              className="border border-dashed border-[var(--bb-border-default)] flex items-center justify-center text-muted-foreground text-xs font-bold tracking-[0.1em] uppercase min-h-[160px] transition-all duration-150 hover:border-brand hover:text-brand w-full"
              onClick={startAdd}
            >
              + Thêm địa chỉ mới
            </Button>
          )}
        </div>
      ) : !showForm ? (
        <div className="mb-5">
          <Button
            type="button"
            variant="ghost"
            className="border border-dashed border-[var(--bb-border-default)] flex items-center justify-center text-muted-foreground text-xs font-bold tracking-[0.1em] uppercase min-h-[160px] transition-all duration-150 hover:border-brand hover:text-brand w-full"
            onClick={startAdd}
          >
            + Thêm địa chỉ mới
          </Button>
        </div>
      ) : null}

      {showForm && (
        <div className="bg-card border border-border p-[22px_24px]">
          <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[18px]">
            {editing ? `Chỉnh sửa — ${label}` : `Thêm — ${label}`}
          </p>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">Họ tên *</label>
                <Input type="text" name="fullName" required defaultValue={editing?.fullName ?? ""} placeholder="Họ và tên" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">Số điện thoại *</label>
                <Input type="tel" name="phone" required defaultValue={editing?.phone ?? ""} placeholder="0901234567" />
              </div>
              <VnAddressFields
                value={vnAddress}
                onChange={(field, val) => setVnAddress((prev) => ({ ...prev, [field]: val }))}
                labelClassName="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground"
              />
              <div className="flex flex-col gap-1.5 col-span-full">
                <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">Địa chỉ *</label>
                <Input type="text" name="addressLine1" required defaultValue={editing?.addressLine1 ?? ""} placeholder="Số nhà, tên đường..." />
              </div>
              <div className="flex items-center gap-2 col-span-full">
                <Checkbox name="isDefault" id="isDefault" defaultChecked={editing?.isDefault ?? false} />
                <label htmlFor="isDefault" className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground m-0">Đặt làm địa chỉ mặc định</label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu địa chỉ"}
              </Button>
              <Button type="button" variant="secondary" onClick={cancelForm}>Hủy</Button>
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
    <AccountShell loginRedirect={`/tai-khoan/edit-address/${type}/`}>
      {isValid
        ? <EditAddressContent type={type as ValidAddressType} />
        : <InvalidAddressType type={type} />
      }
    </AccountShell>
  );
}
