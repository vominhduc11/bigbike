import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getOrderLookup, listPublicSettings } from "@/lib/api/public-api";
import { PurchaseEvent } from "@/components/analytics/PurchaseEvent";
import type { OrderAddress, OrderDetail } from "@/lib/contracts/commerce";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { WpCheckoutPageHeading } from "@/components/wp/WpCheckoutPageHeading";
import { Tr } from "@/components/i18n/Tr";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { sectionHeading } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { formatAddress, formatVnd } from "@/lib/utils/format";
import { resolveBankTransfer } from "@/lib/utils/orders";
import { LocalDate } from "@/components/i18n/LocalDate";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OrderConfirm");
  return buildPublicMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    canonicalPath: "/don-hang/xac-nhan/",
    noIndex: true,
  });
}

type Props = { searchParams: Promise<{ so?: string; key?: string }> };

export default async function OrderConfirmPage({ searchParams }: Props) {
  const { so: orderNumber, key: orderKey } = await searchParams;
  const locale = await getLocale();
  const [orderLookup, settingsResult, t] = await Promise.all([
    orderNumber && orderKey ? getOrderLookup(orderNumber, orderKey) : Promise.resolve({ data: null, error: null }),
    listPublicSettings(locale),
    getTranslations("OrderConfirm"),
  ]);
  const order = orderLookup.data;
  const settings = new Map((settingsResult.data ?? []).map((s) => [s.settingKey, s.settingValue]));

  if (!orderNumber || !orderKey) {
    return (
      <OrderShell>
        <ThankYouHero message={t("receivedNotice")} />
      </OrderShell>
    );
  }

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

      <OrderShell>
        {order ? (
          <>
            <SuccessBanner orderNumber={order.orderNumber} />
            <NextSteps phone={findAddress(order.addresses, "BILLING")?.phone ?? "—"} />
            <BankTransferInfo order={order} settings={settings} t={t} />
            <OrderDetails order={order} t={t} />
            <CustomerDetails order={order} t={t} />
            
            {/* Hotline Bar */}
            <div className="bb-oc-hotline-bar">
              <span>Cần gấp? Gọi ngay:</span>
              <span><strong>0906902404</strong></span>
              <span>hoặc</span>
              <span><strong>Zalo 0764640679</strong> (Mrs. Thư)</span>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-3">
              <a
                href="https://zalo.me/0764640679"
                target="_blank"
                rel="noopener noreferrer"
                className="bb-oc-btn-zalo"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22" className="mr-2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Nhắn Zalo nếu cần hỗ trợ gấp
              </a>
              <Link href="/" className="bb-oc-btn-continue">
                ← Tiếp tục mua sắm
              </Link>
            </div>

            {/* Footer note */}
            <p className="text-[13px] text-muted-foreground text-center mt-6 leading-relaxed">
              BigBike.vn · 79/30/52 Âu Cơ, Phường Hòa Bình, TP. Hồ Chí Minh<br />
              Thứ 2–7: 9:00–21:00 · Chủ nhật: 9:00–18:00
            </p>
          </>
        ) : (
          <>
            <ThankYouHero message={t("receivedNotice")} />
            <OrderLoadFallback orderNumber={orderNumber} t={t} />
          </>
        )}
      </OrderShell>
    </>
  );
}

type OrderConfirmTranslations = Awaited<ReturnType<typeof getTranslations<"OrderConfirm">>>;

// WP-parity: order-received là endpoint của trang checkout trong WooCommerce.
// Rút gọn khung trang tối đa (max-width 680px) để tập trung hiển thị hóa đơn.
async function OrderShell({ children }: { children: React.ReactNode }) {
  const title = "Thanh toán";
  return (
    <WpStaticShell
      title={title}
      breadcrumb={[{ label: "Bigbike.vn", href: "/" }, { label: title }]}
      showHero={false}
      mainClassName=""
      cssHref="/wp-content/themes/bigbike/css/wp-theme-checkout.css?v=2"
    >
      <div className="bb-oc-wrap">
        {children}
      </div>
    </WpStaticShell>
  );
}

// Banner thông báo đặt hàng thành công màu đen theo Mockup 2
function SuccessBanner({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="bb-oc-success-banner">
      <div className="bb-oc-success-icon">
        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
      </div>
      <h1 className="bb-oc-success-title">Đặt hàng thành công!</h1>
      <p className="bb-oc-order-code">Mã đơn hàng: <strong>#{orderNumber}</strong></p>
    </div>
  );
}

// Khung hiển thị 3 bước tiếp theo của quy trình giao nhận
function NextSteps({ phone }: { phone: string }) {
  return (
    <div className="bb-oc-next-step text-left">
      <p className="bb-oc-next-step-title">Bước tiếp theo</p>
      <div className="bb-oc-step-row">
        <div className="bb-oc-step-num">1</div>
        <div className="bb-oc-step-content">
          <strong>Shop BigBike sẽ gọi xác nhận</strong>
          Chúng tôi sẽ gọi số <strong>{phone}</strong> trong <strong>1–2 giờ làm việc</strong> để xác nhận size, màu sắc và sắp xếp giao hàng.
        </div>
      </div>
      <div className="bb-oc-step-row">
        <div className="bb-oc-step-num">2</div>
        <div className="bb-oc-step-content">
          <strong>Xác nhận và sắp xếp giao hàng</strong>
          Sau khi xác nhận qua điện thoại, đơn hàng sẽ được đóng gói và giao trong 0–4 ngày tùy khu vực.
        </div>
      </div>
      <div className="bb-oc-step-row">
        <div className="bb-oc-step-num">3</div>
        <div className="bb-oc-step-content">
          <strong>Nhận hàng và thanh toán COD</strong>
          Kiểm tra hàng trước khi thanh toán. Đồng kiểm với shipper — nếu sai sót shop chịu toàn bộ chi phí.
        </div>
      </div>
    </div>
  );
}

// WP-parity: a centered "thank you" hero (success check + message) above the
// order details, echoing WP's .payment-success block (centered, ~370-480px).
function ThankYouHero({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-[480px] py-2 text-center">
      <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bb-brand-primary-soft)] text-brand">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <p className="woocommerce-notice woocommerce-notice--success woocommerce-thankyou-order-received m-0 font-heading text-ui-24 max-md:text-ui-22 font-semibold uppercase text-foreground">
        {message}
      </p>
    </div>
  );
}

// Đơn đã đặt thành công (URL có mã + key) nhưng tra cứu chi tiết thất bại tạm thời
// (mạng/độ trễ). Thay vì để khách thấy mỗi lời cảm ơn trống, hiện rõ mã đơn để khách
// ghi lại + lối thoát (tiếp tục mua / xem đơn của tôi) thay vì ngõ cụt.
function OrderLoadFallback({
  orderNumber,
  t,
}: {
  orderNumber: string;
  t: OrderConfirmTranslations;
}) {
  return (
    <div className="mx-auto max-w-[480px] text-center">
      <p className="m-0 text-ui-14 max-md:text-ui-12 uppercase leading-6 text-muted-foreground">
        {t("orderCode")}{" "}
        <strong className="block normal-case text-foreground">{orderNumber}</strong>
      </p>
      <p className="mx-auto mt-3 max-w-[420px] text-ui-18 max-md:text-ui-16 leading-6 text-muted-foreground">
        {t("loadFailed")}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link className="button" href="/">
          {t("continueShopping")}
        </Link>
        <Link className="button wc-backward" href="/tai-khoan/don-hang">
          {t("viewMyOrders")}
        </Link>
      </div>
    </div>
  );
}

// Card chi tiết đơn hàng gồm danh sách sản phẩm và tổng giá
function OrderDetails({
  order,
  t,
}: {
  order: OrderDetail;
  t: OrderConfirmTranslations;
}) {
  const paymentMethod = order.payments[0]?.paymentMethod ?? "";
  
  return (
    <div className="bb-co-card">
      <p className="bb-co-card-title">{t("orderDetailsTitle")}</p>

      <div className="space-y-4">
        {order.lineItems.map((item) => (
          <div key={item.id} className="summary-item text-left">
            <div className="item-img">
              {item.productThumbnailUrl ? (
                <span
                  role="img"
                  aria-label={item.productName}
                  className="block h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url("${item.productThumbnailUrl}")` }}
                />
              ) : (
                <svg viewBox="0 0 24 24" className="w-[36px] h-[36px] fill-gray-300">
                  <path d="M21 6.5C21 4.01 18.99 2 16.5 2h-9C5.01 2 3 4.01 3 6.5v11C3 19.99 5.01 22 7.5 22h9c2.49 0 4.5-2.01 4.5-4.5v-11z" />
                </svg>
              )}
            </div>
            <div className="item-info">
              <p className="item-name">{item.productName}</p>
              <p className="item-meta">
                {item.variantName ? `${item.variantName} · ` : ""}SL: {item.quantity}
              </p>
              <p className="item-price">{formatVnd(item.lineTotal)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-left">
        <div className="price-row">
          <span>Tạm tính</span>
          <span>{formatVnd(order.subtotalAmount)}</span>
        </div>

        {order.discountAmount > 0 && (
          <div className="price-row">
            <span>Khuyến mãi</span>
            <span className="text-brand font-semibold">-{formatVnd(order.discountAmount)}</span>
          </div>
        )}

        <div className="price-row">
          <span>Phí vận chuyển</span>
          <span className="text-emerald-700 font-bold uppercase">{t("shippingFree")}</span>
        </div>

        {paymentMethod && (
          <div className="price-row">
            <span>Phương thức TT</span>
            <span>{legacyPaymentMethodLabel(paymentMethod)}</span>
          </div>
        )}

        <div className="price-row total">
          <span>Tổng cộng</span>
          <span className="val">{formatVnd(order.totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}

// Bác sĩ chuyển khoản cho đơn BACS. BigBike đối soát thủ công — số tài khoản do admin
// tự nhập ở Cài đặt → Thanh toán (group "payment", public). Chưa cấu hình thì hiện fallback
// hotline thay vì box trống.
function BankTransferInfo({
  order,
  settings,
  t,
}: {
  order: OrderDetail;
  settings: Map<string, string>;
  t: OrderConfirmTranslations;
}) {
  const bank = resolveBankTransfer(order.payments[0]?.paymentMethod, settings);
  if (!bank) return null; // không phải đơn chuyển khoản → không hiển thị

  const { configured, holder, number, bankName, branch } = bank;
  const hotline = settings.get("hotline")?.trim() ?? "";
  const transferNote = `BIGBIKE ${order.orderNumber}`;

  return (
    <section className="woocommerce-bank-details">
      <h2 className={cn(sectionHeading, "m-0 mb-4")}>{t("bankTitle")}</h2>
      <div className="border border-border p-4 text-ui-18 max-md:text-ui-16 leading-7 text-foreground">
        {configured ? (
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-muted-foreground">{t("bankHolder")}</dt>
            <dd className="m-0 font-semibold">{holder}</dd>
            <dt className="text-muted-foreground">{t("bankNumber")}</dt>
            <dd className="m-0 font-semibold">{number}</dd>
            {bankName && (
              <>
                <dt className="text-muted-foreground">{t("bankName")}</dt>
                <dd className="m-0">{bankName}</dd>
              </>
            )}
            {branch && (
              <>
                <dt className="text-muted-foreground">{t("bankBranch")}</dt>
                <dd className="m-0">{branch}</dd>
              </>
            )}
            <dt className="text-muted-foreground">{t("bankAmount")}</dt>
            <dd className="m-0 font-semibold text-brand">{formatVnd(order.totalAmount)}</dd>
            <dt className="text-muted-foreground">{t("bankTransferNote")}</dt>
            <dd className="m-0 font-semibold">{transferNote}</dd>
          </dl>
        ) : (
          <p className="m-0 text-muted-foreground text-left">
            {t.rich("bankHotlineFallback", {
              hotline,
              orderNumber: order.orderNumber,
              b: (chunks) => <strong className="text-foreground">{chunks}</strong>,
              code: (chunks) => <code className="rounded bg-muted px-1">{chunks}</code>,
            })}
          </p>
        )}
      </div>
    </section>
  );
}

// Bảng thông tin nhận hàng của khách
function CustomerDetails({
  order,
  t,
}: {
  order: OrderDetail;
  t: OrderConfirmTranslations;
}) {
  const billingAddress = findAddress(order.addresses, "BILLING");
  if (!billingAddress) return null;

  const addressText = formatAddress([
    billingAddress.addressLine1,
    billingAddress.ward,
    billingAddress.district,
    billingAddress.province,
  ]);

  return (
    <div className="bb-co-card">
      <p className="bb-co-card-title">Thông tin nhận hàng</p>
      <table className="bb-oc-info-table text-left">
        <tbody>
          <tr>
            <td>Người nhận</td>
            <td>{billingAddress.fullName}</td>
          </tr>
          <tr>
            <td>Số điện thoại</td>
            <td>{billingAddress.phone}</td>
          </tr>
          <tr>
            <td>Địa chỉ</td>
            <td>{addressText}</td>
          </tr>
          {order.customerNote && (
            <tr>
              <td>Ghi chú</td>
              <td className="font-normal text-muted-foreground italic">{order.customerNote}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function findAddress(addresses: OrderAddress[], type: string): OrderAddress | null {
  return addresses.find((address) => address.type?.toUpperCase() === type) ?? null;
}

function legacyPaymentMethodLabel(method: string): string {
  switch (method.trim().toUpperCase()) {
    case "COD":
      return "Trả tiền mặt khi nhận hàng (COD)";
    case "BACS":
      return "Chuyển khoản ngân hàng";
    default:
      return method;
  }
}
