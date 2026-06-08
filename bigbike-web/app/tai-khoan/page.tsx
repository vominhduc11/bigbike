"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AccountSectionHeading, AccountShell, useAccount } from "@/components/layout/AccountShell";
import { bbLink } from "@/lib/ui-classes";

const DASHBOARD_CARDS = [
  { href: "/tai-khoan/don-hang/", titleKey: "orders", descKey: "ordersDesc" },
  { href: "/tai-khoan/edit-address/billing/", titleKey: "addresses", descKey: "addressesDesc" },
  { href: "/tai-khoan/edit-account/", titleKey: "info", descKey: "infoDesc" },
] as const;

function AccountDashboardContent() {
  const t = useTranslations("Account");
  const tNav = useTranslations("Account.nav");
  const tCards = useTranslations("Account.dashboardCards");
  const profile = useAccount();
  const displayName = profile?.displayName ?? profile?.email?.split("@")[0] ?? tNav("dashboard");

  return (
    <>
      <AccountSectionHeading title={tNav("dashboard")} />
      <p className="mb-4 text-body leading-relaxed text-foreground">
        {t.rich("dashboardGreeting", {
          name: displayName,
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
      <p className="mb-6 text-body leading-relaxed text-foreground">
        {t.rich("dashboardIntro", {
          orders: (chunks) => (
            <Link href="/tai-khoan/don-hang/" className={bbLink}>
              {chunks}
            </Link>
          ),
          addresses: (chunks) => (
            <Link href="/tai-khoan/edit-address/billing/" className={bbLink}>
              {chunks}
            </Link>
          ),
          account: (chunks) => (
            <Link href="/tai-khoan/edit-account/" className={bbLink}>
              {chunks}
            </Link>
          ),
        })}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {DASHBOARD_CARDS.map(({ href, titleKey, descKey }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 border border-border bg-white p-5 transition-colors hover:border-brand"
          >
            <span className="font-body font-bold text-caption uppercase tracking-wide text-foreground group-hover:text-brand">
              {tNav(titleKey)}
            </span>
            <span className="text-sm leading-relaxed text-muted-foreground">
              {tCards(descKey)}
            </span>
            <span className="mt-auto text-xs font-semibold text-brand">→</span>
          </Link>
        ))}
      </div>
    </>
  );
}

export default function AccountIndexPage() {
  return (
    <AccountShell loginRedirect="/tai-khoan/">
      <AccountDashboardContent />
    </AccountShell>
  );
}
