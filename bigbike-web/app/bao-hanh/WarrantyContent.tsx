"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { lookupWarranty, type WarrantyLookupResult } from "@/lib/api/client-api";
import { formatDate } from "@/lib/utils/format";

function StatusBadge({ status, daysLeft, t }: { status: WarrantyLookupResult["status"]; daysLeft: number; t: ReturnType<typeof useTranslations<"Warranty">> }) {
  if (status === "VOIDED") {
    return <Badge variant="outline">{t("statusVoided")}</Badge>;
  }
  if (status === "EXPIRED") {
    return <Badge variant="destructive">{t("statusExpired")}</Badge>;
  }
  if (daysLeft <= 30) {
    return <Badge variant="warning">{t("statusAlmostExpired", { daysLeft })}</Badge>;
  }
  return <Badge variant="success">{t("statusActive", { daysLeft })}</Badge>;
}

export function WarrantyContent() {
  const t = useTranslations("Warranty");
  const [serial, setSerial] = useState("");
  const [result, setResult] = useState<WarrantyLookupResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = serial.trim();
    if (!trimmed) return;

    setResult(null);
    setError("");

    startTransition(async () => {
      try {
        const data = await lookupWarranty(trimmed);
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("notFound"));
      }
    });
  }

  return (
    <div className="bb-container max-w-[560px] py-10">
      <div className="mb-7 pb-[22px] border-b border-border">
        <span className="text-sm tracking-display uppercase text-brand font-bold block mb-2">{t("kicker")}</span>
        <p className="text-muted-foreground text-sm mt-2 m-0">{t("subheading")}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border py-[22px] px-6 mb-[18px] mt-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="serial-input" className="text-sm font-bold tracking-display uppercase text-muted-foreground">
            {t("serialLabel")}<span className="text-brand ml-[3px]">*</span>
          </label>
          <div className="flex gap-2 max-sm:flex-col">
            <Input
              id="serial-input"
              className="flex-1"
              placeholder={t("serialPlaceholder")}
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              maxLength={100}
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isPending || !serial.trim()}
            >
              {isPending ? t("submitting") : t("submitButton")}
            </Button>
          </div>
          <p className="text-muted-foreground text-sm mt-1.5 m-0">
            {t("serialHint")}
          </p>
        </div>
      </form>

      {error && (
        <div className="bg-[var(--bb-state-danger-bg)] border border-[var(--bb-state-danger-border)] p-[14px_18px] text-sm text-destructive mt-4">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-card border border-border py-[22px] px-6 mb-[18px] mt-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h3 className="m-0">{t("resultHeading")}</h3>
            <StatusBadge status={result.status} daysLeft={result.daysLeft} t={t} />
          </div>

          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="text-muted-foreground text-sm w-[40%] py-1.5">{t("fieldProduct")}</td>
                <td className="py-1.5 font-semibold">{result.productName}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm py-1.5">{t("fieldSerial")}</td>
                <td className="py-1.5 font-mono">{result.serialNumber}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm py-1.5">{t("fieldStart")}</td>
                <td className="py-1.5">{formatDate(result.startDate)}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm py-1.5">{t("fieldEnd")}</td>
                <td className="py-1.5">{formatDate(result.endDate)}</td>
              </tr>
            </tbody>
          </table>

          {result.status === "ACTIVE" && (
            <p className="text-muted-foreground text-sm mt-3 m-0">
              {t("footerActive")}
            </p>
          )}
          {result.status === "VOIDED" && (
            <p className="mt-3 text-sm text-destructive m-0">
              {t("footerVoided")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
