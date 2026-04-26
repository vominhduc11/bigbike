"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { performLogout, refreshAuth, useAuth } from "@/lib/auth/auth-store";
import type { CustomerProfile } from "@/lib/contracts/commerce";
import { toLoginPath } from "@/lib/utils/routes";
import { AccountLayoutSkeleton } from "@/components/ui/Skeletons";

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
  const auth = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (auth.status === "anonymous") {
      router.replace(toLoginPath(loginRedirect));
    }
  }, [auth.status, router, loginRedirect]);

  async function handleLogout() {
    setLoggingOut(true);
    await performLogout();
    router.push("/");
  }

  if (auth.status !== "authenticated") {
    return <AccountLayoutSkeleton rows={3} />;
  }

  const profile = auth.profile;

  async function refreshProfile() {
    await refreshAuth();
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
                className="wp-logout-btn"
                onClick={handleLogout}
                disabled={loggingOut}
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
