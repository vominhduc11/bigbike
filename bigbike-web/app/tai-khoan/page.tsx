"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AccountSectionHeading, AccountShell, useAccount } from "@/components/layout/AccountShell";

function AccountDashboardContent() {
  const t = useTranslations("Account");
  const tNav = useTranslations("Account.nav");
  const profile = useAccount();
  const displayName = profile?.displayName ?? profile?.email?.split("@")[0] ?? tNav("dashboard");

  return (
    <>
      <AccountSectionHeading title={tNav("dashboard")} />
      <p className="mb-4 text-sm leading-relaxed text-foreground">
        {t.rich("dashboardGreeting", {
          name: displayName,
          strong: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
      <p className="mb-4 text-sm leading-relaxed text-foreground">
        {t.rich("dashboardIntro", {
          orders: (chunks) => (
            <Link href="/tai-khoan/don-hang/" className="bb-link font-normal">
              {chunks}
            </Link>
          ),
          addresses: (chunks) => (
            <Link href="/tai-khoan/edit-address/billing/" className="bb-link font-normal">
              {chunks}
            </Link>
          ),
          account: (chunks) => (
            <Link href="/tai-khoan/edit-account/" className="bb-link font-normal">
              {chunks}
            </Link>
          ),
        })}
      </p>
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
