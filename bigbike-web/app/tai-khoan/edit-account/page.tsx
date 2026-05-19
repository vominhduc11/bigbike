"use client";

import { useState } from "react";
import { CircleUser } from "lucide-react";
import { AccountSectionHeading, AccountShell, useAccount, useAccountRefresh } from "@/components/layout/AccountShell";
import { updateCustomerProfile } from "@/lib/api/client-api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

// 2020-mockup field label: gray, sentence-case.
const LEGACY_LABEL = "text-sm text-[#555555]";

function ReqMark() {
  return <span className="text-brand">*</span>;
}

function EditAccountContent() {
  const profile = useAccount();
  const refreshProfile = useAccountRefresh();

  const [showPassword, setShowPassword] = useState(false);
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
    const email = (fd.get("email") as string).trim();
    const currentPassword = ((fd.get("currentPassword") as string) ?? "").trim();
    const newPassword = ((fd.get("newPassword") as string) ?? "").trim();
    const confirmPassword = ((fd.get("confirmPassword") as string) ?? "").trim();
    const newsletterSubscribed = fd.get("newsletter") === "on";

    const newEmailValue = email && email !== (profile?.email ?? "") ? email : undefined;
    const isSensitiveChange = !!newPassword || !!newEmailValue;

    if (newPassword) {
      if (newPassword.length < 8) {
        setPasswordError("Mật khẩu mới phải có ít nhất 8 ký tự.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError("Mật khẩu xác nhận không khớp.");
        return;
      }
    }

    if (isSensitiveChange && !currentPassword) {
      setPasswordError("Vui lòng nhập mật khẩu hiện tại để thay đổi email hoặc mật khẩu.");
      return;
    }

    setSaving(true);
    try {
      await updateCustomerProfile({
        displayName: displayName || undefined,
        email: newEmailValue,
        currentPassword: isSensitiveChange ? currentPassword : undefined,
        newPassword: newPassword || undefined,
        newsletterSubscribed,
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
      <AccountSectionHeading
        title="Thông tin tài khoản"
        icon={<CircleUser className="h-7 w-7" strokeWidth={1.5} aria-hidden />}
      />

      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
        Từ trang Tài khoản, bạn có thể xem nhanh hoạt động mua hàng gần đây và cập nhật
        thông tin cá nhân của mình. Chọn một mục bên dưới để xem hoặc chỉnh sửa.
      </p>

      {success && (
        <div className="bg-[var(--bb-state-success-bg)] border border-[var(--bb-state-success-border)] p-[12px_16px] mb-5 text-sm text-[var(--bb-state-success-text)]">
          Thông tin đã được cập nhật.
        </div>
      )}
      {error && (
        <div className="bg-[var(--bb-state-danger-bg)] border border-[var(--bb-state-danger-border)] p-[12px_16px] mb-5 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-x-6 gap-y-[18px] sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className={LEGACY_LABEL}>Họ và tên</label>
            <Input name="displayName" defaultValue={profile?.displayName ?? ""} placeholder="Họ và tên" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LEGACY_LABEL}>Email</label>
            <Input type="email" name="email" defaultValue={profile?.email ?? ""} placeholder="email@example.com" />
          </div>
        </div>

        <label className="mt-5 flex w-fit items-center gap-2 text-sm text-[#555555]">
          <Checkbox name="newsletter" defaultChecked={profile?.newsletterSubscribed ?? false} />
          Đăng ký nhận tin
        </label>

        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="mt-3 flex items-center gap-2.5 text-sm text-[#555555]"
          aria-pressed={showPassword}
        >
          <span
            className={`flex h-[18px] w-[18px] items-center justify-center rounded-full border ${
              showPassword ? "border-brand" : "border-[#bbbbbb]"
            }`}
          >
            {showPassword && <span className="h-2 w-2 rounded-full bg-brand" />}
          </span>
          Thay đổi mật khẩu
        </button>

        {showPassword && (
          <div className="mt-4">
            <p className="mb-3 text-sm text-muted-foreground">
              Xin vui lòng điền chính xác các thông tin để bảo vệ tài khoản Bigbike.
            </p>
            <div className="grid grid-cols-1 gap-x-6 gap-y-[18px] sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label className={LEGACY_LABEL}>Mật khẩu hiện tại<ReqMark /></label>
                <Input
                  type="password"
                  name="currentPassword"
                  placeholder="Vui lòng nhập mật khẩu hiện tại..."
                  autoComplete="current-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={LEGACY_LABEL}>Nhập mật khẩu mới<ReqMark /></label>
                <Input
                  type="password"
                  name="newPassword"
                  placeholder="Vui lòng nhập mật khẩu mới..."
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={LEGACY_LABEL}>Xác nhận mật khẩu mới<ReqMark /></label>
                <Input
                  type="password"
                  name="confirmPassword"
                  placeholder="Vui lòng xác nhận mật khẩu mới..."
                  autoComplete="new-password"
                />
              </div>
            </div>
            {passwordError && <p className="mt-2 text-sm text-destructive">{passwordError}</p>}
          </div>
        )}

        <Button type="submit" variant="primary" disabled={saving} className="mt-6 min-w-[160px]">
          {saving ? "Đang lưu..." : "Cập nhật"}
        </Button>
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
