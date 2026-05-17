"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchMyOrders } from "@/lib/api/client-api";
import type { OrderListItem } from "@/lib/contracts/commerce";
import { AccountShell } from "@/components/layout/AccountShell";
import { formatDate, formatVnd } from "@/lib/utils/format";
import { toOrderDetailPath } from "@/lib/utils/routes";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Ch\u1edd x\u00e1c nh\u1eadn",
  ON_HOLD: "T\u1ea1m gi\u1eef",
  PROCESSING: "\u0110ang x\u1eed l\u00fd",
  COMPLETED: "Ho\u00e0n th\u00e0nh",
  CANCELLED: "\u0110\u00e3 hu\u1ef7",
  REFUNDED: "Ho\u00e0n ti\u1ec1n",
  FAILED: "Th\u1ea5t b\u1ea1i",
};

function orderStatusTone(status: string): StatusTone {
  const map: Record<string, StatusTone> = {
    COMPLETED: "success",
    PROCESSING: "warning",
    ON_HOLD: "warning",
    CANCELLED: "danger",
    REFUNDED: "danger",
    FAILED: "danger",
  };
  return map[status] ?? "neutral";
}

const TABS = [
  { key: "ALL", label: "T\u1ea5t c\u1ea3" },
  { key: "PROCESSING", label: "\u0110ang x\u1eed l\u00fd" },
  { key: "COMPLETED", label: "Ho\u00e0n th\u00e0nh" },
  { key: "CANCELLED", label: "\u0110\u00e3 hu\u1ef7" },
];

function OrderHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState<number | undefined>(undefined);
  const [error, setError] = useState("");
  const activeTab = searchParams.get("status") ?? "ALL";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const statusParam = activeTab !== "ALL" ? activeTab : undefined;
    fetchMyOrders(page, statusParam)
      .then((res) => {
        setOrders(res.data);
        setTotalPages(res.pagination?.totalPages ?? 1);
        setTotalItems(res.pagination?.totalItems);
        setError("");
      })
      .catch((e: Error | undefined) => {
        if (e) setError(e.message ?? "Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c \u0111\u01a1n h\u00e0ng.");
      })
      .finally(() => setLoading(false));
  }, [page, activeTab]);

  function handleTabClick(tabKey: string) {
    const url = tabKey === "ALL"
      ? "/tai-khoan/don-hang/"
      : `/tai-khoan/don-hang/?status=${tabKey}`;
    setPage(1);
    router.replace(url, { scroll: false });
  }

  return (
    <>
      <div className="flex justify-between items-end mb-5 pb-4 border-b border-border">
        <div>
          <h2 className="font-display uppercase text-[26px] tracking-[0.01em] m-0 text-foreground">{"\u0110\u01a1n h\u00e0ng"}</h2>
          <p className="text-xs text-muted-foreground mt-1 m-0">
            {totalItems !== undefined
              ? `${totalItems} \u0111\u01a1n h\u00e0ng`
              : orders.length > 0
              ? `${orders.length} \u0111\u01a1n h\u00e0ng`
              : "L\u1ecbch s\u1eed mua h\u00e0ng"}
          </p>
        </div>
      </div>

      <div className="flex gap-0 mb-5 border-b border-border overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <Button
            key={tab.key}
            type="button"
            variant="ghost"
            className={`px-5 py-3 h-auto rounded-none text-[11px] font-bold tracking-[0.12em] uppercase border-b-2 -mb-px flex-shrink-0 transition-colors ${activeTab === tab.key ? "text-foreground border-b-brand" : "text-muted-foreground border-b-transparent hover:text-foreground"}`}
            onClick={() => handleTabClick(tab.key)}
          >
            {tab.label}
            {tab.key === activeTab && totalItems !== undefined && tab.key !== "ALL" && (
              <span className="ml-2 bg-[var(--bb-bg-surface-raised)] py-[2px] px-[7px] rounded-full text-xs">{totalItems}</span>
            )}
          </Button>
        ))}
      </div>

      {error && <p className="text-brand text-sm mb-4 m-0">{error}</p>}

      {loading ? (
        <div className="bb-skel-stack" aria-busy="true">
          {[1, 2, 3].map((i) => (
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
                  <div className="bb-skel-col">
                    <span className="bb-skel bb-skel--text" style={{ width: 50 }} />
                    <span className="bb-skel bb-skel--text" style={{ width: 70 }} />
                  </div>
                </div>
                <span className="bb-skel bb-skel--chip" style={{ width: 90 }} />
              </div>
              <div className="flex py-4 px-5 gap-[18px] items-center max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
                <div className="bb-skel-row">
                  <span className="bb-skel" style={{ width: 56, height: 56, borderRadius: "var(--bb-radius-sm)" }} />
                  <span className="bb-skel" style={{ width: 56, height: 56, borderRadius: "var(--bb-radius-sm)" }} />
                </div>
                <div className="bb-skel-col" style={{ flex: 1 }}>
                  <span className="bb-skel bb-skel--text bb-skel-w-60" />
                  <span className="bb-skel bb-skel--text bb-skel-w-40" />
                </div>
                <div className="bb-skel-col" style={{ alignItems: "flex-end" }}>
                  <span className="bb-skel bb-skel--title" style={{ width: 120, height: "1.2em" }} />
                  <span className="bb-skel bb-skel--text" style={{ width: 80 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-[60px] text-muted-foreground">
          <p className="text-muted-foreground text-sm m-0">{"Kh\u00f4ng c\u00f3 \u0111\u01a1n h\u00e0ng n\u00e0o."}</p>
        </div>
      ) : (
        <>
          {orders.map((order) => (
            <div key={order.id} className="bg-card border border-border mb-[14px] overflow-hidden">
              <div className="flex justify-between items-center py-[14px] px-5 bg-[var(--bb-bg-surface-raised)] border-b border-border gap-[14px] flex-wrap">
                <div className="flex gap-[22px] max-sm:flex-wrap max-sm:gap-x-[18px] max-sm:gap-y-3">
                  <div className="text-xs text-muted-foreground tracking-[0.1em] uppercase">
                    {"M\u00e3 \u0111\u01a1n"}
                    <b className="block text-[12px] text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case font-mono">#{order.orderNumber}</b>
                  </div>
                  <div className="text-xs text-muted-foreground tracking-[0.1em] uppercase">
                    {"Ng\u00e0y \u0111\u1eb7t"}
                    <b className="block text-[12px] text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case font-mono">{formatDate(order.placedAt)}</b>
                  </div>
                  <div className="text-xs text-muted-foreground tracking-[0.1em] uppercase">
                    {"S\u1ea3n ph\u1ea9m"}
                    <b className="block text-[12px] text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case font-mono">{`${order.itemCount} m\u00f3n`}</b>
                  </div>
                </div>
                <StatusBadge tone={orderStatusTone(order.status)}>
                  {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </StatusBadge>
              </div>
              <div className="flex py-4 px-5 gap-[18px] items-center max-sm:flex-col max-sm:items-stretch max-sm:gap-3">
                <div className="flex gap-2 max-sm:overflow-x-auto">
                  <div className="w-14 h-14 bg-[var(--bb-bg-surface-raised)] border border-border flex items-center justify-center font-display text-[9px] text-muted-foreground uppercase overflow-hidden flex-shrink-0">BB</div>
                </div>
                <div className="flex-1 min-w-0">
                  <b className="block text-sm text-foreground mb-[3px]">{`${order.itemCount} s\u1ea3n ph\u1ea9m`}</b>
                  <span className="text-[11px] text-muted-foreground">{formatDate(order.placedAt)}</span>
                </div>
                <div className="text-right max-sm:text-left">
                  <b className="block font-display text-[18px] text-brand tracking-[0.01em] leading-[1] mb-1">{formatVnd(order.totalAmount)}</b>
                  <span className="text-xs text-muted-foreground tracking-[0.1em] uppercase">{order.currency}</span>
                </div>
              </div>
              <div className="flex gap-2 py-3 px-5 border-t border-border bg-[var(--bb-bg-surface-raised)]">
                <Button asChild variant="secondary" size="sm">
                  <Link href={toOrderDetailPath(order.id)}>{"Xem chi ti\u1ebft"}</Link>
                </Button>
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="flex gap-[10px] items-center mt-5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                {"Trang tr\u01b0\u1edbc"}
              </Button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Trang sau
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function OrderHistoryPage() {
  return (
    <AccountShell loginRedirect="/tai-khoan/don-hang/">
      <OrderHistoryContent />
    </AccountShell>
  );
}
