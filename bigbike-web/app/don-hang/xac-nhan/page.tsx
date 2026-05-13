import Link from "next/link";
import type { Metadata } from "next";
import { getOrderLookup, listPublicSettings } from "@/lib/api/public-api";
import { PurchaseEvent } from "@/components/analytics/PurchaseEvent";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, formatVnd, orderStatusLabel, safeText } from "@/lib/utils/format";
import { toOrderHistoryPath, toProductListPath } from "@/lib/utils/routes";
import { Button } from "@/components/ui/button";

function pickSetting(
  settings: { settingKey: string; settingValue: string }[],
  keys: string[],
): string {
  for (const key of keys) {
    const v = settings.find((s) => s.settingKey === key)?.settingValue?.trim();
    if (v) return v;
  }
  return "";
}

export const metadata: Metadata = buildPublicMetadata({
  title: "Đặt hàng thành công",
  description: "Xác nhận đơn hàng BigBike.",
  canonicalPath: "/don-hang/xac-nhan/",
  noIndex: true,
});

type Props = { searchParams: Promise<{ so?: string; key?: string }> };

export default async function OrderConfirmPage({ searchParams }: Props) {
  const { so: orderNumber, key: orderKey } = await searchParams;
  const [orderLookup, settingsResult] = await Promise.all([
    orderNumber && orderKey ? getOrderLookup(orderNumber, orderKey) : Promise.resolve({ data: null, error: null }),
    listPublicSettings(),
  ]);
  const order = orderLookup.data;
  const settings = settingsResult.data ?? [];
  const bankName = pickSetting(settings, ["bank_name"]);
  const bankNumber = pickSetting(settings, ["bank_account_number", "bank_number"]);
  const bankHolder = pickSetting(settings, ["bank_account_holder", "bank_holder"]);
  const bankBranch = pickSetting(settings, ["bank_branch"]);

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
          <ul className="wp-order-overview">
            <li>
              <span className="label">Mã đơn hàng:</span>
              <strong className="red">#{orderNumber}</strong>
            </li>
            {order && (
              <li>
                <span className="label">Ngày đặt:</span>
                <strong>{formatDate(order.placedAt)}</strong>
              </li>
            )}
            {order?.customerEmail && (
              <li>
                <span className="label">Email:</span>
                <strong>{order.customerEmail}</strong>
              </li>
            )}
            <li>
              <span className="label">Tổng giá trị:</span>
              <strong>{order ? formatVnd(order.totalAmount) : "—"}</strong>
            </li>
            {order?.payments?.[0]?.paymentMethod && (
              <li>
                <span className="label">Phương thức thanh toán:</span>
                <strong>
                  {order.payments[0].paymentMethod === "cod"
                    ? "Thanh toán khi nhận hàng (COD)"
                    : order.payments[0].paymentMethod === "bacs"
                      ? "Chuyển khoản ngân hàng"
                      : order.payments[0].paymentMethod.toUpperCase()}
                </strong>
              </li>
            )}
            <li>
              <span className="label">Trạng thái:</span>
              <strong>{order ? orderStatusLabel(order.status) : "Đã tiếp nhận"}</strong>
            </li>
          </ul>
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

        {order?.payments?.[0]?.paymentMethod === "bacs" && (bankNumber || bankName) && (
          <div className="wp-info-card" style={{ maxWidth: 560, margin: "0 auto 22px", textAlign: "left" }}>
            <p className="wp-info-label">Thông tin chuyển khoản</p>
            {bankName && (
              <div className="wp-order-confirm-row">
                <span className="wp-checkout-address">Ngân hàng</span>
                <b className="wp-order-confirm-total">{bankName}</b>
              </div>
            )}
            {bankNumber && (
              <div className="wp-order-confirm-row">
                <span className="wp-checkout-address">Số tài khoản</span>
                <b className="wp-order-confirm-total">{bankNumber}</b>
              </div>
            )}
            {bankHolder && (
              <div className="wp-order-confirm-row">
                <span className="wp-checkout-address">Chủ tài khoản</span>
                <b className="wp-order-confirm-total">{bankHolder}</b>
              </div>
            )}
            {bankBranch && (
              <div className="wp-order-confirm-row">
                <span className="wp-checkout-address">Chi nhánh</span>
                <b className="wp-order-confirm-total">{bankBranch}</b>
              </div>
            )}
            {order.orderNumber && (
              <div className="wp-order-confirm-row">
                <span className="wp-checkout-address">Nội dung chuyển khoản</span>
                <b className="wp-order-confirm-total">BIGBIKE {order.orderNumber}</b>
              </div>
            )}
          </div>
        )}

        {orderLookup.error && !order && orderNumber && (
          <p className="wp-error-text">Đơn đã được tạo, nhưng không thể tải chi tiết ngay lúc này.</p>
        )}

        <div className="cta-row">
          <Button asChild variant="secondary">
            <Link href={toProductListPath()}>Tiếp tục mua hàng</Link>
          </Button>
          <Button asChild variant="primary">
            <Link href={toOrderHistoryPath()}>Xem đơn hàng của tôi →</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
