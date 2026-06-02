"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { resendEmailVerification, verifyEmail } from "@/lib/api/client-api";
import { useAuth } from "@/lib/auth/auth-store";
import { Container } from "@/components/layout/Container";

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
      <Container>
        <div className="bb-auth-wrap text-center">
          {status === "loading" && (
            <>
              <h1 className="bb-auth-heading mb-3">{t("loadingTitle")}</h1>
              <p className="m-0 text-sm leading-relaxed text-foreground">{t("loadingMessage")}</p>
            </>
          )}

          {status === "success" && (
            <>
              <h1 className="bb-auth-heading mb-3">{t("successTitle")}</h1>
              <p className="mb-6 text-sm leading-relaxed text-foreground">{t("successMessage")}</p>
              <Button asChild variant="primary" size="auth">
                <Link href="/tai-khoan/">{t("successCta")}</Link>
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className="bb-auth-heading mb-3">{t("errorTitle")}</h1>
              <p className="mb-6 text-sm leading-relaxed text-foreground">{errorMsg}</p>

              {isLoggedIn ? (
                <div className="grid gap-3">
                  {resendStatus === "sent" ? (
                    <p className="m-0 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-3 text-sm text-state-success-text">
                      {resendMsg}
                    </p>
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        onClick={handleResend}
                        disabled={resendStatus === "sending"}
                        size="auth"
                      >
                        {resendStatus === "sending" ? t("resending") : t("resend")}
                      </Button>
                      {resendStatus === "error" && <p className="text-sm text-destructive">{resendMsg}</p>}
                    </>
                  )}
                  <Button asChild variant="secondary" size="auth">
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
              <h1 className="bb-auth-heading mb-3">{t("missingTitle")}</h1>
              <p className="mb-6 text-sm leading-relaxed text-foreground">{t("missingMessage")}</p>
              {isLoggedIn ? (
                <Button
                  variant="primary"
                  onClick={handleResend}
                  disabled={resendStatus === "sending"}
                  size="auth"
                >
                  {resendStatus === "sending" ? t("resending") : t("resend")}
                </Button>
              ) : (
                <Button asChild variant="secondary" size="auth">
                  <Link href="/">{t("backToHome")}</Link>
                </Button>
              )}
              {resendStatus === "sent" && (
                <p className="mt-4 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-3 text-sm text-state-success-text">
                  {resendMsg}
                </p>
              )}
              {resendStatus === "error" && <p className="mt-4 text-sm text-destructive">{resendMsg}</p>}
            </>
          )}
        </div>
      </Container>
    </section>
  );
}
