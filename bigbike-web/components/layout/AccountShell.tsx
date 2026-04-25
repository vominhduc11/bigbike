"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchMe, logoutCustomer } from "@/lib/api/client-api";
import type { CustomerProfile } from "@/lib/contracts/commerce";
import { toLoginPath } from "@/lib/utils/routes";

const AccountContext = createContext<CustomerProfile | null>(null);
const AccountRefreshContext = createContext<(() => Promise<void>) | null>(null);

export function useAccount(): CustomerProfile | null {
  return useContext(AccountContext);
}

export function useAccountRefresh(): (() => Promise<void>) | null {
  return useContext(AccountRefreshContext);
}

const NAV = [
  { href: "/tai-khoan", label: "Tổng quan", exact: true },
  { href: "/tai-khoan/don-hang", label: "Đơn hàng", exact: false },
  { href: "/tai-khoan/edit-address", label: "Địa chỉ", exact: false },
  { href: "/tai-khoan/edit-account", label: "Tài khoản", exact: false },
];

function navIsActive(href: string, exact: boolean, pathname: string | null): boolean {
  if (!pathname) return false;
  return exact ? pathname === href : pathname.startsWith(href);
}

function avatarInitials(profile: CustomerProfile): string {
  const name = profile.displayName ?? profile.email;
  return name.slice(0, 2).toUpperCase();
}

type Props = { children: ReactNode; loginRedirect: string };

export function AccountShell({ children, loginRedirect }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetchMe()
      .then(setProfile)
      .catch(() => router.replace(toLoginPath(loginRedirect)))
      .finally(() => setLoading(false));
  }, [router, loginRedirect]);

  async function handleLogout() {
    setLoggingOut(true);
    try { await logoutCustomer(); } catch { /* ignore */ }
    router.push("/");
  }

  if (loading) {
    return (
      <div className="wp-account-layout">
        <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, minHeight: 320 }} />
        <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, minHeight: 320 }} />
      </div>
    );
  }

  if (!profile) return null;

  async function refreshProfile() {
    try { setProfile(await fetchMe()); } catch { /* ignore */ }
  }

  return (
    <AccountRefreshContext.Provider value={refreshProfile}>
    <AccountContext.Provider value={profile}>
      <div className="wp-account-layout">
        <aside className="wp-account-sidebar">
          <div className="wp-account-user">
            <div className="wp-account-avatar">{avatarInitials(profile)}</div>
            <b>{profile.displayName ?? profile.email.split("@")[0]}</b>
            <span>{profile.email}</span>
            <div className="wp-account-tier">Thành viên</div>
          </div>
          <nav className="wp-account-nav">
            {NAV.map(({ href, label, exact }) => (
              <Link
                key={href}
                href={href}
                className={navIsActive(href, exact, pathname) ? "active" : undefined}
              >
                {label}
              </Link>
            ))}
            <div className="logout">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "11px 14px",
                  background: "none",
                  border: "none",
                  width: "100%",
                  textAlign: "left",
                  cursor: loggingOut ? "default" : "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: loggingOut ? "rgba(255,255,255,0.3)" : "var(--bb-text-muted)",
                  borderRadius: 4,
                  fontFamily: "inherit",
                }}
              >
                {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
              </button>
            </div>
          </nav>
        </aside>
        <div className="wp-account-main">
          {children}
        </div>
      </div>
    </AccountContext.Provider>
    </AccountRefreshContext.Provider>
  );
}
