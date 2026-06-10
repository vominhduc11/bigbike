"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { performLogout, refreshAuth, useAuth } from "@/lib/auth/auth-store";
import type { CustomerProfile } from "@/lib/contracts/commerce";
import { toLoginPath } from "@/lib/utils/routes";

/**
 * Thân trang tài khoản theo theme WP — port 1:1 từ woocommerce/myaccount/navigation.php
 * + my-account.php (.account-dashboard > .row > [.col-md-3 .account-loggin + .account-nav]
 * + [.col-md-9.my-account-sidebar > .woocommerce-MyAccount-content]). Client vì cần auth
 * (gate đăng nhập, tên/email, active nav, đăng xuất). Header/footer/container do server
 * WpAccountShell render. Giữ nguyên logic auth của AccountShell cũ.
 */

const WpAccountContext = createContext<CustomerProfile | null>(null);
const WpAccountRefreshContext = createContext<(() => Promise<void>) | null>(null);

export function useWpAccount(): CustomerProfile | null {
  return useContext(WpAccountContext);
}

export function useWpAccountRefresh(): (() => Promise<void>) | null {
  return useContext(WpAccountRefreshContext);
}

const NAV = [
  { href: "/tai-khoan/", labelKey: "dashboard", match: "/tai-khoan", exact: true },
  { href: "/tai-khoan/don-hang/", labelKey: "orders", match: "/tai-khoan/don-hang" },
  { href: "/tai-khoan/edit-address/billing/", labelKey: "addresses", match: "/tai-khoan/edit-address" },
  { href: "/tai-khoan/edit-account/", labelKey: "info", match: "/tai-khoan/edit-account" },
] as const;

function navIsActive(item: (typeof NAV)[number], pathname: string | null): boolean {
  if (!pathname) return false;
  if ("exact" in item && item.exact) return pathname === item.match || pathname === `${item.match}/`;
  return pathname.startsWith(item.match);
}

/** Tiêu đề mục trong content column — .account-title h3 của theme (Barlow Condensed). */
export function WpAccountSectionHeading({ title }: { title: string }) {
  return (
    <div className="account-title">
      <h3>{title}</h3>
    </div>
  );
}

export function WpAccountNav({
  children,
  loginRedirect,
}: {
  children: ReactNode;
  loginRedirect: string;
}) {
  const t = useTranslations("Account");
  const tNav = useTranslations("Account.nav");
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
    if (loggingOut) return;
    if (!window.confirm(t("logoutConfirm"))) return;
    setLoggingOut(true);
    await performLogout();
    router.push("/");
  }

  if (auth.status !== "authenticated") {
    return (
      <div className="account-dashboard">
        <p className="woocommerce-info">{t("loggingOut")}</p>
      </div>
    );
  }

  const profile = auth.profile;
  const activeNav = NAV.find((n) => navIsActive(n, pathname));

  async function refreshProfile() {
    await refreshAuth();
  }

  const displayName = profile.displayName ?? profile.email?.split("@")[0] ?? "";

  return (
    <WpAccountRefreshContext.Provider value={refreshProfile}>
      <WpAccountContext.Provider value={profile}>
        {/* breadcrumb (content-breadcrumbs) — nằm trong .container, trước account-dashboard */}
        <div className="breadcrumb">
          <ul>
            <li className="home">
              <Link href="/">
                <span property="name">Bigbike.vn</span>
              </Link>
            </li>
            <li>
              <Link href="/tai-khoan/">
                <span property="name">{t("breadcrumbAccount")}</span>
              </Link>
            </li>
            {activeNav && !("exact" in activeNav && activeNav.exact) ? (
              <li>
                <span property="name">{tNav(activeNav.labelKey)}</span>
              </li>
            ) : null}
          </ul>
        </div>

        <div className="account-dashboard">
          <div className="row">
            <div className="col-md-3">
              <div className="account-loggin">
                <div className="infor">
                  <h3>{displayName}</h3>
                  <p>Email: {profile.email}</p>
                  {profile.phone ? <p>SĐT: {profile.phone}</p> : null}
                  <button
                    type="button"
                    className="logout"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    aria-label={t("logout")}
                  >
                    <LogOut size={22} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
              <div className="account-nav">
                <ul>
                  {NAV.map((item) => (
                    <li key={item.href} className={navIsActive(item, pathname) ? "is-active" : ""}>
                      <Link href={item.href}>{tNav(item.labelKey)}</Link>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="cursor-pointer border-0 bg-transparent p-0 text-[14px] font-semibold text-black"
                    >
                      {loggingOut ? t("loggingOut") : t("logout")}
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <div className="col-md-9 my-account-sidebar">
              <div className="woocommerce-MyAccount-content">{children}</div>
            </div>
          </div>
        </div>
      </WpAccountContext.Provider>
    </WpAccountRefreshContext.Provider>
  );
}
