"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerCustomer } from "@/lib/api/client-api";
import { toAccountPath, toLoginPath } from "@/lib/utils/routes";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await registerCustomer(email, phone, password, displayName);
      setRegistered(true);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (registered) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <div className="bb-auth-wrap">
            <div className="bb-card bb-card-padded" style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: "var(--bb-space-4)" }}>✓</div>
              <h1 style={{ fontSize: "clamp(1.25rem, 3vw, 1.75rem)", marginBottom: "var(--bb-space-3)" }}>
                Tài khoản đã được tạo!
              </h1>
              {email && (
                <p className="bb-auth-footer" style={{ marginBottom: "var(--bb-space-5)" }}>
                  Chúng tôi đã gửi email xác nhận đến <strong style={{ color: "var(--bb-text-primary)" }}>{email}</strong>.
                  Vui lòng kiểm tra hộp thư (kể cả thư mục spam) để xác nhận tài khoản.
                </p>
              )}
              <button
                type="button"
                className="bb-button bb-button-primary bb-btn-full"
                onClick={() => router.push(toAccountPath())}
              >
                Vào tài khoản
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bb-page">
      <div className="bb-container">
        <div className="bb-auth-wrap">
          <div className="bb-card bb-card-padded">
            <header className="bb-auth-header">
              <p className="bb-kicker">Tài khoản</p>
              <h1 className="bb-auth-title">Đăng ký</h1>
            </header>

            {error && (
              <p className="bb-status-banner" style={{ marginBottom: "var(--bb-space-4)" }}>{error}</p>
            )}

            <form onSubmit={handleSubmit} className="bb-form-stack">
              <label className="bb-form-label">
                Họ tên
                <input className="bb-input" required autoComplete="name" placeholder="Nguyen Van A" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </label>
              <label className="bb-form-label">
                Email
                <input className="bb-input" required type="email" autoComplete="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="bb-form-label">
                Số điện thoại
                <input className="bb-input" type="tel" autoComplete="tel" placeholder="0901234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="bb-form-label">
                Mật khẩu
                <input className="bb-input" required type="password" autoComplete="new-password" placeholder="Ít nhất 6 ký tự" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              <label className="bb-form-label">
                Xác nhận mật khẩu
                <input className="bb-input" required type="password" autoComplete="new-password" placeholder="Nhập lại mật khẩu" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </label>
              <button type="submit" className="bb-button bb-button-primary bb-btn-full" disabled={submitting}>
                {submitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
              </button>
            </form>

            <p className="bb-auth-footer">
              Đã có tài khoản?{" "}
              <Link href={toLoginPath()} className="bb-link">Đăng nhập</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
