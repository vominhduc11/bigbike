"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createReturn, fetchMyOrders, fetchMyReturns, fetchReturnEligibility } from "@/lib/api/client-api";
import type { CustomerReturn, OrderListItem, ReturnEligibility, ReturnEligibilityItem, ReturnEligibilityReason } from "@/lib/contracts/commerce";
import { WpAccountSectionHeading } from "@/components/wp/WpAccountNav";
import { formatVnd } from "@/lib/utils/format";
import { LocalDate } from "@/components/i18n/LocalDate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { FormNotice } from "@/components/ui/FormNotice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { detailTableCell, fieldLabel, metaLabel, skelBase, skelCol, skelRow, skelStack } from "@/lib/ui-classes";
import { ReturnDetailPanel } from "./returns/ReturnDetailPanel";
import {
  RETURNABLE_STATUSES,
  RETURNS_PAGE_SIZE,
  RETURN_REASON_KEYS,
  isReturnReason,
  isReturnStatus,
  returnStatusTone,
} from "./returns/shared";

export function ReturnsContent() {
  const t = useTranslations("Account.returns");
  const tStatus = useTranslations("Account.returns.status");
  const tReason = useTranslations("Account.returns.reason");
  const reasonLabel = (key: string) => (isReturnReason(key) ? tReason(key) : key);
  const statusLabel = (key: string) => (isReturnStatus(key) ? tStatus(key) : key);
  const [returns, setReturns] = useState<CustomerReturn[]>([]);
  // A customer's returns are bounded by their orders, so we fetch them all (cheap)
  // and paginate client-side — each page replaces the list so the section keeps a
  // fixed height no matter how long the history grows.
  const [page, setPage] = useState(1);
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
        setPage(1);
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
      <WpAccountSectionHeading title={t("heading")} />

      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <p className="text-caption text-muted-foreground m-0">{t("subtitle")}</p>
        {!showForm && (
          <Button type="button" variant="primary" size="sm" onClick={openForm}>
            {t("createButton")}
          </Button>
        )}
      </div>

      {formSuccess && (
        <FormNotice tone="success" className="p-[14px_18px] mb-5"><p className="m-0">{formSuccess}</p></FormNotice>
      )}

      {error && <p className="text-brand text-caption mb-4 m-0">{error}</p>}

      {/* Create return form */}
      {showForm && (
        <div className="bg-card border border-border p-[22px_24px] mb-6">
          <p className={cn(fieldLabel, "mb-4")}>{t("createHeading")}</p>
          {formError && (
            <FormNotice tone="danger" className="p-[14px_18px] mb-3"><p className="m-0">{formError}</p></FormNotice>
          )}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 col-span-full">
                <label className={fieldLabel}>{t("orderLabel")}</label>
                {ordersLoading ? (
                  <span className={cn(skelBase, "h-[0.85em]")} style={{ width: "100%", display: "block", height: 38 }} />
                ) : returnableOrders.length === 0 ? (
                  <p className="text-caption text-muted-foreground">
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
                  <label className={cn(fieldLabel, "mb-2 block")}>{t("pickItemLabel")}</label>
                  {eligibilityLoading ? (
                    <span className={cn(skelBase, "h-[0.85em]")} style={{ width: "100%", display: "block", height: 32 }} />
                  ) : !eligibility ? (
                    <p className="text-caption text-muted-foreground">{t("noItemsInOrder")}</p>
                  ) : !eligibility.eligible ? (
                    <FormNotice tone="warning" className="p-[14px_18px]"><p className="m-0">{t(`eligibility.${eligibility.reason as ReturnEligibilityReason}`)}</p></FormNotice>
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
                        <label htmlFor={`dt-item-${it.orderLineItemId}`} className="flex-1 cursor-pointer text-caption">
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
                <label className={fieldLabel}>{t("reasonLabel")}</label>
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
                <label className={fieldLabel}>{t("noteLabel")}</label>
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
        <div className={skelStack} aria-busy="true">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card border border-border mb-[14px] overflow-hidden">
              <div className="flex justify-between items-center py-[14px] px-5 bg-[var(--bb-bg-surface-raised)] border-b border-border gap-[14px] flex-wrap">
                <div className={skelRow} style={{ flex: 1, gap: 22 }}>
                  <div className={skelCol}>
                    <span className={cn(skelBase, "h-[0.85em]")} style={{ width: 50 }} />
                    <span className={cn(skelBase, "h-[0.85em]")} style={{ width: 80 }} />
                  </div>
                  <div className={skelCol}>
                    <span className={cn(skelBase, "h-[0.85em]")} style={{ width: 50 }} />
                    <span className={cn(skelBase, "h-[0.85em]")} style={{ width: 90 }} />
                  </div>
                </div>
                <span className={cn(skelBase, "h-[1.6rem]")} style={{ width: 90 }} />
              </div>
            </div>
          ))}
        </div>
      ) : returns.length === 0 ? (
        <div className="text-center py-[60px] text-muted-foreground">
          <p className="text-muted-foreground text-caption m-0">{t("empty")}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-0">
            {returns.slice((page - 1) * RETURNS_PAGE_SIZE, page * RETURNS_PAGE_SIZE).map((ret) => (
              <button
                key={ret.id}
                type="button"
                className="w-full text-left cursor-pointer bg-card border border-border mb-[14px] overflow-hidden transition-[border-color] duration-[140ms] hover:border-[var(--bb-border-strong)]"
                onClick={() => setSelectedId(ret.id)}
              >
                <div className="flex justify-between items-center py-[14px] px-5 bg-[var(--bb-bg-surface-raised)] border-b border-border gap-[14px] flex-wrap">
                  <div className="flex gap-[22px] max-sm:flex-wrap max-sm:gap-x-[18px] max-sm:gap-y-3">
                    <div className={metaLabel}>
                      {t("metaCode")}
                      <b className={cn(detailTableCell, "font-mono")}>{ret.returnNumber}</b>
                    </div>
                    {ret.orderNumber && (
                      <div className={metaLabel}>
                        {t("metaOrder")}
                        <b className={cn(detailTableCell, "font-mono")}>#{ret.orderNumber}</b>
                      </div>
                    )}
                    <div className={metaLabel}>
                      {t("metaReason")}
                      <b className={detailTableCell}>{reasonLabel(ret.reason)}</b>
                    </div>
                    <div className={metaLabel}>
                      {t("metaCreatedAt")}
                      <b className={cn(detailTableCell, "font-mono")}><LocalDate value={ret.createdAt} dateStyle="slashPad" fallback="—" /></b>
                    </div>
                    {ret.refundAmount > 0 && (
                      <div className={metaLabel}>
                        {t("metaRefund")}
                        <b className={detailTableCell}>{formatVnd(ret.refundAmount)}</b>
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

          <PaginationNav
            page={page}
            totalPages={Math.ceil(returns.length / RETURNS_PAGE_SIZE)}
            onPageChange={setPage}
          />

          {selectedId && (
            <ReturnDetailPanel key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} />
          )}
        </>
      )}
    </>
  );
}
