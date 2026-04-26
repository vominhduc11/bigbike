"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { loginCustomer } from "@/lib/api/client-api";
import { refreshAuth } from "@/lib/auth/auth-store";
import { toAccountPath, toForgotPasswordPath, toRegisterPath } from "@/lib/utils/routes";

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
      await refreshAuth();
      router.push(returnTo);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bb-auth-wrap">
      <div className="bb-card bb-card-padded">
        <header className="bb-auth-header">
          <p className="bb-kicker">Tài khoản</p>
          <h1 className="bb-auth-title">Đăng nhập</h1>
        </header>

        {error ? (
          <p className="bb-status-banner" style={{ marginBottom: "var(--bb-space-4)" }}>{error}</p>
        ) : null}

        <form onSubmit={handleSubmit} className="bb-form-stack">
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
          <button type="submit" className="bb-button bb-button-primary bb-btn-full" disabled={submitting}>
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <p className="bb-auth-footer">
          <Link href={toForgotPasswordPath()} className="bb-link bb-auth-footer-link">Quên mật khẩu?</Link>
          <br />
          Chưa có tài khoản?{" "}
          <Link href={toRegisterPath()} className="bb-link">Đăng ký ngay</Link>
        </p>
      </div>
    </div>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="bb-auth-wrap" aria-busy="true">
      <div className="bb-card bb-card-padded" style={{ padding: 24 }}>
        <div className="bb-skel-stack">
          <span className="bb-skel bb-skel--text bb-skel-w-25" />
          <span className="bb-skel bb-skel--title bb-skel-w-50" style={{ height: "1.8em" }} />
          <div style={{ height: 8 }} />
          <span className="bb-skel bb-skel--text bb-skel-w-40" />
          <span className="bb-skel" style={{ height: 42, width: "100%", borderRadius: 4 }} />
          <span className="bb-skel bb-skel--text bb-skel-w-25" />
          <span className="bb-skel" style={{ height: 42, width: "100%", borderRadius: 4 }} />
          <span className="bb-skel bb-skel--btn" style={{ width: "100%" }} />
          <span className="bb-skel bb-skel--text bb-skel-w-60" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <section className="bb-page">
      <div className="bb-container">
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm />
        </Suspense>
      </div>
    </section>
  );
}
