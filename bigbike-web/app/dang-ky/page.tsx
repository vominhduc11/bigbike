"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerCustomer } from "@/lib/api/client-api";
import { toAccountPath, toLoginPath } from "@/lib/utils/routes";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await registerCustomer(email, password, firstName, lastName || undefined);
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
              <div style={{ marginBottom: "var(--bb-space-4)", display: "flex", justifyContent: "center" }}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--bb-brand-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
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
                Tên <span style={{ color: "var(--bb-error, red)" }}>*</span>
                <input className="bb-input" required autoComplete="given-name" placeholder="Văn A" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label className="bb-form-label">
                Họ
                <input className="bb-input" autoComplete="family-name" placeholder="Nguyễn" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
              <label className="bb-form-label">
                Email <span style={{ color: "var(--bb-error, red)" }}>*</span>
                <input className="bb-input" required type="email" autoComplete="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="bb-form-label">
                Mật khẩu <span style={{ color: "var(--bb-error, red)" }}>*</span>
                <input className="bb-input" required type="password" autoComplete="new-password" placeholder="Ít nhất 8 ký tự" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              <label className="bb-form-label">
                Xác nhận mật khẩu <span style={{ color: "var(--bb-error, red)" }}>*</span>
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
