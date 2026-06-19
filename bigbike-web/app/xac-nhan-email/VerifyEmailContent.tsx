"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { resendEmailVerification, verifyEmail } from "@/lib/api/client-api";
import { useAuth } from "@/lib/auth/auth-store";

type Status = "idle" | "loading" | "success" | "error" | "missing";
type ResendStatus = "idle" | "sending" | "sent" | "error";

/**
 * Nội dung xác nhận email theo theme WP — khung `.user-activity > .login`
 * (canh giữa). GIỮ NGUYÊN logic verify/resend; CTA chính dùng `.form-submit` button đỏ.
 */
export function VerifyEmailContent() {
  const t = useTranslations("Auth.verify");
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
      .catch((e: Error) => {
        setErrorMsg(e.message ?? t("errorGeneric"));
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
    } catch (e) {
      setResendStatus("error");
      setResendMsg(e instanceof Error ? e.message : t("resendFailed"));
    }
  }

  const isLoggedIn = auth.status === "authenticated";

  return (
    <div className="user-activity">
      <div className="container">
        <div className="login">
          <div className="user-activity-content text-center">
            {status === "loading" && (
              <div className="user-activity-content-title">
                <h1 className="mb-2">{t("loadingTitle")}</h1>
                <p className="m-0">{t("loadingMessage")}</p>
              </div>
            )}

            {status === "success" && (
              <>
                <div className="user-activity-content-title mb-[30px]">
                  <h1 className="mb-2">{t("successTitle")}</h1>
                  <p className="m-0">{t("successMessage")}</p>
                </div>
                <div className="form-submit form-group">
                  <button type="button" onClick={() => router.push("/tai-khoan/")}>{t("successCta")}</button>
                </div>
              </>
            )}

            {status === "error" && (
              <>
                <div className="user-activity-content-title mb-[30px]">
                  <h1 className="mb-2">{t("errorTitle")}</h1>
                  <p className="m-0">{errorMsg}</p>
                </div>

                {isLoggedIn ? (
                  <>
                    {resendStatus === "sent" ? (
                      <p className="m-0 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-3 text-caption text-state-success-text">
                        {resendMsg}
                      </p>
                    ) : (
                      <div className="form-submit form-group">
                        <button type="button" onClick={handleResend} disabled={resendStatus === "sending"}>
                          {resendStatus === "sending" ? t("resending") : t("resend")}
                        </button>
                        {resendStatus === "error" && <p className="mt-2 text-caption text-destructive">{resendMsg}</p>}
                      </div>
                    )}
                    <p className="m-0">
                      <Link href="/tai-khoan/" className="font-semibold underline">{t("backToAccount")}</Link>
                    </p>
                  </>
                ) : (
                  <p className="m-0">
                    <Link href="/dang-nhap/?tiep=/xac-nhan-email/" className="font-semibold underline">
                      {t("loginToResend").split(" ")[0]}
                    </Link>{" "}
                    {t("loginToResend").split(" ").slice(1).join(" ")}
                  </p>
                )}
              </>
            )}

            {status === "missing" && (
              <>
                <div className="user-activity-content-title mb-[30px]">
                  <h1 className="mb-2">{t("missingTitle")}</h1>
                  <p className="m-0">{t("missingMessage")}</p>
                </div>
                {isLoggedIn ? (
                  <div className="form-submit form-group">
                    <button type="button" onClick={handleResend} disabled={resendStatus === "sending"}>
                      {resendStatus === "sending" ? t("resending") : t("resend")}
                    </button>
                  </div>
                ) : (
                  <p className="m-0">
                    <Link href="/" className="font-semibold underline">{t("backToHome")}</Link>
                  </p>
                )}
                {resendStatus === "sent" && (
                  <p className="mt-4 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-3 text-caption text-state-success-text">
                    {resendMsg}
                  </p>
                )}
                {resendStatus === "error" && <p className="mt-4 text-caption text-destructive">{resendMsg}</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
