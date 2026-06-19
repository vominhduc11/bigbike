"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/layout/Container";
import { MediaImage } from "@/components/ui/MediaImage";
import { lookupWarranty, type WarrantyLookupResult } from "@/lib/api/client-api";
import { LocalDate } from "@/components/i18n/LocalDate";
import { fieldLabel } from "@/lib/ui-classes";

/**
 * Toàn bộ chữ của trang Bảo hành, đã được trang chủ (server) resolve theo thứ tự
 * settings-first → fallback i18n. Hai khối rich-text (introHtml/policyHtml) đã được
 * sanitize sẵn; rỗng nghĩa là admin chưa soạn → ẩn.
 */
export type WarrantyCopy = {
  kicker: string;
  subheading: string;
  serialLabel: string;
  serialPlaceholder: string;
  serialHint: string;
  submitButton: string;
  submitting: string;
  notFound: string;
  resultHeading: string;
  fieldProduct: string;
  fieldSerial: string;
  fieldStart: string;
  fieldEnd: string;
  statusActiveTpl: string;
  statusAlmostExpiredTpl: string;
  statusExpired: string;
  statusVoided: string;
  footerActive: string;
  footerVoided: string;
  introHtml: string;
  introImage: string;
  policyHtml: string;
};

function fillDays(template: string, daysLeft: number): string {
  return template.replace("{daysLeft}", String(daysLeft));
}

function StatusBadge({
  status,
  daysLeft,
  copy,
}: {
  status: WarrantyLookupResult["status"];
  daysLeft: number;
  copy: WarrantyCopy;
}) {
  if (status === "VOIDED") {
    return <Badge variant="outline">{copy.statusVoided}</Badge>;
  }
  if (status === "EXPIRED") {
    return <Badge variant="destructive">{copy.statusExpired}</Badge>;
  }
  if (daysLeft <= 30) {
    return <Badge variant="warning">{fillDays(copy.statusAlmostExpiredTpl, daysLeft)}</Badge>;
  }
  return <Badge variant="success">{fillDays(copy.statusActiveTpl, daysLeft)}</Badge>;
}

export function WarrantyContent({ copy }: { copy: WarrantyCopy }) {
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
        setError(err instanceof Error ? err.message : copy.notFound);
      }
    });
  }

  return (
    <Container className="max-w-[560px] py-10">
      <div className="mb-7 pb-[22px] border-b border-border">
        <span className="text-sm tracking-display uppercase text-brand font-bold block mb-2">{copy.kicker}</span>
        <p className="text-muted-foreground text-body mt-2 m-0">{copy.subheading}</p>
      </div>

      {/* Khối giới thiệu admin tự soạn (tuỳ chọn) — ảnh + rich-text, rỗng thì ẩn */}
      {(copy.introHtml || copy.introImage) && (
        <div className="mb-6 flex flex-col gap-4">
          {copy.introImage && (
            <MediaImage
              image={{ url: copy.introImage }}
              altFallback={copy.kicker}
              width={560}
              height={280}
              className="w-full h-auto"
            />
          )}
          {copy.introHtml && (
            <div
              className="static-page wyswyg text-body text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: copy.introHtml }}
            />
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border border-border py-[22px] px-6 mb-[18px] mt-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="serial-input" className={fieldLabel}>
            {copy.serialLabel}<span className="text-brand ml-[3px]">*</span>
          </label>
          <div className="flex gap-2 max-sm:flex-col">
            <Input
              id="serial-input"
              className="flex-1"
              placeholder={copy.serialPlaceholder}
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
              {isPending ? copy.submitting : copy.submitButton}
            </Button>
          </div>
          <p className="text-muted-foreground text-caption mt-1.5 m-0">
            {copy.serialHint}
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
            <h3 className="m-0">{copy.resultHeading}</h3>
            <StatusBadge status={result.status} daysLeft={result.daysLeft} copy={copy} />
          </div>

          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="text-muted-foreground text-sm w-[40%] py-1.5">{copy.fieldProduct}</td>
                <td className="py-1.5 font-semibold">{result.productName}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm py-1.5">{copy.fieldSerial}</td>
                <td className="py-1.5 font-mono">{result.serialNumber}</td>
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm py-1.5">{copy.fieldStart}</td>
                <td className="py-1.5"><LocalDate value={result.startDate} dateStyle="slashPad" fallback="—" /></td>
              </tr>
              <tr>
                <td className="text-muted-foreground text-sm py-1.5">{copy.fieldEnd}</td>
                <td className="py-1.5"><LocalDate value={result.endDate} dateStyle="slashPad" fallback="—" /></td>
              </tr>
            </tbody>
          </table>

          {result.status === "ACTIVE" && (
            <p className="text-muted-foreground text-sm mt-3 m-0">
              {copy.footerActive}
            </p>
          )}
          {result.status === "VOIDED" && (
            <p className="mt-3 text-sm text-destructive m-0">
              {copy.footerVoided}
            </p>
          )}
        </div>
      )}

      {/* Khối chính sách / FAQ admin tự soạn (tuỳ chọn) — rỗng thì ẩn */}
      {copy.policyHtml && (
        <div
          className="static-page wyswyg text-body mt-8 pt-6 border-t border-border"
          dangerouslySetInnerHTML={{ __html: copy.policyHtml }}
        />
      )}
    </Container>
  );
}
