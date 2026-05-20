"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, User } from "lucide-react";
import { performLogout, refreshAuth, useAuth } from "@/lib/auth/auth-store";
import type { CustomerProfile } from "@/lib/contracts/commerce";
import { toLoginPath } from "@/lib/utils/routes";
import { AccountLayoutSkeleton } from "@/components/ui/Skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AccountContext = createContext<CustomerProfile | null>(null);
const AccountRefreshContext = createContext<(() => Promise<void>) | null>(null);

export function useAccount(): CustomerProfile | null {
  return useContext(AccountContext);
}

export function useAccountRefresh(): (() => Promise<void>) | null {
  return useContext(AccountRefreshContext);
}

const NAV = [
  { href: "/tai-khoan/edit-account/", labelKey: "info", match: "/tai-khoan/edit-account" },
  { href: "/tai-khoan/edit-address/billing/", labelKey: "addresses", match: "/tai-khoan/edit-address" },
  { href: "/tai-khoan/don-hang/", labelKey: "orders", match: "/tai-khoan/don-hang" },
  { href: "/tai-khoan/doi-tra/", labelKey: "returns", match: "/tai-khoan/doi-tra" },
  { href: "/tai-khoan/yeu-thich/", labelKey: "wishlist", match: "/tai-khoan/yeu-thich" },
] as const;

function navIsActive(match: string, pathname: string | null): boolean {
  return !!pathname && pathname.startsWith(match);
}

/**
 * Section heading for account pages — red play-triangle marker on the left,
 * faint section icon on the right, matching the 2020 mockups.
 */
export function AccountSectionHeading({
  title,
  icon,
}: {
  title: string;
  icon?: ReactNode;
}) {
  return (
    <div className="bb-account-header">
      <h1>{title}</h1>
      {icon && <span className="bb-account-header-icon">{icon}</span>}
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
  const activeNav = NAV.find((n) => navIsActive(n.match, pathname));

  async function refreshProfile() {
    await refreshAuth();
  }

  return (
    <AccountRefreshContext.Provider value={refreshProfile}>
      <AccountContext.Provider value={profile}>
        <nav aria-label="Breadcrumb" className="mx-auto max-w-[1280px] px-6 pt-4 pb-1 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-brand">{t("breadcrumbHome")}</Link>
          <span className="mx-1.5">/</span>
          <Link href="/tai-khoan/edit-account/" className="hover:text-brand">{t("breadcrumbAccount")}</Link>
          {activeNav && (
            <>
              <span className="mx-1.5">/</span>
              <span className="text-[#1a1a1a]">{tNav(activeNav.labelKey)}</span>
            </>
          )}
        </nav>

        <div className="bb-account-layout">
          <aside className="bb-account-sidebar">
            <div className="bb-account-user">
              <div className="bb-account-avatar">
                <User className="h-6 w-6" strokeWidth={1.6} aria-hidden />
              </div>
              <div className="bb-account-user-info">
                <b>{profile.displayName ?? profile.email.split("@")[0]}</b>
                <span>{t("idPrefix")} {profile.email}</span>
              </div>
              <button
                type="button"
                className="bb-account-logout"
                onClick={handleLogout}
                disabled={loggingOut}
                aria-label={t("logout")}
                title={t("logout")}
              >
                <LogOut className="h-[18px] w-[18px]" aria-hidden />
              </button>
            </div>

            {/* Mobile: section switcher as a dropdown (2020 mockup). */}
            <div className="md:hidden">
              <Select
                value={activeNav?.href ?? ""}
                onValueChange={(href) => router.push(href)}
              >
                <SelectTrigger aria-label={t("sectionSwitcherAria")}>
                  <SelectValue placeholder={t("sectionSwitcherPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {NAV.map(({ href, labelKey }) => (
                    <SelectItem key={href} value={href}>
                      {tNav(labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Desktop: vertical nav card. */}
            <nav className="bb-account-nav max-md:hidden" aria-label={t("menuAria")}>
              {NAV.map(({ href, labelKey, match }) => (
                <Link
                  key={href}
                  href={href}
                  className={navIsActive(match, pathname) ? "active" : undefined}
                >
                  {tNav(labelKey)}
                </Link>
              ))}
            </nav>
          </aside>

          <div className="bb-account-main">{children}</div>
        </div>
      </AccountContext.Provider>
    </AccountRefreshContext.Provider>
  );
}
