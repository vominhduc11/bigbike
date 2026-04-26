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
        <div className="wp-success-icon">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
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
          <div className="wp-info-card" style={{ maxWidth: 560, margin: "0 auto 22px", textAlign: "left" }}>
            <p className="wp-info-label">Sản phẩm đã đặt</p>
            {order.lineItems.map((item) => (
              <div key={item.id} className="wp-order-confirm-row">
                <span className="wp-checkout-address">
                  {safeText(item.productName, "Sản phẩm")}
                  {item.variantName ? ` · ${item.variantName}` : ""} × {item.quantity}
                </span>
                <b className="wp-order-confirm-total">{formatVnd(item.lineTotal)}</b>
              </div>
            ))}
            {order.customerNote && (
              <p className="wp-muted-text" style={{ marginTop: 10 }}>Ghi chú: {order.customerNote}</p>
            )}
          </div>
        )}

        {orderLookup.error && !order && orderNumber && (
          <p className="wp-error-text">Đơn đã được tạo, nhưng không thể tải chi tiết ngay lúc này.</p>
        )}

        <div className="cta-row">
          <Link href={toProductListPath()} className="wp-btn-secondary">Tiếp tục mua hàng</Link>
          <Link href={toOrderHistoryPath()} className="wp-btn-primary">Xem đơn hàng của tôi →</Link>
        </div>
      </div>
    </>
  );
}
