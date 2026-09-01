"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "@/i18n/StorefrontLink";
import { useLocale, useTranslations } from "next-intl";
import { CircleAlert, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-store";
import { useResendEmailVerification, useVerifyEmail } from "@/lib/query/hooks";
import { Button } from "@/components/ui/button";
import { FormNotice } from "@/components/ui/FormNotice";
import { AuthTitleBlock } from "@/components/auth/AuthPageFrame";
import { GuestStorefrontExit } from "@/components/auth/GuestStorefrontExit";
import type { Locale } from "@/i18n/locale";
import { isSafeReturnTo } from "@/lib/utils/auth";
import { toAccountPath, toLoginPath, translatePath } from "@/lib/utils/routes";

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
  const rawReturnTo = searchParams.get("tiep") ?? "";
  const returnTo = isSafeReturnTo(rawReturnTo) ? rawReturnTo : undefined;
  const auth = useAuth();
  const verifyMutation = useVerifyEmail();
  const resendMutation = useResendEmailVerification();

  const [status, setStatus] = useState<Status>(token ? "loading" : "missing");
  const [errorMsg, setErrorMsg] = useState("");
  const [resendStatus, setResendStatus] = useState<ResendStatus>("idle");
  const [resendMsg, setResendMsg] = useState("");

  useEffect(() => {
    if (!token) return;

    verifyMutation
      .mutateAsync(token)
      .then(() => setStatus("success"))
      .catch(() => {
        setErrorMsg(t("errorGeneric"));
        setStatus("error");
      });
    // Mutations are intentionally retry-free: an email token is a one-time action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, t]);

  async function handleResend() {
    setResendStatus("sending");
    setResendMsg("");
    try {
      await resendMutation.mutateAsync();
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
            <Button type="button" size="auth" onClick={() => router.push(toAccountPath(locale))}>
              {t("successCta")}
            </Button>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <AuthTitleBlock title={t("errorTitle")} centered />
          <FormNotice tone="danger" role="alert" className="mb-5 flex items-start gap-3 text-left">
            <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="font-medium leading-body">{errorMsg}</p>
          </FormNotice>

          {isLoggedIn ? (
            <>
              {resendStatus === "sent" ? (
                <FormNotice tone="success" role="status" aria-live="polite">
                  {resendMsg}
                </FormNotice>
              ) : (
                <div>
                  <Button
                    type="button"
                    size="auth"
                    onClick={handleResend}
                    disabled={resendStatus === "sending"}
                  >
                    {resendStatus === "sending" ? t("resending") : t("resend")}
                  </Button>
                  {resendStatus === "error" && (
                    <FormNotice tone="danger" role="alert" className="mt-3">
                      {resendMsg}
                    </FormNotice>
                  )}
                </div>
              )}
              <p className="m-0">
                <Link
                  href={toAccountPath(locale)}
                  prefetch={false}
                  className="font-semibold underline"
                >
                  {t("backToAccount")}
                </Link>
              </p>
            </>
          ) : (
            <p className="m-0">
              <Link
                href={toLoginPath(translatePath("/xac-nhan-email/", locale), locale)}
                className="font-semibold underline"
              >
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
              <Button
                type="button"
                size="auth"
                onClick={handleResend}
                disabled={resendStatus === "sending"}
              >
                {resendStatus === "sending" ? t("resending") : t("resend")}
              </Button>
            </div>
          ) : null}
          {resendStatus === "sent" && (
            <FormNotice tone="success" role="status" aria-live="polite" className="mt-4">
              {resendMsg}
            </FormNotice>
          )}
          {resendStatus === "error" && (
            <FormNotice tone="danger" role="alert" className="mt-4">
              {resendMsg}
            </FormNotice>
          )}
        </>
      )}
      <GuestStorefrontExit returnTo={returnTo} />
    </div>
  );
}
