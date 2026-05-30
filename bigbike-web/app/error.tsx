"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function GlobalRouteError({
  error,
  unstable_retry,
}: {
  error: Error;
  unstable_retry: () => void;
}) {
  const t = useTranslations("AppError");

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <section
      className="bb-page flex flex-col items-center justify-center"
      style={{ minHeight: "calc(100dvh - var(--bb-header-stack))" }}
    >
      <div className="bb-container">
        <section
          className="bb-error-state mx-auto max-w-md grid justify-items-center gap-6 border border-border bg-card p-10 text-center"
          role="alert"
          aria-live="assertive"
        >
          <h1 className="m-0">{t("heading")}</h1>
          <p className="m-0 text-sm text-muted-foreground">{t("description")}</p>
          <Button type="button" variant="primary" onClick={unstable_retry}>
            {t("retry")}
          </Button>
        </section>
      </div>
    </section>
  );
}
