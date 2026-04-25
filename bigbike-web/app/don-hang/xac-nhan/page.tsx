import Link from "next/link";
import type { Metadata } from "next";
import { getOrderLookup } from "@/lib/api/public-api";
import { PurchaseEvent } from "@/components/analytics/PurchaseEvent";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatVnd, orderStatusLabel, safeText } from "@/lib/utils/format";
import { toOrderHistoryPath, toProductListPath } from "@/lib/utils/routes";

export const metadata: Metadata = buildPublicMetadata({
  title: "Đặt hàng thành công",
  description: "Xác nhận đơn hàng BigBike.",
  canonicalPath: "/don-hang/xac-nhan",
  noIndex: true,
});

type Props = { searchParams: Promise<{ so?: string; key?: string }> };

export default async function OrderConfirmPage({ searchParams }: Props) {
  const { so: orderNumber, key: orderKey } = await searchParams;
  const orderLookup =
    orderNumber && orderKey ? await getOrderLookup(orderNumber, orderKey) : { data: null, error: null };
  const order = orderLookup.data;

  return (
    <>
      {order && (
        <PurchaseEvent
          orderId={order.id}
          orderNumber={order.orderNumber}
          revenue={order.totalAmount}
          currency={order.currency ?? "VND"}
          items={order.lineItems.map((item) => ({
            item_id: item.productId ?? item.id,
            item_name: item.productName,
            price: item.unitPrice,
            quantity: item.quantity,
          }))}
        />
      )}

      <div className="wp-success">
        <div className="wp-success-icon">✓</div>
        <div className="kicker">Thanh toán thành công</div>
        <h1>Cảm ơn anh em đã tin BigBike!</h1>
        <p>
          Đơn hàng đã được xác nhận. Chúng tôi sẽ liên hệ xác nhận trong 1 giờ làm việc.
        </p>

        {orderNumber && (
          <div className="order-card">
            <div>
              <div className="label">Mã đơn hàng</div>
              <b className="red">#{orderNumber}</b>
            </div>
            <div>
              <div className="label">Tổng giá trị</div>
              <b>{order ? formatVnd(order.totalAmount) : "—"}</b>
            </div>
            <div>
              <div className="label">Trạng thái</div>
              <b>{order ? orderStatusLabel(order.status) : "Đã tiếp nhận"}</b>
            </div>
          </div>
        )}

        {order && (
          <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "18px 22px", marginBottom: 22, textAlign: "left", maxWidth: 560, margin: "0 auto 22px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bb-text-muted)", marginBottom: 12 }}>
              Sản phẩm đã đặt
            </p>
            {order.lineItems.map((item) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ color: "rgba(255,255,255,0.85)" }}>
                  {safeText(item.productName, "Sản phẩm")}
                  {item.variantName ? ` · ${item.variantName}` : ""} × {item.quantity}
                </span>
                <b style={{ color: "#fff", whiteSpace: "nowrap", marginLeft: 12 }}>{formatVnd(item.unitPrice * item.quantity)}</b>
              </div>
            ))}
            {order.customerNote && (
              <p style={{ fontSize: 12, color: "var(--bb-text-muted)", marginTop: 10 }}>
                Ghi chú: {order.customerNote}
              </p>
            )}
          </div>
        )}

        {orderLookup.error && !order && orderNumber && (
          <p style={{ color: "var(--bb-brand-primary)", fontSize: 13, marginBottom: 16 }}>
            Đơn đã được tạo, nhưng không thể tải chi tiết ngay lúc này.
          </p>
        )}

        <div className="cta-row">
          <Link href={toProductListPath()} className="wp-btn-secondary" style={{ padding: "14px 24px" }}>
            Tiếp tục mua hàng
          </Link>
          <Link href={toOrderHistoryPath()} className="wp-btn-primary" style={{ flex: "none", padding: "14px 28px" }}>
            Xem đơn hàng của tôi →
          </Link>
        </div>
      </div>
    </>
  );
}
