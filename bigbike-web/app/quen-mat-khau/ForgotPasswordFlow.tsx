"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { requestPasswordReset, resetCustomerPassword } from "@/lib/api/client-api";
import { toLoginPath, toRegisterPath } from "@/lib/utils/routes";

type ForgotPasswordFlowProps = {
  token?: string | null;
};

export default function ForgotPasswordFlow({ token }: ForgotPasswordFlowProps) {
  const router = useRouter();
  const hasToken = useMemo(() => Boolean(token), [token]);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!login.trim()) {
      setError("Vui lòng nhập email hoặc số điện thoại.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await requestPasswordReset(login.trim());
      setSuccess("Nếu tài khoản tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu.");
      setLogin("");
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("Liên kết đặt lại mật khẩu không hợp lệ.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await resetCustomerPassword(token, password);
      setSuccess("Mật khẩu đã được thay đổi. Đang chuyển sang trang đăng nhập...");
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => router.replace(toLoginPath()), 1500);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bb-auth-wrap">
      <div className="bb-card" style={{ padding: "var(--bb-space-8)" }}>
        <header style={{ marginBottom: "var(--bb-space-6)", textAlign: "center" }}>
          <p className="bb-kicker">Tài khoản</p>
          <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}>
            {hasToken ? "Đặt lại mật khẩu" : "Quên mật khẩu"}
          </h1>
          <p className="bb-page-subtitle" style={{ marginInline: "auto" }}>
            {hasToken
              ? "Nhập mật khẩu mới để hoàn tất."
              : "Nhập email hoặc số điện thoại để nhận liên kết đặt lại mật khẩu."}
          </p>
        </header>

        {error ? (
          <p className="bb-status-banner" style={{ marginBottom: "var(--bb-space-4)" }}>
            {error}
          </p>
        ) : null}

        {success ? (
          <div className="bb-card" style={{ padding: "var(--bb-space-4)", marginBottom: "var(--bb-space-4)" }}>
            <p>{success}</p>
            {hasToken ? (
              <Link href={toLoginPath()} className="bb-link" style={{ display: "inline-block", marginTop: "var(--bb-space-3)" }}>
                Đi đến trang đăng nhập
              </Link>
            ) : null}
          </div>
        ) : null}

        {hasToken ? (
          <form onSubmit={handleResetSubmit} style={{ display: "grid", gap: "var(--bb-space-4)" }}>
            <label className="bb-form-label">
              Mật khẩu mới
              <input
                className="bb-input"
                required
                type="password"
                autoComplete="new-password"
                placeholder="Nhập mật khẩu mới"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="bb-form-label">
              Xác nhận mật khẩu
              <input
                className="bb-input"
                required
                type="password"
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="bb-button bb-button-primary"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={loading}
            >
              {loading ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestSubmit} style={{ display: "grid", gap: "var(--bb-space-4)" }}>
            <label className="bb-form-label">
              Email hoặc số điện thoại
              <input
                className="bb-input"
                required
                autoComplete="username"
                placeholder="email@example.com"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="bb-button bb-button-primary"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={loading}
            >
              {loading ? "Đang gửi..." : "Gửi liên kết đặt lại"}
            </button>
          </form>
        )}

        <div style={{ textAlign: "center", marginTop: "var(--bb-space-5)", color: "var(--bb-text-secondary)" }}>
          <Link href={toLoginPath()} className="bb-link">
            Quay lại đăng nhập
          </Link>
          {" "}
          <span aria-hidden="true">·</span>
          {" "}
          <Link href={toRegisterPath()} className="bb-link">
            Tạo tài khoản mới
          </Link>
        </div>
      </div>
    </div>
  );
}
