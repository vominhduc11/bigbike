"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { performLogout, refreshAuth, useAuth } from "@/lib/auth/auth-store";
import type { CustomerProfile } from "@/lib/contracts/commerce";
import { toLoginPath, translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

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
  {
    href: "/tai-khoan/edit-address/billing/",
    labelKey: "addresses",
    match: "/tai-khoan/edit-address",
  },
  { href: "/tai-khoan/edit-account/", labelKey: "info", match: "/tai-khoan/edit-account" },
] as const;

function navIsActive(
  item: { href: string; labelKey: string; match: string; exact?: boolean },
  pathname: string | null,
): boolean {
  if (!pathname) return false;
  if ("exact" in item && item.exact) {
    return pathname === item.match || pathname === `${item.match}/`;
  }
  return pathname.startsWith(item.match);
}

export function AccountSectionHeading({ title }: { title: string }) {
  return (
    <div className="mb-6 border-b border-border pb-3">
      <h1 className="font-cta text-a2-page font-bold uppercase leading-tight text-foreground">
        {title}
      </h1>
    </div>
  );
}

export function AccountNav({
  children,
  loginRedirect,
}: {
  children: ReactNode;
  loginRedirect?: string;
}) {
  const t = useTranslations("Account");
  const tNav = useTranslations("Account.nav");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const resolvedLoginRedirect = loginRedirect ?? pathname ?? "/tai-khoan/";
  const auth = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (auth.status === "anonymous") {
      router.replace(toLoginPath(resolvedLoginRedirect, locale));
    }
  }, [auth.status, router, resolvedLoginRedirect, locale]);

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
    return (
      <div
        className="grid gap-8 py-10 md:grid-cols-4"
        aria-busy="true"
        aria-label={t("loadingAccount")}
      >
        <aside>
          <div className="mb-8 animate-pulse">
            <div className="h-5 w-2/3 rounded bg-black/10" />
            <div className="mt-2 h-4 w-4/5 rounded bg-black/10" />
          </div>
          <div className="animate-pulse bg-card px-8 shadow-sm">
            <ul className="m-0 list-none p-0">
              {localizedNav.map((item) => (
                <li key={item.href} className="border-b border-border py-7 last:border-b-0">
                  <div className="h-4 w-1/2 rounded bg-black/10" />
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <div className="bg-card p-5 shadow-sm md:col-span-3">
          <div className="animate-pulse">
            <div className="h-4 w-full rounded bg-black/10" />
            <div className="mt-3 h-4 w-5/6 rounded bg-black/10" />
            <div className="mt-3 h-4 w-2/3 rounded bg-black/10" />
          </div>
        </div>
      </div>
    );
  }

  if (auth.status !== "authenticated") return null;

  const profile = auth.profile;
  const activeNav = localizedNav.find((item) => navIsActive(item, pathname));
  const displayName = profile.displayName ?? profile.email?.split("@")[0] ?? "";

  async function refreshProfile() {
    await refreshAuth();
  }

  return (
    <AccountRefreshContext.Provider value={refreshProfile}>
      <AccountContext.Provider value={profile}>
        <nav className="py-8 text-a5-meta text-muted-foreground" aria-label={t("breadcrumbAccount")}>
          <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
            <li>
              <Link href="/" className="font-semibold hover:text-brand">
                <span property="name">Bigbike.vn</span>
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link
                href={translatePath("/tai-khoan/", locale)}
                className="font-semibold hover:text-brand"
              >
                <span property="name">{t("breadcrumbAccount")}</span>
              </Link>
            </li>
            {activeNav && !("exact" in activeNav && activeNav.exact) ? (
              <>
                <li aria-hidden>/</li>
                <li>
                  <span property="name">{tNav(activeNav.labelKey)}</span>
                </li>
              </>
            ) : null}
          </ol>
        </nav>

        <div className="grid gap-8 pb-10 md:grid-cols-4">
          <aside>
            <div className="relative mb-8 pr-10">
              <h2 className="font-body text-a4-content font-semibold text-foreground">{displayName}</h2>
              <p className="m-0 truncate text-a5-meta text-foreground">Email: {profile.email}</p>
              {profile.phone ? (
                <p className="m-0 truncate text-a5-meta text-foreground">SĐT: {profile.phone}</p>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 text-brand hover:text-brand"
                onClick={handleLogout}
                disabled={loggingOut}
                aria-label={t("logout")}
              >
                <LogOut size={22} strokeWidth={1.5} />
              </Button>
            </div>

            <nav className="bg-card px-8 shadow-sm" aria-label={t("breadcrumbAccount")}>
              <ul className="m-0 list-none p-0">
                {localizedNav.map((item) => {
                  const active = navIsActive(item, pathname);
                  return (
                    <li key={item.href} className="border-b border-border py-7 last:border-b-0">
                      <Link
                        href={item.href}
                        className={`font-body text-a5-meta font-semibold hover:text-brand ${active ? "text-brand" : "text-foreground"}`}
                        aria-current={active ? "page" : undefined}
                      >
                        {tNav(item.labelKey)}
                      </Link>
                    </li>
                  );
                })}
                <li className="py-7">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="h-auto min-h-0 p-0 font-body text-b4-action font-semibold text-foreground hover:bg-transparent hover:text-brand"
                  >
                    {loggingOut ? t("loggingOut") : t("logout")}
                  </Button>
                </li>
              </ul>
            </nav>
          </aside>

          <div className="bg-card p-5 shadow-sm md:col-span-3">
            <div className="[&_a]:font-bold [&_a]:text-foreground [&_a]:underline">{children}</div>
          </div>
        </div>
      </AccountContext.Provider>
    </AccountRefreshContext.Provider>
  );
}
