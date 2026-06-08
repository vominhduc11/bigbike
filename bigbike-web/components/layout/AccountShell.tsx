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
import { accountHeaderShell, accountSidebar } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// Account nav is dual-layout: desktop = vertical card rows with a clip-path diamond ::before
// marker (revealed on active); mobile (<=767px) = horizontal-scroll chips with the marker hidden.
const accountNavItem =
  "flex w-full cursor-pointer items-center gap-[9px] border-b border-[#ededed] bg-transparent px-0 py-4 text-left font-body text-ui-14 font-normal text-muted-foreground no-underline transition-colors last:border-b-0 hover:text-brand before:h-[7px] before:w-[7px] before:shrink-0 before:bg-brand before:opacity-0 before:transition-opacity before:content-[''] before:[clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)] max-md:w-auto max-md:min-h-11 max-md:flex-[0_0_auto] max-md:whitespace-nowrap max-md:border max-md:border-[var(--bb-border-subtle)] max-md:bg-[var(--bb-bg-surface)] max-md:px-3.5 max-md:py-0 max-md:before:hidden";
const accountNavItemActive =
  "font-semibold text-brand before:opacity-100 max-md:border-[var(--bb-action-primary)]";

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
    <div className={accountHeaderShell}>
      <h1 className="m-0 flex items-center gap-[11px] font-body text-ui-22 font-bold uppercase tracking-normal text-foreground before:h-0 before:w-0 before:shrink-0 before:border-y-[7px] before:border-l-[11px] before:border-y-transparent before:border-l-[var(--bb-brand-primary)] before:content-[''] max-md:leading-[1.15]">
        {title}
      </h1>
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
          <aside className={accountSidebar}>
            <div className="mb-3.5 flex items-center gap-3 border border-[#e4e4e4] bg-white p-4">
              <div className="bb-account-avatar" aria-hidden="true">
                {(profile.displayName?.[0] ?? profile.email?.[0] ?? "U").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <b className="block overflow-hidden text-ellipsis whitespace-nowrap font-body text-ui-14 font-bold uppercase leading-[1.25] tracking-normal text-foreground">
                  {profile.displayName ?? profile.email?.split("@")[0]}
                </b>
                <span className="mt-[3px] block overflow-hidden text-ellipsis whitespace-nowrap text-ui-12 text-muted-foreground">
                  {profile.email}
                </span>
              </div>
            </div>
            <nav
              className="border border-[#e4e4e4] bg-white px-[22px] py-1 max-md:flex max-md:gap-2 max-md:overflow-x-auto max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:pb-1 max-md:pt-0 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
              aria-label={t("menuAria")}
            >
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(accountNavItem, navIsActive(item, pathname) && accountNavItemActive)}
                >
                  {tNav(item.labelKey)}
                </Link>
              ))}
              <button type="button" onClick={handleLogout} disabled={loggingOut} className={accountNavItem}>
                {loggingOut ? t("loggingOut") : t("logout")}
              </button>
            </nav>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </AccountContext.Provider>
    </AccountRefreshContext.Provider>
  );
}
