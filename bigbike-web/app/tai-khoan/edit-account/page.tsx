"use client";

import { useState } from "react";
import { AccountShell, useAccount, useAccountRefresh } from "@/components/layout/AccountShell";
import { updateCustomerProfile } from "@/lib/api/client-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function EditAccountContent() {
  const profile = useAccount();
  const refreshProfile = useAccountRefresh();

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setPasswordError("");

    const fd = new FormData(e.currentTarget);
    const displayName = (fd.get("displayName") as string).trim();
    const phone = (fd.get("phone") as string).trim();
    const email = (fd.get("email") as string).trim();
    const currentPassword = (fd.get("currentPassword") as string).trim();
    const newPassword = (fd.get("newPassword") as string).trim();
    const confirmPassword = (fd.get("confirmPassword") as string).trim();
    const gender = (fd.get("gender") as string).trim();
    const dob = (fd.get("dob") as string).trim();

    if (newPassword) {
      if (!currentPassword) {
        setPasswordError("Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu.");
        return;
      }
      if (newPassword.length < 8) {
        setPasswordError("Mật khẩu mới phải có ít nhất 8 ký tự.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError("Mật khẩu xác nhận không khớp.");
        return;
      }
    }

    setSaving(true);
    try {
      await updateCustomerProfile({
        displayName: displayName || undefined,
        phone: phone || undefined,
        email: email || undefined,
        currentPassword: newPassword && currentPassword ? currentPassword : undefined,
        newPassword: newPassword || undefined,
        gender: gender || undefined,
        dob: dob || undefined,
      });
      await refreshProfile?.();
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="wp-account-header">
        <div>
          <h2>Tài khoản</h2>
          <p className="sub">Thông tin cá nhân</p>
        </div>
      </div>

      {success && (
        <div className="wp-alert-success">
          <p>Thông tin đã được cập nhật.</p>
        </div>
      )}

      {error && (
        <div className="wp-alert-error">
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="wp-info-card-form">
          <p className="wp-info-label">Thông tin tài khoản</p>
          <div className="wp-form-grid">
            <div className="wp-field">
              <label>Họ tên</label>
              <Input type="text" name="displayName" defaultValue={profile?.displayName ?? ""} placeholder="Họ và tên" />
            </div>
            <div className="wp-field">
              <label>Số điện thoại</label>
              <Input type="tel" name="phone" defaultValue={profile?.phone ?? ""} placeholder="0901234567" />
            </div>
            <div className="wp-field">
              <label>Email</label>
              <Input type="email" name="email" defaultValue={profile?.email ?? ""} placeholder="email@example.com" />
            </div>
            <div className="wp-field">
              <label>Giới tính</label>
              <select className="wp-input" name="gender" defaultValue={profile?.gender ?? ""}>
                <option value="">-- Chọn --</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>
            <div className="wp-field">
              <label>Ngày sinh</label>
              <Input type="date" name="dob" defaultValue={profile?.dob ?? ""} />
            </div>
          </div>

          <p className="wp-info-label" style={{ marginTop: 24 }}>Đổi mật khẩu (để trống nếu không đổi)</p>
          <div className="wp-form-grid">
            <div className="wp-field">
              <label>Mật khẩu hiện tại</label>
              <Input type="password" name="currentPassword" placeholder="••••••••" autoComplete="current-password" />
            </div>
            <div className="wp-field">
              <label>Mật khẩu mới</label>
              <Input type="password" name="newPassword" placeholder="••••••••" autoComplete="new-password" />
            </div>
            <div className="wp-field">
              <label>Xác nhận mật khẩu mới</label>
              <Input type="password" name="confirmPassword" placeholder="••••••••" autoComplete="new-password" />
            </div>
          </div>
          {passwordError && (
            <p className="text-sm text-destructive mt-1.5">{passwordError}</p>
          )}

          <Button type="submit" variant="primary" className="mt-5" disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </form>
    </>
  );
}

export default function EditAccountPage() {
  return (
    <AccountShell loginRedirect="/tai-khoan/edit-account/">
      <EditAccountContent />
    </AccountShell>
  );
}
