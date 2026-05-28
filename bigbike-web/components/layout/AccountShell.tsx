"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { performLogout, refreshAuth, useAuth } from "@/lib/auth/auth-store";
import type { CustomerProfile } from "@/lib/contracts/commerce";
import { toLoginPath } from "@/lib/utils/routes";
import { AccountLayoutSkeleton } from "@/components/ui/Skeletons";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/Breadcrumb";

const AccountContext = createContext<CustomerProfile | null>(null);
const AccountRefreshContext = createContext<(() => Promise<void>) | null>(null);

export function useAccount(): CustomerProfile | null {
  return useContext(AccountContext);
}

export function useAccountRefresh(): (() => Promise<void>) | null {
  return useContext(AccountRefreshContext);
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

export function AccountSectionHeading({
  title,
}: {
  title: string;
  icon?: ReactNode;
}) {
  return (
    <div className="bb-account-header">
      <h1>{title}</h1>
    </div>
  );
}

type Props = { children: ReactNode; loginRedirect: string };

export function AccountShell({ children, loginRedirect }: Props) {
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
    return <AccountLayoutSkeleton rows={3} />;
  }

  const profile = auth.profile;
  const activeNav = NAV.find((n) => navIsActive(n, pathname));

  async function refreshProfile() {
    await refreshAuth();
  }

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: t("breadcrumbHome"), href: "/" },
    { label: t("breadcrumbAccount"), href: "/tai-khoan/" },
    ...(activeNav && !("exact" in activeNav && activeNav.exact)
      ? [{ label: tNav(activeNav.labelKey) }]
      : []),
  ];

  return (
    <AccountRefreshContext.Provider value={refreshProfile}>
      <AccountContext.Provider value={profile}>
        <Breadcrumb items={breadcrumbItems} variant="onLight" />

        <div className="bb-account-layout">
          <aside className="bb-account-sidebar">
            <nav className="bb-account-nav" aria-label={t("menuAria")}>
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className={navIsActive(item, pathname) ? "active" : undefined}>
                  {tNav(item.labelKey)}
                </Link>
              ))}
              <button type="button" onClick={handleLogout} disabled={loggingOut}>
                {loggingOut ? t("loggingOut") : t("logout")}
              </button>
            </nav>
          </aside>

          <div className="bb-account-main">{children}</div>
        </div>
      </AccountContext.Provider>
    </AccountRefreshContext.Provider>
  );
}
