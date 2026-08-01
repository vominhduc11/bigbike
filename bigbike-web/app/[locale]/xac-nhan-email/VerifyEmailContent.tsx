"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "@/i18n/StorefrontLink";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { resendEmailVerification, verifyEmail } from "@/lib/api/client-api";
import { useAuth } from "@/lib/auth/auth-store";
import { Button } from "@/components/ui/button";
import { AuthTitleBlock } from "@/components/auth/AuthPageFrame";
import type { Locale } from "@/i18n/locale";
import { toAccountPath, toHomePath, toLoginPath, translatePath } from "@/lib/utils/routes";

type Status = "idle" | "loading" | "success" | "error" | "missing";
type ResendStatus = "idle" | "sending" | "sent" | "error";

/**
 * Nội dung xác nhận email theo theme WP — khung `.user-activity > .login`
 * (canh giữa). GIỮ NGUYÊN logic verify/resend; CTA chính dùng `.form-submit` button đỏ.
 */
export function VerifyEmailContent() {
  const t = useTranslations("Auth.verify");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const auth = useAuth();

  const [status, setStatus] = useState<Status>(token ? "loading" : "missing");
  const [errorMsg, setErrorMsg] = useState("");
  const [resendStatus, setResendStatus] = useState<ResendStatus>("idle");
  const [resendMsg, setResendMsg] = useState("");

  useEffect(() => {
    if (!token) return;

    verifyEmail(token)
      .then(() => setStatus("success"))
      .catch(() => {
        setErrorMsg(t("errorGeneric"));
        setStatus("error");
      });
  }, [token, t]);

  async function handleResend() {
    setResendStatus("sending");
    setResendMsg("");
    try {
      await resendEmailVerification();
      setResendStatus("sent");
      setResendMsg(t("resendSent"));
    } catch {
      setResendStatus("error");
      setResendMsg(t("resendFailed"));
    }
  }

  const isLoggedIn = auth.status === "authenticated";

  return (
    <div className="text-center">
            {status === "loading" && (
              <div role="status">
                <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-brand" aria-hidden="true" />
                <h1 className="mb-2 font-body text-a1-title font-bold">{t("loadingTitle")}</h1>
                <p className="m-0">{t("loadingMessage")}</p>
              </div>
            )}

            {status === "success" && (
              <>
                <AuthTitleBlock title={t("successTitle")} centered>
                  <p className="m-0">{t("successMessage")}</p>
                </AuthTitleBlock>
                <div>
                  <Button type="button" size="auth" onClick={() => router.push(toAccountPath(locale))}>{t("successCta")}</Button>
                </div>
              </>
            )}

            {status === "error" && (
              <>
                <AuthTitleBlock title={t("errorTitle")} centered>
                  <p className="m-0">{errorMsg}</p>
                </AuthTitleBlock>

                {isLoggedIn ? (
                  <>
                    {resendStatus === "sent" ? (
                      <p className="m-0 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-3 text-a4-content text-state-success-text">
                        {resendMsg}
                      </p>
                    ) : (
                      <div>
                        <Button type="button" size="auth" onClick={handleResend} disabled={resendStatus === "sending"}>
                          {resendStatus === "sending" ? t("resending") : t("resend")}
                        </Button>
                        {resendStatus === "error" && <p className="mt-2 text-a4-content text-destructive">{resendMsg}</p>}
                      </div>
                    )}
                    <p className="m-0">
                      <Link href={toAccountPath(locale)} className="font-semibold underline">{t("backToAccount")}</Link>
                    </p>
                  </>
                ) : (
                  <p className="m-0">
                    <Link href={toLoginPath(translatePath("/xac-nhan-email/", locale), locale)} className="font-semibold underline">
                      {t("loginToResend").split(" ")[0]}
                    </Link>{" "}
                    {t("loginToResend").split(" ").slice(1).join(" ")}
                  </p>
                )}
              </>
            )}

            {status === "missing" && (
              <>
                <AuthTitleBlock title={t("missingTitle")} centered>
                  <p className="m-0">{t("missingMessage")}</p>
                </AuthTitleBlock>
                {isLoggedIn ? (
                  <div>
                    <Button type="button" size="auth" onClick={handleResend} disabled={resendStatus === "sending"}>
                      {resendStatus === "sending" ? t("resending") : t("resend")}
                    </Button>
                  </div>
                ) : (
                  <p className="m-0">
                    <Link href={toHomePath(locale)} className="font-semibold underline">{t("backToHome")}</Link>
                  </p>
                )}
                {resendStatus === "sent" && (
                  <p className="mt-4 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-3 text-a4-content text-state-success-text">
                    {resendMsg}
                  </p>
                )}
                {resendStatus === "error" && <p className="mt-4 text-a4-content text-destructive">{resendMsg}</p>}
              </>
            )}
    </div>
  );
}
