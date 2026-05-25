"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { resendEmailVerification, verifyEmail } from "@/lib/api/client-api";
import { useAuth } from "@/lib/auth/auth-store";

type Status = "idle" | "loading" | "success" | "error" | "missing";
type ResendStatus = "idle" | "sending" | "sent" | "error";

export default function VerifyEmailPage() {
  const t = useTranslations("Auth.verify");
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
    <section className="bb-page bb-page--auth">
      <div className="bb-container">
        <div className="bb-auth-wrap text-center">
          {status === "loading" && (
            <>
              <h1 className="mb-3 text-base font-semibold normal-case">{t("loadingTitle")}</h1>
              <p className="m-0 text-sm leading-relaxed text-foreground">{t("loadingMessage")}</p>
            </>
          )}

          {status === "success" && (
            <>
              <h1 className="mb-3 text-base font-semibold normal-case">{t("successTitle")}</h1>
              <p className="mb-6 text-sm leading-relaxed text-foreground">{t("successMessage")}</p>
              <Button asChild variant="primary" className="h-[52px] w-full py-0 text-sm hover:not-disabled:scale-100">
                <Link href="/tai-khoan/">{t("successCta")}</Link>
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className="mb-3 text-base font-semibold normal-case">{t("errorTitle")}</h1>
              <p className="mb-6 text-sm leading-relaxed text-foreground">{errorMsg}</p>

              {isLoggedIn ? (
                <div className="grid gap-3">
                  {resendStatus === "sent" ? (
                    <p className="m-0 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-3 text-sm text-[var(--bb-state-success-text)]">
                      {resendMsg}
                    </p>
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        onClick={handleResend}
                        disabled={resendStatus === "sending"}
                        className="h-[52px] w-full py-0 text-sm hover:not-disabled:scale-100"
                      >
                        {resendStatus === "sending" ? t("resending") : t("resend")}
                      </Button>
                      {resendStatus === "error" && <p className="text-sm text-destructive">{resendMsg}</p>}
                    </>
                  )}
                  <Button asChild variant="secondary" className="h-[52px] w-full py-0 text-sm hover:not-disabled:scale-100">
                    <Link href="/tai-khoan/">{t("backToAccount")}</Link>
                  </Button>
                </div>
              ) : (
                <p className="m-0 text-sm text-foreground">
                  <Link href="/dang-nhap/?tiep=/xac-nhan-email/" className="bb-link">
                    {t("loginToResend").split(" ")[0]}
                  </Link>{" "}
                  {t("loginToResend").split(" ").slice(1).join(" ")}
                </p>
              )}
            </>
          )}

          {status === "missing" && (
            <>
              <h1 className="mb-3 text-base font-semibold normal-case">{t("missingTitle")}</h1>
              <p className="mb-6 text-sm leading-relaxed text-foreground">{t("missingMessage")}</p>
              {isLoggedIn ? (
                <Button
                  variant="primary"
                  onClick={handleResend}
                  disabled={resendStatus === "sending"}
                  className="h-[52px] w-full py-0 text-sm hover:not-disabled:scale-100"
                >
                  {resendStatus === "sending" ? t("resending") : t("resend")}
                </Button>
              ) : (
                <Button asChild variant="secondary" className="h-[52px] w-full py-0 text-sm hover:not-disabled:scale-100">
                  <Link href="/">{t("backToHome")}</Link>
                </Button>
              )}
              {resendStatus === "sent" && (
                <p className="mt-4 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-3 text-sm text-[var(--bb-state-success-text)]">
                  {resendMsg}
                </p>
              )}
              {resendStatus === "error" && <p className="mt-4 text-sm text-destructive">{resendMsg}</p>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
