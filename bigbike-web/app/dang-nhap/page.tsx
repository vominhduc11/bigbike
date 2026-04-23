"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { loginCustomer } from "@/lib/api/client-api";
import { toAccountPath, toRegisterPath } from "@/lib/utils/routes";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("tiep") ?? toAccountPath();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await loginCustomer(login, password);
      router.push(returnTo);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bb-auth-wrap">
      <div className="bb-card" style={{ padding: "var(--bb-space-8)" }}>
        <header style={{ marginBottom: "var(--bb-space-6)", textAlign: "center" }}>
          <p className="bb-kicker">Tài khoản</p>
          <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}>Đăng nhập</h1>
        </header>

        {error && (
          <p className="bb-status-banner" style={{ marginBottom: "var(--bb-space-4)" }}>
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "var(--bb-space-4)" }}>
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
          <label className="bb-form-label">
            Mật khẩu
            <input
              className="bb-input"
              required
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="bb-button bb-button-primary"
            style={{ width: "100%", justifyContent: "center" }}
            disabled={submitting}
          >
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "var(--bb-space-4)", color: "var(--bb-text-secondary)", fontSize: "var(--bb-text-sm)" }}>
          Chưa có tài khoản?{" "}
          <Link href={toRegisterPath()} className="bb-link">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <section className="bb-page">
      <div className="bb-container">
        <Suspense fallback={<div className="bb-skeleton-item" style={{ maxWidth: "480px", margin: "0 auto", minHeight: "400px" }} />}>
          <LoginForm />
        </Suspense>
      </div>
    </section>
  );
}
