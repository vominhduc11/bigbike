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
    <section className="bb-page">
      <div className="bb-container">
        <section className="bb-error-state" role="alert" aria-live="assertive">
          <h1>{t("heading")}</h1>
          <p>{t("description")}</p>
          <Button type="button" variant="primary" onClick={unstable_retry}>
            {t("retry")}
          </Button>
        </section>
      </div>
    </section>
  );
}
