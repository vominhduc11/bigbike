"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "@/i18n/StorefrontLink";
import { Button } from "@/components/ui/button";
import { env } from "@/env";

const API_BASE_URL = (env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");

type ViewState = "loading" | "ready" | "submitting" | "success" | "error" | "missing";

export function ReviewInvitationOptOutClient() {
  const t = useTranslations("ReviewInvitationOptOut");
  const [token, setToken] = useState("");
  const [state, setState] = useState<ViewState>("loading");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const value = params.get("token")?.trim() ?? "";
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    const timer = window.setTimeout(() => {
      setToken(value);
      setState(value ? "ready" : "missing");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function confirmOptOut() {
    if (!token) {
      setState("missing");
      return;
    }
    setState("submitting");
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/review-invitations/unsubscribe`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState(response.ok ? "success" : "error");
    } catch {
      setState("error");
    }
  }

  const isBusy = state === "loading" || state === "submitting";
  const title =
    state === "success"
      ? t("successTitle")
      : state === "error"
        ? t("errorTitle")
        : state === "missing"
          ? t("missingTitle")
          : state === "loading"
            ? t("loading")
            : t("confirmTitle");
  const message =
    state === "success"
      ? t("successMessage")
      : state === "error"
        ? t("errorMessage")
        : state === "missing"
          ? t("missingMessage")
          : state === "loading"
            ? t("loading")
            : t("confirmMessage");

  return (
    <section
      className="mx-auto max-w-2xl border border-border bg-background p-6 md:p-8"
      aria-live="polite"
    >
      <h2 className="m-0 font-body text-a3-section font-semibold text-foreground">{title}</h2>
      <p className="mb-0 mt-3 text-a4-content leading-relaxed text-muted-foreground">{message}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {(state === "ready" || state === "error" || state === "submitting") && (
          <Button type="button" disabled={isBusy} onClick={() => void confirmOptOut()}>
            {state === "submitting"
              ? t("submitting")
              : state === "error"
                ? t("retry")
                : t("confirm")}
          </Button>
        )}
        {(state === "success" || state === "missing") && (
          <Button asChild variant="outline">
            <Link href="/">{t("backHome")}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
