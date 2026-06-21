"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { fetchMyReturn } from "@/lib/api/client-api";
import type { CustomerReturn } from "@/lib/contracts/commerce";
import { formatVnd } from "@/lib/utils/format";
import { LocalDate } from "@/components/i18n/LocalDate";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { fieldLabel, metaLabel, skelBase, skelStack } from "@/lib/ui-classes";
import { isReturnReason, isReturnStatus, returnStatusTone } from "./shared";

/** Drawer chi tiết một yêu cầu đổi/trả: meta, ghi chú KH/admin, danh sách món, lịch sử trạng thái. */
export function ReturnDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations("Account.returns");
  const tStatus = useTranslations("Account.returns.status");
  const tReason = useTranslations("Account.returns.reason");
  const [detail, setDetail] = useState<CustomerReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMyReturn(id)
      .then((d) => { setDetail(d); setError(""); })
      .catch((e: Error | undefined) => setError(e?.message ?? t("detailError")))
      .finally(() => setLoading(false));
  }, [id, t]);

  const reasonLabel = (key: string) => (isReturnReason(key) ? tReason(key) : key);
  const statusLabel = (key: string) => (isReturnStatus(key) ? tStatus(key) : key);

  return (
    <div className="fixed inset-0 bg-black/65 z-[2000] flex justify-end" role="dialog" aria-modal="true">
      <div className="w-[min(480px,100vw)] h-full bg-card border-l border-border flex flex-col overflow-hidden">
        <div className="flex justify-between items-center py-[18px] px-[22px] border-b border-border flex-shrink-0">
          <h3 className="text-caption font-bold text-foreground m-0 tracking-wide">{t("detailHeading")}</h3>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t("closeAria")}>✕</Button>
        </div>

        {loading && (
          <div className={cn(skelStack, "p-6")}>
            {[1, 2, 3].map((i) => <div key={i} className={cn(skelBase, "h-[0.85em]")} style={{ width: "100%", height: 18, marginBottom: 12 }} />)}
          </div>
        )}

        {error && <p className="text-brand text-caption m-0 p-6">{error}</p>}

        {detail && !loading && (
          <div className="flex-1 overflow-y-auto py-5 px-[22px] flex flex-col gap-[18px]">
            {/* Meta */}
            <div className="flex flex-col gap-[10px]">
              {[
                { label: t("metaCode"), value: <b className="text-foreground font-semibold font-mono">{detail.returnNumber}</b> },
                detail.orderNumber ? { label: t("metaOrder"), value: <b className="text-foreground font-semibold">#{detail.orderNumber}</b> } : null,
                { label: t("metaReason"), value: <b className="text-foreground font-semibold">{reasonLabel(detail.reason)}</b> },
                {
                  label: t("metaStatus"),
                  value: <StatusBadge tone={returnStatusTone(detail.status)}>{statusLabel(detail.status)}</StatusBadge>,
                },
                detail.refundAmount > 0 ? { label: t("metaRefund"), value: <b className="text-foreground font-semibold">{formatVnd(detail.refundAmount)}</b> } : null,
                { label: t("metaCreatedAt"), value: <b className="text-foreground font-semibold"><LocalDate value={detail.createdAt} dateStyle="slashPad" fallback="—" /></b> },
              ].filter(Boolean).map((row, i) => (
                <div key={i} className="flex justify-between items-center text-caption">
                  <span className="text-muted-foreground">{row!.label}</span>
                  {row!.value}
                </div>
              ))}
            </div>

            {/* Customer note */}
            {detail.customerNote && (
              <div className="py-3 px-[14px] text-caption leading-body bg-[var(--bb-bg-surface-raised)] text-muted-foreground [&_p]:m-0">
                <p className="text-caption font-bold tracking-display uppercase mb-[6px]">{t("customerNoteHeading")}</p>
                <p>{detail.customerNote}</p>
              </div>
            )}

            {/* Admin note */}
            {detail.adminNote && (
              <div className="py-3 px-[14px] text-caption leading-body bg-[var(--bb-state-warning-bg)] text-state-warning-text border border-[var(--bb-state-warning-border)] [&_p]:m-0">
                <p className="text-caption font-bold tracking-display uppercase mb-[6px]">{t("adminNoteHeading")}</p>
                <p>{detail.adminNote}</p>
              </div>
            )}

            {/* Items */}
            {detail.items && detail.items.length > 0 && (
              <div>
                <p className={cn(fieldLabel, "mb-[10px]")}>{t("itemsHeading")}</p>
                <table className="w-full border-collapse text-caption text-foreground">
                  <thead>
                    <tr>
                      <th className={cn(metaLabel, "text-left py-1.5 border-b border-border")}>{t("colProduct")}</th>
                      <th className={cn(metaLabel, "text-center py-1.5 border-b border-border")}>{t("colQty")}</th>
                      <th className={cn(metaLabel, "text-right py-1.5 border-b border-border")}>{t("colUnitPrice")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 border-b border-border align-middle">
                          <span>{item.productName}</span>
                          {item.variantName && <span className="text-muted-foreground text-caption block">{item.variantName}</span>}
                        </td>
                        <td className="text-center py-2 border-b border-border align-middle">{item.quantity}</td>
                        <td className="text-right py-2 border-b border-border align-middle">{formatVnd(item.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* History */}
            {detail.history && detail.history.length > 0 && (
              <div>
                <p className={cn(fieldLabel, "mb-[10px]")}>{t("historyHeading")}</p>
                <ol className="list-none m-0 p-0 flex flex-col">
                  {detail.history.map((h, i) => (
                    <li key={i} className="flex gap-3 pb-4 relative last:pb-0 [&:not(:last-child)]:before:content-[''] [&:not(:last-child)]:before:absolute [&:not(:last-child)]:before:left-[5px] [&:not(:last-child)]:before:top-[14px] [&:not(:last-child)]:before:bottom-0 [&:not(:last-child)]:before:w-px [&:not(:last-child)]:before:bg-border">
                      <span className="bb-round w-[11px] h-[11px] rounded-full bg-brand flex-shrink-0 mt-[2px]" />
                      <div className="flex-1">
                        <p className="text-caption font-semibold text-foreground m-0 mb-[3px]">
                          {h.fromStatus ? `${statusLabel(h.fromStatus)} → ` : ""}
                          {statusLabel(h.toStatus)}
                        </p>
                        <p className="text-caption text-muted-foreground m-0 mb-[3px]"><LocalDate value={h.createdAt} dateStyle="slashPad" fallback="—" /></p>
                        {h.note && <p className="text-caption text-muted-foreground m-0 italic">{h.note}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
