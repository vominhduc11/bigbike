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
      setError("Vui long nhap email hoac so dien thoai.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await requestPasswordReset(login.trim());
      setSuccess("Neu tai khoan ton tai, chung toi da gui lien ket dat lai mat khau.");
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
      setError("Lien ket dat lai mat khau khong hop le.");
      return;
    }
    if (password.length < 6) {
      setError("Mat khau phai co it nhat 6 ky tu.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mat khau xac nhan khong khop.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await resetCustomerPassword(token, password);
      setSuccess("Mat khau da duoc thay doi. Dang chuyen sang trang dang nhap...");
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
          <p className="bb-kicker">Tai khoan</p>
          <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}>
            {hasToken ? "Dat lai mat khau" : "Quen mat khau"}
          </h1>
          <p className="bb-page-subtitle" style={{ marginInline: "auto" }}>
            {hasToken
              ? "Nhap mat khau moi de hoan tat quy trinh."
              : "Nhap email hoac so dien thoai de nhan lien ket dat lai mat khau."}
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
                Di den trang dang nhap
              </Link>
            ) : null}
          </div>
        ) : null}

        {hasToken ? (
          <form onSubmit={handleResetSubmit} style={{ display: "grid", gap: "var(--bb-space-4)" }}>
            <label className="bb-form-label">
              Mat khau moi
              <input
                className="bb-input"
                required
                type="password"
                autoComplete="new-password"
                placeholder="Nhap mat khau moi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="bb-form-label">
              Xac nhan mat khau
              <input
                className="bb-input"
                required
                type="password"
                autoComplete="new-password"
                placeholder="Nhap lai mat khau moi"
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
              {loading ? "Dang cap nhat..." : "Dat lai mat khau"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestSubmit} style={{ display: "grid", gap: "var(--bb-space-4)" }}>
            <label className="bb-form-label">
              Email hoac so dien thoai
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
              {loading ? "Dang gui..." : "Gui lien ket dat lai"}
            </button>
          </form>
        )}

        <div style={{ textAlign: "center", marginTop: "var(--bb-space-5)", color: "var(--bb-text-secondary)" }}>
          <Link href={toLoginPath()} className="bb-link">
            Quay lai dang nhap
          </Link>
          {" "}
          <span aria-hidden="true">·</span>
          {" "}
          <Link href={toRegisterPath()} className="bb-link">
            Tao tai khoan moi
          </Link>
        </div>
      </div>
    </div>
  );
}
