"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AccountSectionHeading, useAccount } from "@/components/account/AccountNav";
import { resendEmailVerification } from "@/lib/api/client-api";
import { Button } from "@/components/ui/button";

/**
 * Nội dung bảng điều khiển — port từ woocommerce/myaccount/dashboard.php
 * (.main-account: lời chào + đoạn dẫn có link tới đơn hàng / địa chỉ / tài khoản).
 */
export function DashboardContent() {
  const t = useTranslations("Account");
  const tNav = useTranslations("Account.nav");
  const profile = useAccount();
  const displayName = profile?.displayName ?? profile?.email?.split("@")[0] ?? tNav("dashboard");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleResendVerification() {
    setResendState("sending");
    try {
      await resendEmailVerification();
      setResendState("sent");
    } catch {
      setResendState("error");
    }
  }

  return (
    <>
      <AccountSectionHeading title={tNav("dashboard")} />
      {profile?.emailVerified === false && (
        <div className="mb-6 border border-[var(--bb-danger)]/30 bg-[var(--bb-danger)]/5 px-4 py-3">
          <p className="m-0 text-ui-16 max-md:text-ui-14 font-semibold text-foreground">{t("emailNotVerified")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleResendVerification}
              disabled={resendState === "sending" || resendState === "sent"}
            >
              {resendState === "sent" ? t("emailVerifySent") : t("emailVerifyResend")}
            </Button>
            {resendState === "error" && (
              <span className="text-ui-16 max-md:text-ui-14 text-[var(--bb-danger)]">{t("emailVerifyError")}</span>
            )}
          </div>
        </div>
      )}
      <div className="space-y-4 text-ui-16 leading-relaxed text-foreground">
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
