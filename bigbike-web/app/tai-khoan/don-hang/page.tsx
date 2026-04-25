"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMyOrders } from "@/lib/api/client-api";
import type { OrderListItem } from "@/lib/contracts/commerce";
import { AccountShell } from "@/components/layout/AccountShell";
import { formatDate, formatVnd } from "@/lib/utils/format";
import { toOrderDetailPath } from "@/lib/utils/routes";

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PROCESSING: "Đang xử lý",
  SHIPPED: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
  REFUNDED: "Hoàn tiền",
};

function orderStatusClass(status: string): string {
  const map: Record<string, string> = {
    DELIVERED: "delivered",
    SHIPPED: "shipping",
    PROCESSING: "processing",
    CANCELLED: "cancelled",
    REFUNDED: "cancelled",
  };
  return map[status] ?? "";
}

const TABS = [
  { key: "ALL", label: "Tất cả" },
  { key: "PROCESSING", label: "Đang xử lý" },
  { key: "SHIPPED", label: "Đang giao" },
  { key: "DELIVERED", label: "Đã giao" },
  { key: "CANCELLED", label: "Đã hủy" },
];

function OrderHistoryContent() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchMyOrders(page)
      .then((res) => {
        setOrders(res.data);
        setTotalPages(res.pagination?.totalPages ?? 1);
        setError("");
      })
      .catch((e: Error | undefined) => {
        if (e) setError(e.message ?? "Không tải được đơn hàng.");
      })
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = activeTab === "ALL" ? orders : orders.filter((o) => o.status === activeTab);

  return (
    <>
      <div className="wp-account-header">
        <div>
          <h2>Đơn hàng</h2>
          <p className="sub">{orders.length > 0 ? `${orders.length} đơn hàng` : "Lịch sử mua hàng"}</p>
        </div>
      </div>

      <div className="wp-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`wp-tab${activeTab === tab.key ? " active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.key !== "ALL" && (
              <span className="count-pill">
                {orders.filter((o) => o.status === tab.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <p style={{ color: "var(--bb-brand-primary)", fontSize: 13, marginBottom: 16 }}>{error}</p>
      )}

      {loading ? (
        <div style={{ display: "grid", gap: 14 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, height: 120 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--bb-text-muted)" }}>
          <p style={{ fontSize: 14 }}>Không có đơn hàng nào.</p>
        </div>
      ) : (
        <>
          {filtered.map((order) => (
            <div key={order.id} className="wp-order-card">
              <div className="wp-order-head">
                <div className="meta">
                  <div>
                    Mã đơn
                    <b>#{order.orderNumber}</b>
                  </div>
                  <div>
                    Ngày đặt
                    <b>{formatDate(order.placedAt)}</b>
                  </div>
                  <div>
                    Sản phẩm
                    <b>{order.itemCount} món</b>
                  </div>
                </div>
                <span className={`wp-order-status ${orderStatusClass(order.status)}`}>
                  {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </span>
              </div>
              <div className="wp-order-body">
                <div className="wp-order-thumbs">
                  <div className="wp-order-thumb">BB</div>
                </div>
                <div className="wp-order-summary-text">
                  <b>{order.itemCount} sản phẩm</b>
                  <span>{formatDate(order.placedAt)}</span>
                </div>
                <div className="wp-order-total">
                  <b>{formatVnd(order.totalAmount)}</b>
                  <span>{order.currency}</span>
                </div>
              </div>
              <div className="wp-order-actions">
                <Link href={toOrderDetailPath(order.id)} className="wp-btn-secondary" style={{ fontSize: 11, padding: "8px 14px", textDecoration: "none", display: "inline-block" }}>
                  Xem chi tiết
                </Link>
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 20 }}>
              <button
                type="button"
                className="wp-btn-secondary"
                style={{ fontSize: 12, padding: "9px 16px" }}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Trang trước
              </button>
              <span style={{ fontSize: 12, color: "var(--bb-text-muted)" }}>{page} / {totalPages}</span>
              <button
                type="button"
                className="wp-btn-secondary"
                style={{ fontSize: 12, padding: "9px 16px" }}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Trang sau
              </button>
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
