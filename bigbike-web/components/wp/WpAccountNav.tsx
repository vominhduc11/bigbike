"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { performLogout, refreshAuth, useAuth } from "@/lib/auth/auth-store";
import type { CustomerProfile } from "@/lib/contracts/commerce";
import { toLoginPath, translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

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

function navIsActive(item: { href: string; labelKey: string; match: string; exact?: boolean }, pathname: string | null): boolean {
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
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (auth.status === "anonymous") {
      router.replace(toLoginPath(loginRedirect));
    }
  }, [auth.status, router, loginRedirect]);

  const localizedNav = NAV.map((item) => ({
    ...item,
    href: translatePath(item.href, locale),
    match: translatePath(item.match, locale),
  }));

  async function handleLogout() {
    if (loggingOut) return;
    if (!window.confirm(t("logoutConfirm"))) return;
    setLoggingOut(true);
    await performLogout();
    router.push("/");
  }

  if (auth.status === "loading") {
    // Auth check is still in flight (fetchMe() hasn't resolved yet) — render a
    // skeleton shaped like the real sidebar+content layout instead of a single
    // line of text, so the page doesn't visibly "pop" from empty to full content.
    return (
      <div className="account-dashboard" aria-busy="true" aria-label={t("loadingAccount")}>
        <div className="row">
          <div className="col-md-3">
            <div className="account-loggin">
              <div className="infor animate-pulse">
                <div className="h-5 w-2/3 rounded bg-black/10" />
                <div className="mt-2 h-4 w-4/5 rounded bg-black/10" />
              </div>
            </div>
            <div className="account-nav animate-pulse">
              <ul>
                {localizedNav.map((item) => (
                  <li key={item.href}>
                    <div className="my-2 h-4 w-1/2 rounded bg-black/10" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="col-md-9 my-account-sidebar">
            <div className="woocommerce-MyAccount-content animate-pulse">
              <div className="h-4 w-full rounded bg-black/10" />
              <div className="mt-3 h-4 w-5/6 rounded bg-black/10" />
              <div className="mt-3 h-4 w-2/3 rounded bg-black/10" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (auth.status !== "authenticated") {
    // "anonymous" — the redirect effect above is about to send the browser to
    // /dang-nhap/; render nothing rather than a flash of "logging out" copy that
    // doesn't apply to a visitor who was never logged in.
    return null;
  }

  const profile = auth.profile;
  const activeNav = localizedNav.find((n) => navIsActive(n, pathname));

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
              <Link href={translatePath("/tai-khoan/", locale)}>
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
                  {localizedNav.map((item) => (
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
