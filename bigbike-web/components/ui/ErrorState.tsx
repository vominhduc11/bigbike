"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title?: string;
  message: string;
  retryHref?: string;
};

export function ErrorState({ title, message, retryHref }: ErrorStateProps) {
  const t = useTranslations("States");
  return (
    <section
      className="bb-error-state grid justify-items-center gap-3 border border-border bg-card p-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <h2 className="font-heading text-base font-semibold uppercase text-foreground m-0">
        {title ?? t("errorTitle")}
      </h2>
      <p className="m-0 text-muted-foreground">{message}</p>
      {retryHref ? (
        <Button asChild variant="primary">
          <Link href={retryHref}>{t("retry")}</Link>
        </Button>
      ) : null}
    </section>
  );
}
