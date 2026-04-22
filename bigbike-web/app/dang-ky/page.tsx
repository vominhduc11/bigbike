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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Mat khau xac nhan khong khop.");
      return;
    }
    if (password.length < 6) {
      setError("Mat khau phai co it nhat 6 ky tu.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await registerCustomer(email, phone, password, displayName);
      router.push(toAccountPath());
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bb-page">
      <div className="bb-container">
        <div className="bb-auth-wrap">
          <div className="bb-card" style={{ padding: "var(--bb-space-8)" }}>
            <header style={{ marginBottom: "var(--bb-space-6)", textAlign: "center" }}>
              <p className="bb-kicker">Tai khoan</p>
              <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}>Dang ky</h1>
            </header>

            {error && (
              <p className="bb-status-banner" style={{ marginBottom: "var(--bb-space-4)" }}>
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "var(--bb-space-4)" }}>
              <label className="bb-form-label">
                Ho ten
                <input
                  className="bb-input"
                  required
                  autoComplete="name"
                  placeholder="Nguyen Van A"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
              <label className="bb-form-label">
                Email
                <input
                  className="bb-input"
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="bb-form-label">
                So dien thoai
                <input
                  className="bb-input"
                  type="tel"
                  autoComplete="tel"
                  placeholder="0901234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label className="bb-form-label">
                Mat khau
                <input
                  className="bb-input"
                  required
                  type="password"
                  autoComplete="new-password"
                  placeholder="It nhat 6 ky tu"
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
                  placeholder="Nhap lai mat khau"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className="bb-button bb-button-primary"
                style={{ width: "100%", justifyContent: "center" }}
                disabled={submitting}
              >
                {submitting ? "Dang tao tai khoan..." : "Tao tai khoan"}
              </button>
            </form>

            <p style={{ textAlign: "center", marginTop: "var(--bb-space-4)", color: "var(--bb-text-secondary)", fontSize: "var(--bb-text-sm)" }}>
              Da co tai khoan?{" "}
              <Link href={toLoginPath()} className="bb-link">
                Dang nhap
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
