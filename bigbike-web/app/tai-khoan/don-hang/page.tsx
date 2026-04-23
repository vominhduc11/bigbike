"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchMe, fetchMyOrders } from "@/lib/api/client-api";
import type { OrderListItem } from "@/lib/contracts/commerce";
import { formatDate, formatVnd } from "@/lib/utils/format";
import { toAccountPath, toLoginPath } from "@/lib/utils/routes";

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PROCESSING: "Đang xử lý",
  SHIPPED: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
  REFUNDED: "Hoàn tiền",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  FAILED: "Thất bại",
  REFUNDED: "Đã hoàn",
};

export default function OrderHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");

  const loadOrders = useCallback(
    (pg: number) => {
      setLoading(true);
      fetchMe()
        .catch(() => { router.replace(toLoginPath("/tai-khoan/don-hang")); return Promise.reject(); })
        .then(() => fetchMyOrders(pg))
        .then((res) => {
          setOrders(res.data);
          setTotalPages(res.pagination?.totalPages ?? 1);
          setLoading(false);
        })
        .catch((e: Error | undefined) => {
          if (e) setError(e.message);
          setLoading(false);
        });
    },
    [router],
  );

  useEffect(() => { loadOrders(page); }, [loadOrders, page]);

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header style={{ marginBottom: "var(--bb-space-6)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--bb-space-4)" }}>
          <div>
            <p className="bb-kicker">Tài khoản</p>
            <h1>Đơn hàng của tôi</h1>
          </div>
          <a href={toAccountPath()} className="bb-link">
            Quay lại tài khoản
          </a>
        </header>

        {error && <p className="bb-status-banner" style={{ marginBottom: "var(--bb-space-4)" }}>{error}</p>}

        {loading ? (
          <div className="bb-skeleton-grid">
            {[1, 2, 3].map((i) => <div key={i} className="bb-skeleton-item" style={{ minHeight: "80px" }} />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="bb-empty-state">
            <h3>Chưa có đơn hàng</h3>
            <p>Bạn chưa đặt đơn hàng nào.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gap: "var(--bb-space-3)" }}>
              {orders.map((order) => (
                <div key={order.id} className="bb-card" style={{ padding: "var(--bb-space-4)" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--bb-space-3)", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--bb-text-brand)", marginBottom: "var(--bb-space-1)" }}>
                        #{order.orderNumber}
                      </p>
                      <p style={{ color: "var(--bb-text-muted)", fontSize: "var(--bb-text-xs)" }}>
                        {formatDate(order.placedAt)} · {order.itemCount} sản phẩm
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontWeight: 700, marginBottom: "var(--bb-space-1)" }}>
                        {formatVnd(order.totalAmount)}
                      </p>
                      <div style={{ display: "flex", gap: "var(--bb-space-2)", justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <span className="bb-order-badge">
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </span>
                        <span className="bb-order-badge bb-order-badge-payment">
                          {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="bb-pagination" style={{ marginTop: "var(--bb-space-6)" }}>
                <button
                  type="button"
                  className="bb-button bb-button-secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Trang trước
                </button>
                <span className="bb-pagination-status">{page} / {totalPages}</span>
                <button
                  type="button"
                  className="bb-button bb-button-secondary"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Trang sau
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
