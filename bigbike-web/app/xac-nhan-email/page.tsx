"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Link2Off, LoaderCircle, MailCheck } from "lucide-react";
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
      <div className="bb-container max-w-[480px] py-[var(--bb-space-15)] text-center">
        {status === "loading" && (
          <div className="grid justify-items-center gap-3 border border-border bg-card p-6">
            <LoaderCircle className="h-10 w-10 animate-spin text-brand" aria-hidden />
            <h1 className="m-0 font-heading text-2xl font-semibold uppercase">{t("loadingTitle")}</h1>
            <p className="bb-text-muted">{t("loadingMessage")}</p>
          </div>
        )}

        {status === "success" && (
          <div className="grid justify-items-center gap-4 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-6">
            <CheckCircle2 className="h-11 w-11 text-[var(--bb-state-success-text)]" aria-hidden />
            <h1 className="m-0 font-heading text-2xl font-semibold uppercase">{t("successTitle")}</h1>
            <p className="bb-text-muted m-0">{t("successMessage")}</p>
            <Button asChild variant="primary">
              <Link href="/tai-khoan/">{t("successCta")}</Link>
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="grid justify-items-center gap-4 border border-[var(--bb-state-danger-border)] bg-[var(--bb-state-danger-bg)] p-6">
            <AlertTriangle className="h-11 w-11 text-destructive" aria-hidden />
            <h1 className="m-0 font-heading text-2xl font-semibold uppercase">{t("errorTitle")}</h1>
            <p className="bb-text-muted m-0">{errorMsg}</p>

            {isLoggedIn ? (
              <div className="flex w-full flex-col gap-2">
                {resendStatus === "sent" ? (
                  <div className="flex items-start gap-2 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-3 text-left text-sm text-[var(--bb-state-success-text)]">
                    <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{resendMsg}</span>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="primary"
                      onClick={handleResend}
                      disabled={resendStatus === "sending"}
                      className="w-full"
                    >
                      {resendStatus === "sending" ? t("resending") : t("resend")}
                    </Button>
                    {resendStatus === "error" && (
                      <p className="text-sm text-destructive">{resendMsg}</p>
                    )}
                  </>
                )}
                <Button asChild variant="secondary" className="w-full">
                  <Link href="/tai-khoan/">{t("backToAccount")}</Link>
                </Button>
              </div>
            ) : (
              <p className="m-0 text-sm text-muted-foreground">
                <Link href="/dang-nhap?next=/xac-nhan-email" className="bb-link">
                  {t("loginToResend").split(" ")[0]}
                </Link>{" "}
                {t("loginToResend").split(" ").slice(1).join(" ")}
              </p>
            )}
          </div>
        )}

        {status === "missing" && (
          <div className="grid justify-items-center gap-4 border border-border bg-card p-6">
            <Link2Off className="h-11 w-11 text-muted-foreground" aria-hidden />
            <h1 className="m-0 font-heading text-2xl font-semibold uppercase">{t("missingTitle")}</h1>
            <p className="bb-text-muted m-0">{t("missingMessage")}</p>
            {isLoggedIn ? (
              <Button variant="primary" onClick={handleResend} disabled={resendStatus === "sending"} className="w-full">
                {resendStatus === "sending" ? t("resending") : t("resend")}
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <Link href="/">{t("backToHome")}</Link>
              </Button>
            )}
            {resendStatus === "sent" && (
              <div className="flex items-start gap-2 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-3 text-left text-sm text-[var(--bb-state-success-text)]">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{resendMsg}</span>
              </div>
            )}
            {resendStatus === "error" && (
              <p className="text-sm text-destructive">{resendMsg}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
