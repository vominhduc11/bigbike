"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { WpAccountSectionHeading, useWpAccount } from "@/components/wp/WpAccountNav";

/**
 * Nội dung bảng điều khiển — port từ woocommerce/myaccount/dashboard.php
 * (.main-account: lời chào + đoạn dẫn có link tới đơn hàng / địa chỉ / tài khoản).
 */
export function DashboardContent() {
  const t = useTranslations("Account");
  const tNav = useTranslations("Account.nav");
  const profile = useWpAccount();
  const displayName = profile?.displayName ?? profile?.email?.split("@")[0] ?? tNav("dashboard");

  return (
    <>
      <WpAccountSectionHeading title={tNav("dashboard")} />
      <div className="main-account">
        <p>
          {t.rich("dashboardGreeting", {
            name: displayName,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <p>
          {t.rich("dashboardIntro", {
            orders: (chunks) => <Link href="/tai-khoan/don-hang/">{chunks}</Link>,
            addresses: (chunks) => <Link href="/tai-khoan/edit-address/billing/">{chunks}</Link>,
            account: (chunks) => <Link href="/tai-khoan/edit-account/">{chunks}</Link>,
          })}
        </p>
      </div>
    </>
  );
}
