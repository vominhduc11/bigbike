"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchMe, logoutCustomer } from "@/lib/api/client-api";
import type { CustomerProfile } from "@/lib/contracts/commerce";
import { toLoginPath, toOrderHistoryPath, toProductListPath } from "@/lib/utils/routes";

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetchMe()
      .then(setProfile)
      .catch(() => router.replace(toLoginPath("/tai-khoan")))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logoutCustomer();
      router.push("/");
    } catch {
      router.push("/");
    }
  }

  if (loading) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <div className="bb-skeleton-item" style={{ maxWidth: "600px", minHeight: "300px" }} />
        </div>
      </section>
    );
  }

  if (!profile) return null;

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header style={{ marginBottom: "var(--bb-space-6)" }}>
          <p className="bb-kicker">Tai khoan</p>
          <h1>Xin chao, {profile.displayName ?? profile.email}</h1>
        </header>

        <div style={{ display: "grid", gap: "var(--bb-space-4)", maxWidth: "600px" }}>
          <div className="bb-card" style={{ padding: "var(--bb-space-5)" }}>
            <h2 style={{ marginBottom: "var(--bb-space-4)", fontSize: "var(--bb-text-lg)" }}>
              Thong tin tai khoan
            </h2>
            <div style={{ display: "grid", gap: "var(--bb-space-3)" }}>
              <div className="bb-profile-row">
                <span style={{ color: "var(--bb-text-muted)", minWidth: "100px" }}>Email</span>
                <span>{profile.email}</span>
              </div>
              {profile.phone && (
                <div className="bb-profile-row">
                  <span style={{ color: "var(--bb-text-muted)", minWidth: "100px" }}>Dien thoai</span>
                  <span>{profile.phone}</span>
                </div>
              )}
              <div className="bb-profile-row">
                <span style={{ color: "var(--bb-text-muted)", minWidth: "100px" }}>Trang thai</span>
                <span style={{ color: profile.status === "ACTIVE" ? "var(--bb-state-success)" : "var(--bb-text-muted)" }}>
                  {profile.status}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "var(--bb-space-3)", flexWrap: "wrap" }}>
            <Link href={toOrderHistoryPath()} className="bb-button bb-button-secondary">
              Don hang cua toi
            </Link>
            <Link href={toProductListPath()} className="bb-button bb-button-secondary">
              Tiep tuc mua hang
            </Link>
          </div>

          <button
            type="button"
            className="bb-button bb-button-secondary"
            style={{ width: "fit-content", borderColor: "var(--bb-state-danger-border)", color: "var(--bb-state-danger)" }}
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Dang dang xuat..." : "Dang xuat"}
          </button>
        </div>
      </div>
    </section>
  );
}
