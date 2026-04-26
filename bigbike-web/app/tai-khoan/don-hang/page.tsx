"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const activeTab = searchParams.get("status") ?? "ALL";

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
            onClick={() => {
              const url = tab.key === "ALL"
                ? "/tai-khoan/don-hang"
                : `/tai-khoan/don-hang?status=${tab.key}`;
              router.replace(url, { scroll: false });
            }}
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

      {error && <p className="wp-error-text">{error}</p>}

      {loading ? (
        <div className="bb-skel-stack" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="wp-order-card">
              <div className="wp-order-head">
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
              <div className="wp-order-body">
                <div className="bb-skel-row">
                  <span className="bb-skel" style={{ width: 56, height: 56, borderRadius: 4 }} />
                  <span className="bb-skel" style={{ width: 56, height: 56, borderRadius: 4 }} />
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
      ) : filtered.length === 0 ? (
        <div className="wp-empty-state">
          <p className="wp-muted-text">Không có đơn hàng nào.</p>
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
                <Link href={toOrderDetailPath(order.id)} className="wp-btn-secondary wp-btn-sm">
                  Xem chi tiết
                </Link>
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="wp-pagination">
              <button
                type="button"
                className="wp-btn-secondary wp-btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Trang trước
              </button>
              <span className="wp-pagination-page">{page} / {totalPages}</span>
              <button
                type="button"
                className="wp-btn-secondary wp-btn-sm"
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
