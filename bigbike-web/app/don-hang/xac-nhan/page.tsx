import Link from "next/link";
import type { Metadata } from "next";
import { getOrderLookup, listPublicSettings } from "@/lib/api/public-api";
import { PurchaseEvent } from "@/components/analytics/PurchaseEvent";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatDate, formatVnd, orderStatusLabel, paymentMethodLabel, safeText } from "@/lib/utils/format";
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

  const rawPaymentMethod = order?.payments?.[0]?.paymentMethod ?? "";
  const paymentMethodCode = rawPaymentMethod.trim().toUpperCase();
  const isBacs = paymentMethodCode === "BACS";
  const isCod = paymentMethodCode === "COD";
  const paymentStatus = (order?.paymentStatus ?? "").trim().toUpperCase();
  const isAlreadyPaid = paymentStatus === "PAID" || paymentStatus === "PARTIALLY_PAID";
  const eyebrow = isAlreadyPaid
    ? "Thanh toán thành công"
    : isBacs
      ? "Chờ chuyển khoản"
      : "Đặt hàng thành công";
  const subline = isAlreadyPaid
    ? "Đơn hàng đã được xác nhận. Chúng tôi sẽ liên hệ trong 1 giờ làm việc."
    : isBacs
      ? "Đơn hàng đã được ghi nhận. Vui lòng chuyển khoản theo thông tin bên dưới — chúng tôi sẽ xác nhận trong 1 giờ làm việc."
      : isCod
        ? "Đơn hàng đã được ghi nhận. Chúng tôi sẽ liên hệ xác nhận trong 1 giờ làm việc."
        : "Đơn hàng đã được ghi nhận. Chúng tôi sẽ liên hệ xác nhận trong 1 giờ làm việc.";

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

      <div className="max-w-[720px] mx-auto my-[60px] px-6 text-center max-sm:px-4 max-sm:my-8">
        <div className="bb-round w-[88px] h-[88px] rounded-full bg-[rgba(255,12,9,0.08)] text-brand flex items-center justify-center mx-auto mb-[22px] border-2 border-[var(--bb-brand-primary-border)]">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div className="text-[11px] tracking-[0.2em] uppercase text-brand font-bold mb-[10px]">{eyebrow}</div>
        <h1 className="font-display text-[40px] tracking-[0.01em] uppercase m-0 mb-[10px]">Cảm ơn anh em đã tin BigBike!</h1>
        <p className="text-muted-foreground m-0 mb-7">{subline}</p>

        {orderNumber && (
          <ul className="list-none mx-auto mb-7 p-0 max-w-[760px] bg-card border border-border flex flex-wrap gap-0">
            <li className="flex-[1_1_calc(50%-1px)] py-2 px-[18px] text-left flex flex-col gap-1 border-r border-border border-b border-border [&:nth-child(2n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0 max-sm:flex-[1_1_100%] max-sm:[&:nth-child(2n)]:border-r-0 max-sm:last:border-b-0">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Mã đơn hàng:</span>
              <strong className="font-display text-[15px] text-brand font-semibold tracking-[0.01em]">#{orderNumber}</strong>
            </li>
            {order && (
              <li className="flex-[1_1_calc(50%-1px)] py-2 px-[18px] text-left flex flex-col gap-1 border-r border-border border-b border-border [&:nth-child(2n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0 max-sm:flex-[1_1_100%] max-sm:border-r-0 max-sm:last:border-b-0">
                <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Ngày đặt:</span>
                <strong className="font-display text-[15px] text-foreground font-semibold tracking-[0.01em]">{formatDate(order.placedAt)}</strong>
              </li>
            )}
            {order?.customerEmail && (
              <li className="flex-[1_1_calc(50%-1px)] py-2 px-[18px] text-left flex flex-col gap-1 border-r border-border border-b border-border [&:nth-child(2n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0 max-sm:flex-[1_1_100%] max-sm:border-r-0 max-sm:last:border-b-0">
                <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Email:</span>
                <strong className="font-display text-[15px] text-foreground font-semibold tracking-[0.01em]">{order.customerEmail}</strong>
              </li>
            )}
            <li className="flex-[1_1_calc(50%-1px)] py-2 px-[18px] text-left flex flex-col gap-1 border-r border-border border-b border-border [&:nth-child(2n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0 max-sm:flex-[1_1_100%] max-sm:border-r-0 max-sm:last:border-b-0">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Tổng giá trị:</span>
              <strong className="font-display text-[15px] text-foreground font-semibold tracking-[0.01em]">{order ? formatVnd(order.totalAmount) : "—"}</strong>
            </li>
            {rawPaymentMethod && (
              <li className="flex-[1_1_calc(50%-1px)] py-2 px-[18px] text-left flex flex-col gap-1 border-r border-border border-b border-border [&:nth-child(2n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0 max-sm:flex-[1_1_100%] max-sm:border-r-0 max-sm:last:border-b-0">
                <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Phương thức thanh toán:</span>
                <strong className="font-display text-[15px] text-foreground font-semibold tracking-[0.01em]">
                  {paymentMethodLabel(rawPaymentMethod)}
                </strong>
              </li>
            )}
            <li className="flex-[1_1_calc(50%-1px)] py-2 px-[18px] text-left flex flex-col gap-1 border-r border-border border-b border-border [&:nth-child(2n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0 max-sm:flex-[1_1_100%] max-sm:border-r-0 max-sm:last:border-b-0">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">Trạng thái:</span>
              <strong className="font-display text-[15px] text-foreground font-semibold tracking-[0.01em]">{order ? orderStatusLabel(order.status) : "Đã tiếp nhận"}</strong>
            </li>
          </ul>
        )}

        {order && (
          <div className="bg-card border border-border p-[20px_22px] max-w-[560px] mx-auto mb-[22px] text-left">
            <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[10px] m-0">Sản phẩm đã đặt</p>
            {order.lineItems.map((item) => (
              <div key={item.id} className="flex justify-between items-baseline text-sm py-1.5 border-b border-border/5 gap-3">
                <span className="text-sm leading-[1.7] text-muted-foreground">
                  {safeText(item.productName, "Sản phẩm")}
                  {item.variantName ? ` · ${item.variantName}` : ""} × {item.quantity}
                </span>
                <b className="text-foreground whitespace-nowrap font-bold">{formatVnd(item.lineTotal)}</b>
              </div>
            ))}
            {order.customerNote && (
              <p className="text-muted-foreground text-sm m-0 mt-[10px]">Ghi chú: {order.customerNote}</p>
            )}
          </div>
        )}

        {isBacs && order && (bankNumber || bankName) && (
          <div className="bg-card border border-border p-[20px_22px] max-w-[560px] mx-auto mb-[22px] text-left">
            <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[10px] m-0">Thông tin chuyển khoản</p>
            {bankName && (
              <div className="flex justify-between items-baseline text-sm py-1.5 border-b border-border/5 gap-3">
                <span className="text-sm leading-[1.7] text-muted-foreground">Ngân hàng</span>
                <b className="text-foreground whitespace-nowrap font-bold">{bankName}</b>
              </div>
            )}
            {bankNumber && (
              <div className="flex justify-between items-baseline text-sm py-1.5 border-b border-border/5 gap-3">
                <span className="text-sm leading-[1.7] text-muted-foreground">Số tài khoản</span>
                <b className="text-foreground whitespace-nowrap font-bold">{bankNumber}</b>
              </div>
            )}
            {bankHolder && (
              <div className="flex justify-between items-baseline text-sm py-1.5 border-b border-border/5 gap-3">
                <span className="text-sm leading-[1.7] text-muted-foreground">Chủ tài khoản</span>
                <b className="text-foreground whitespace-nowrap font-bold">{bankHolder}</b>
              </div>
            )}
            {bankBranch && (
              <div className="flex justify-between items-baseline text-sm py-1.5 border-b border-border/5 gap-3">
                <span className="text-sm leading-[1.7] text-muted-foreground">Chi nhánh</span>
                <b className="text-foreground whitespace-nowrap font-bold">{bankBranch}</b>
              </div>
            )}
            {order.orderNumber && (
              <div className="flex justify-between items-baseline text-sm py-1.5 border-b border-border/5 gap-3">
                <span className="text-sm leading-[1.7] text-muted-foreground">Nội dung chuyển khoản</span>
                <b className="text-foreground whitespace-nowrap font-bold">BIGBIKE {order.orderNumber}</b>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-[10px] m-0 leading-[1.5]">
              Sau khi chuyển khoản, đơn sẽ được xác nhận trong 1 giờ làm việc. Nếu cần hỗ trợ, vui lòng liên hệ hotline 0906.902.404.
            </p>
          </div>
        )}

        {isBacs && order && !bankNumber && !bankName && (
          <div className="bg-card border border-border p-[20px_22px] max-w-[560px] mx-auto mb-[22px] text-left">
            <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[10px] m-0">Thông tin chuyển khoản</p>
            <p className="text-sm text-foreground m-0 leading-[1.6]">
              Vui lòng liên hệ hotline <b className="text-brand">0906.902.404</b> hoặc chờ email xác nhận để nhận thông tin tài khoản chuyển khoản. Nội dung chuyển khoản: <b>BIGBIKE {order.orderNumber}</b>.
            </p>
          </div>
        )}

        {orderLookup.error && !order && orderNumber && (
          <p className="text-brand text-sm mb-4 m-0">Đơn đã được tạo, nhưng không thể tải chi tiết ngay lúc này.</p>
        )}

        <div className="flex gap-[10px] justify-center max-sm:flex-col">
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

