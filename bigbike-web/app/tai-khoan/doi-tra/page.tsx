"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createReturn, fetchMyOrders, fetchMyReturn, fetchMyReturns, fetchReturnEligibility } from "@/lib/api/client-api";
import type { CustomerReturn, OrderListItem, ReturnEligibility, ReturnEligibilityItem, ReturnEligibilityReason } from "@/lib/contracts/commerce";
import { AccountShell } from "@/components/layout/AccountShell";
import { formatDate, formatVnd } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RETURN_STATUS_KEYS = ["PENDING", "APPROVED", "REJECTED", "RECEIVED", "INSPECTING", "COMPLETED", "REFUNDED"] as const;
const RETURN_REASON_KEYS = ["DEFECTIVE", "WRONG_ITEM", "NOT_AS_DESCRIBED", "CHANGED_MIND", "OTHER"] as const;
type ReturnStatusKey = (typeof RETURN_STATUS_KEYS)[number];
type ReturnReasonKey = (typeof RETURN_REASON_KEYS)[number];

const RETURNABLE_STATUSES = ["COMPLETED"];

function isReturnStatus(s: string): s is ReturnStatusKey {
  return (RETURN_STATUS_KEYS as readonly string[]).includes(s);
}

function isReturnReason(s: string): s is ReturnReasonKey {
  return (RETURN_REASON_KEYS as readonly string[]).includes(s);
}

function returnStatusTone(status: string): StatusTone {
  const map: Record<string, StatusTone> = {
    COMPLETED: "success",
    REFUNDED: "success",
    APPROVED: "warning",
    RECEIVED: "warning",
    INSPECTING: "warning",
    REJECTED: "danger",
  };
  return map[status] ?? "neutral";
}

function ReturnDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
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
          <h3 className="text-sm font-bold text-foreground m-0 tracking-[0.04em]">{t("detailHeading")}</h3>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t("closeAria")}>✕</Button>
        </div>

        {loading && (
          <div className="bb-skel-stack p-6">
            {[1, 2, 3].map((i) => <div key={i} className="bb-skel bb-skel--text" style={{ width: "100%", height: 18, marginBottom: 12 }} />)}
          </div>
        )}

        {error && <p className="text-brand text-sm m-0 p-6">{error}</p>}

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
                { label: t("metaCreatedAt"), value: <b className="text-foreground font-semibold">{formatDate(detail.createdAt)}</b> },
              ].filter(Boolean).map((row, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">{row!.label}</span>
                  {row!.value}
                </div>
              ))}
            </div>

            {/* Customer note */}
            {detail.customerNote && (
              <div className="py-3 px-[14px] text-sm leading-[1.6] bg-[var(--bb-bg-surface-raised)] text-muted-foreground [&_p]:m-0">
                <p className="text-sm font-bold tracking-[0.1em] uppercase mb-[6px]">{t("customerNoteHeading")}</p>
                <p>{detail.customerNote}</p>
              </div>
            )}

            {/* Admin note */}
            {detail.adminNote && (
              <div className="py-3 px-[14px] text-sm leading-[1.6] bg-[var(--bb-state-warning-bg)] text-[var(--bb-state-warning-text)] border border-[var(--bb-state-warning-border)] [&_p]:m-0">
                <p className="text-sm font-bold tracking-[0.1em] uppercase mb-[6px]">{t("adminNoteHeading")}</p>
                <p>{detail.adminNote}</p>
              </div>
            )}

            {/* Items */}
            {detail.items && detail.items.length > 0 && (
              <div>
                <p className="text-sm font-bold tracking-[0.1em] uppercase text-muted-foreground m-0 mb-[10px]">{t("itemsHeading")}</p>
                <table className="w-full border-collapse text-sm text-foreground">
                  <thead>
                    <tr>
                      <th className="text-left text-sm tracking-[0.08em] uppercase text-muted-foreground py-1.5 border-b border-border">{t("colProduct")}</th>
                      <th className="text-center text-sm tracking-[0.08em] uppercase text-muted-foreground py-1.5 border-b border-border">{t("colQty")}</th>
                      <th className="text-right text-sm tracking-[0.08em] uppercase text-muted-foreground py-1.5 border-b border-border">{t("colUnitPrice")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 border-b border-border align-middle">
                          <span>{item.productName}</span>
                          {item.variantName && <span className="text-muted-foreground text-sm block">{item.variantName}</span>}
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
                <p className="text-sm font-bold tracking-[0.1em] uppercase text-muted-foreground m-0 mb-[10px]">{t("historyHeading")}</p>
                <ol className="list-none m-0 p-0 flex flex-col">
                  {detail.history.map((h, i) => (
                    <li key={i} className="flex gap-3 pb-4 relative last:pb-0 [&:not(:last-child)]:before:content-[''] [&:not(:last-child)]:before:absolute [&:not(:last-child)]:before:left-[5px] [&:not(:last-child)]:before:top-[14px] [&:not(:last-child)]:before:bottom-0 [&:not(:last-child)]:before:w-px [&:not(:last-child)]:before:bg-border">
                      <span className="bb-round w-[11px] h-[11px] rounded-full bg-brand flex-shrink-0 mt-[2px]" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground m-0 mb-[3px]">
                          {h.fromStatus ? `${statusLabel(h.fromStatus)} → ` : ""}
                          {statusLabel(h.toStatus)}
                        </p>
                        <p className="text-sm text-muted-foreground m-0 mb-[3px]">{formatDate(h.createdAt)}</p>
                        {h.note && <p className="text-sm text-muted-foreground m-0 italic">{h.note}</p>}
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

function ReturnsContent() {
  const t = useTranslations("Account.returns");
  const tStatus = useTranslations("Account.returns.status");
  const tReason = useTranslations("Account.returns.reason");
  const reasonLabel = (key: string) => (isReturnReason(key) ? tReason(key) : key);
  const statusLabel = (key: string) => (isReturnStatus(key) ? tStatus(key) : key);
  const [returns, setReturns] = useState<CustomerReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [returnableOrders, setReturnableOrders] = useState<OrderListItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [eligibility, setEligibility] = useState<ReturnEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [itemSelections, setItemSelections] = useState<Record<string, { selected: boolean; quantity: number }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  function loadReturns() {
    setLoading(true);
    fetchMyReturns()
      .then((data) => {
        setReturns(Array.isArray(data) ? data : []);
        setError("");
      })
      .catch((e: Error | undefined) => {
        if (e) setError(e.message ?? t("errorLoad"));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReturns();
  }, []);

  async function openForm() {
    setShowForm(true);
    setFormError("");
    setFormSuccess("");
    setOrdersLoading(true);
    try {
      // Fetch all orders (first page, large size) to find returnable ones
      const res = await fetchMyOrders(1);
      const eligible = res.data.filter((o) => RETURNABLE_STATUSES.includes(o.status));
      setReturnableOrders(eligible);
    } catch {
      setReturnableOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  function closeForm() {
    setShowForm(false);
    setFormError("");
    setFormSuccess("");
    setSelectedOrderId("");
    setEligibility(null);
    setItemSelections({});
  }

  async function handleOrderChange(orderId: string) {
    setSelectedOrderId(orderId);
    setEligibility(null);
    setItemSelections({});
    if (!orderId) return;
    setEligibilityLoading(true);
    try {
      const elig = await fetchReturnEligibility(orderId);
      setEligibility(elig);
      if (elig.eligible) {
        setItemSelections(Object.fromEntries(
          elig.items
            .filter((it) => it.returnableQuantity > 0)
            .map((it) => [it.orderLineItemId, { selected: false, quantity: 1 }])
        ));
      }
    } catch {
      setEligibility(null);
    } finally {
      setEligibilityLoading(false);
    }
  }

  function toggleLineItem(id: string) {
    setItemSelections((prev) => ({ ...prev, [id]: { ...prev[id], selected: !prev[id].selected } }));
  }

  function setLineItemQty(id: string, raw: number, max: number) {
    setItemSelections((prev) => ({ ...prev, [id]: { ...prev[id], quantity: Math.min(max, Math.max(1, raw)) } }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const fd = new FormData(e.currentTarget);
    const reason = (fd.get("reason") as string).trim();
    const customerNote = (fd.get("customerNote") as string).trim();

    if (!selectedOrderId) { setFormError(t("errorPickOrder")); return; }
    if (!reason) { setFormError(t("errorPickReason")); return; }

    const eligibleItems: ReturnEligibilityItem[] = eligibility?.items ?? [];
    const items = eligibleItems
      .filter((it) => itemSelections[it.orderLineItemId]?.selected)
      .map((it) => ({
        orderLineItemId: it.orderLineItemId,
        quantity: itemSelections[it.orderLineItemId].quantity,
      }));

    if (items.length === 0) { setFormError(t("errorPickItem")); return; }

    setSubmitting(true);
    try {
      await createReturn(selectedOrderId, { reason, customerNote: customerNote || undefined, items });
      setFormSuccess(t("successSubmitted"));
      closeForm();
      loadReturns();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex justify-between items-end mb-5 pb-4 border-b border-border">
        <div>
          <h2 className="font-display uppercase text-26 tracking-[0.01em] m-0 text-foreground">{t("heading")}</h2>
          <p className="text-sm text-muted-foreground mt-1 m-0">{t("subtitle")}</p>
        </div>
        {!showForm && (
          <Button type="button" variant="primary" size="sm" onClick={openForm}>
            {t("createButton")}
          </Button>
        )}
      </div>

      {formSuccess && (
        <div className="bg-[var(--bb-state-success-bg)] border border-[var(--bb-state-success-border)] p-[14px_18px] mb-5 text-sm text-[var(--bb-state-success-text)]">
          <p className="m-0">{formSuccess}</p>
        </div>
      )}

      {error && <p className="text-brand text-sm mb-4 m-0">{error}</p>}

      {/* Create return form */}
      {showForm && (
        <div className="bg-card border border-border p-[22px_24px] mb-6">
          <p className="text-sm font-bold tracking-[0.14em] uppercase text-muted-foreground mb-4">{t("createHeading")}</p>
          {formError && (
            <div className="bg-[var(--bb-state-danger-bg)] border border-[var(--bb-state-danger-border)] p-[14px_18px] mb-3 text-sm text-destructive">
              <p className="m-0">{formError}</p>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 col-span-full">
                <label className="text-sm font-bold tracking-[0.14em] uppercase text-muted-foreground">{t("orderLabel")}</label>
                {ordersLoading ? (
                  <span className="bb-skel bb-skel--text" style={{ width: "100%", display: "block", height: 38 }} />
                ) : returnableOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("noEligibleOrders")}
                  </p>
                ) : (
                  <Select value={selectedOrderId} onValueChange={handleOrderChange} required>
                    <SelectTrigger>
                      <SelectValue placeholder={t("orderPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {returnableOrders.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{t("orderOption", { orderNumber: o.orderNumber })}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Line items appear after an order is chosen */}
              {selectedOrderId && (
                <div className="flex flex-col gap-1.5 col-span-full">
                  <label className="text-sm font-bold tracking-[0.14em] uppercase text-muted-foreground mb-2 block">{t("pickItemLabel")}</label>
                  {eligibilityLoading ? (
                    <span className="bb-skel bb-skel--text" style={{ width: "100%", display: "block", height: 32 }} />
                  ) : !eligibility ? (
                    <p className="text-sm text-muted-foreground">{t("noItemsInOrder")}</p>
                  ) : !eligibility.eligible ? (
                    <div className="bg-[var(--bb-state-warning-bg)] border border-[var(--bb-state-warning-border)] p-[14px_18px] text-sm text-[var(--bb-state-warning-text)]">
                      <p className="m-0">{t(`eligibility.${eligibility.reason as ReturnEligibilityReason}`)}</p>
                    </div>
                  ) : (
                    eligibility.items
                      .filter((it) => it.returnableQuantity > 0)
                      .map((it) => (
                      <div key={it.orderLineItemId} className="flex items-center gap-2.5 mb-2.5">
                        <Checkbox
                          id={`dt-item-${it.orderLineItemId}`}
                          checked={itemSelections[it.orderLineItemId]?.selected ?? false}
                          onCheckedChange={() => toggleLineItem(it.orderLineItemId)}
                        />
                        <label htmlFor={`dt-item-${it.orderLineItemId}`} className="flex-1 cursor-pointer text-sm">
                          {it.productName}
                          {it.variantName ? <span className="text-muted-foreground"> ({it.variantName})</span> : null}
                          <span className="ml-1.5 text-muted-foreground">×{it.returnableQuantity}</span>
                        </label>
                        {itemSelections[it.orderLineItemId]?.selected && (
                          <Input
                            type="number"
                            min={1}
                            max={it.returnableQuantity}
                            value={itemSelections[it.orderLineItemId].quantity}
                            onChange={(e) => setLineItemQty(it.orderLineItemId, Number(e.target.value), it.returnableQuantity)}
                            className="w-16 text-center"
                            aria-label={t("lineQuantityAria", { productName: it.productName })}
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1.5 col-span-full">
                <label className="text-sm font-bold tracking-[0.14em] uppercase text-muted-foreground">{t("reasonLabel")}</label>
                <Select name="reason" required>
                  <SelectTrigger>
                    <SelectValue placeholder={t("reasonPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {RETURN_REASON_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>{tReason(key)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 col-span-full">
                <label className="text-sm font-bold tracking-[0.14em] uppercase text-muted-foreground">{t("noteLabel")}</label>
                <Textarea
                  name="customerNote"
                  rows={3}
                  placeholder={t("notePlaceholder")}
                  className="resize-y"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <Button type="submit" variant="primary" disabled={submitting || !selectedOrderId || eligibilityLoading || !eligibility?.eligible}>
                {submitting ? t("submitting") : t("submit")}
              </Button>
              <Button type="button" variant="secondary" onClick={closeForm} disabled={submitting}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="bb-skel-stack" aria-busy="true">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card border border-border mb-[14px] overflow-hidden">
              <div className="flex justify-between items-center py-[14px] px-5 bg-[var(--bb-bg-surface-raised)] border-b border-border gap-[14px] flex-wrap">
                <div className="bb-skel-row" style={{ flex: 1, gap: 22 }}>
                  <div className="bb-skel-col">
                    <span className="bb-skel bb-skel--text" style={{ width: 50 }} />
                    <span className="bb-skel bb-skel--text" style={{ width: 80 }} />
                  </div>
                  <div className="bb-skel-col">
                    <span className="bb-skel bb-skel--text" style={{ width: 50 }} />
                    <span className="bb-skel bb-skel--text" style={{ width: 90 }} />
                  </div>
                </div>
                <span className="bb-skel bb-skel--chip" style={{ width: 90 }} />
              </div>
            </div>
          ))}
        </div>
      ) : returns.length === 0 ? (
        <div className="text-center py-[60px] text-muted-foreground">
          <p className="text-muted-foreground text-sm m-0">{t("empty")}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-0">
            {returns.map((ret) => (
              <button
                key={ret.id}
                type="button"
                className="w-full text-left cursor-pointer bg-card border border-border mb-[14px] overflow-hidden transition-[border-color] duration-[140ms] hover:border-[var(--bb-border-strong)]"
                onClick={() => setSelectedId(ret.id)}
              >
                <div className="flex justify-between items-center py-[14px] px-5 bg-[var(--bb-bg-surface-raised)] border-b border-border gap-[14px] flex-wrap">
                  <div className="flex gap-[22px] max-sm:flex-wrap max-sm:gap-x-[18px] max-sm:gap-y-3">
                    <div className="text-sm text-muted-foreground tracking-[0.1em] uppercase">
                      {t("metaCode")}
                      <b className="block text-sm text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case font-mono">{ret.returnNumber}</b>
                    </div>
                    {ret.orderNumber && (
                      <div className="text-sm text-muted-foreground tracking-[0.1em] uppercase">
                        {t("metaOrder")}
                        <b className="block text-sm text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case font-mono">#{ret.orderNumber}</b>
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground tracking-[0.1em] uppercase">
                      {t("metaReason")}
                      <b className="block text-sm text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case">{reasonLabel(ret.reason)}</b>
                    </div>
                    <div className="text-sm text-muted-foreground tracking-[0.1em] uppercase">
                      {t("metaCreatedAt")}
                      <b className="block text-sm text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case font-mono">{formatDate(ret.createdAt)}</b>
                    </div>
                    {ret.refundAmount > 0 && (
                      <div className="text-sm text-muted-foreground tracking-[0.1em] uppercase">
                        {t("metaRefund")}
                        <b className="block text-sm text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case">{formatVnd(ret.refundAmount)}</b>
                      </div>
                    )}
                  </div>
                  <StatusBadge tone={returnStatusTone(ret.status)}>
                    {statusLabel(ret.status)}
                  </StatusBadge>
                </div>
              </button>
            ))}
          </div>

          {selectedId && (
            <ReturnDetailPanel key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} />
          )}
        </>
      )}
    </>
  );
}

export default function ReturnsPage() {
  return (
    <AccountShell loginRedirect="/tai-khoan/doi-tra/">
      <ReturnsContent />
    </AccountShell>
  );
}

