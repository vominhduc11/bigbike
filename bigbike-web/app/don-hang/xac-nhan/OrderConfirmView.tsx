"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { OrderAddress, OrderDetail } from "@/lib/contracts/commerce";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { sectionHeading } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { formatAddress, formatVnd, telHref, zaloHref } from "@/lib/utils/format";
import { resolveBankTransfer } from "@/lib/utils/orders";

type Props = {
  orderNumber?: string;
  orderKey?: string;
  order: OrderDetail | null;
  settingsRecord: Record<string, string>;
  isLoading?: boolean;
};

/**
 * Toàn bộ nội dung trang xác nhận đơn hàng dựng ở CLIENT (component "use client") — khác PDP/catalog
 * (server render `vi`, client chỉ đổi phần DỮ LIỆU qua LocalizedContentProvider), trang này KHÔNG có
 * lý do giữ ISR/SSG (searchParams-dependent, tra cứu đơn theo mã+key mỗi lần, `noIndex: true`), nên
 * dựng hẳn ở client để `useTranslations` đổi đúng theo `NEXT_LOCALE` — mirror pattern
 * `OrderDetailContent`/`WpCheckoutClient` (xem AGENTS.md §6 — client component + next-intl).
 */
export function OrderConfirmView({ orderNumber, orderKey, order, settingsRecord, isLoading = false }: Props) {
  const t = useTranslations("OrderConfirm");
  const tCommon = useTranslations("Common");

  if (!orderNumber || !orderKey) {
    return (
      <OrderShell>
        <ThankYouHero message={t("receivedNotice")} />
      </OrderShell>
    );
  }

  const settings = new Map(Object.entries(settingsRecord));
  const hotline = pickOrderConfirmSetting(settings, ["hotline"]);
  const zalo = resolveZaloContact(settings);
  const storeAddress = pickOrderConfirmSetting(settings, ["contact_address"]);

  return (
    <OrderShell>
      {order ? (
        <>
          <SuccessBanner orderNumber={order.orderNumber} />
          <NextSteps phone={findAddress(order.addresses, "BILLING")?.phone ?? "—"} />
          <BankTransferInfo order={order} settings={settings} />
          <OrderDetails order={order} />
          <CustomerDetails order={order} />

          <HotlineBar hotline={hotline} zalo={zalo} />

          {/* CTA Buttons */}
          <div className="space-y-3">
            <ZaloSupportButton zalo={zalo} />
            <Link href="/" className="bb-oc-btn-continue">
              ← {t("continueShopping")}
            </Link>
          </div>

          <StoreFooterNote address={storeAddress} />
        </>
      ) : (
        <>
          <ThankYouHero message={t("receivedNotice")} />
          {isLoading ? (
            <p className="mx-auto mt-3 max-w-[420px] text-center text-ui-18 max-md:text-ui-16 leading-6 text-muted-foreground">
              {tCommon("loading")}
            </p>
          ) : (
            <OrderLoadFallback orderNumber={orderNumber} />
          )}
        </>
      )}
    </OrderShell>
  );
}

type ZaloContact = {
  hrefValue: string;
  label: string;
};

function HotlineBar({ hotline, zalo }: { hotline: string; zalo: ZaloContact | null }) {
  const t = useTranslations("OrderConfirm");
  if (!hotline && !zalo) return null;

  return (
    <div className="bb-oc-hotline-bar">
      {hotline && (
        <>
          <span>{t("hotlineUrgentPrompt")}</span>
          <span>
            <a href={telHref(hotline)}>
              <strong>{hotline}</strong>
            </a>
          </span>
        </>
      )}
      {hotline && zalo && <span>{t("hotlineOr")}</span>}
      {zalo && (
        <span>
          <a href={zaloHref(zalo.hrefValue)} target="_blank" rel="noopener noreferrer">
            <strong>{formatZaloDisplay(zalo.label)}</strong>
          </a>
        </span>
      )}
    </div>
  );
}

function ZaloSupportButton({ zalo }: { zalo: ZaloContact | null }) {
  const t = useTranslations("OrderConfirm");
  if (!zalo) return null;

  return (
    <a
      href={zaloHref(zalo.hrefValue)}
      target="_blank"
      rel="noopener noreferrer"
      className="bb-oc-btn-zalo"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22" className="mr-2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      {t("zaloCtaUrgent")}
    </a>
  );
}

function StoreFooterNote({ address }: { address: string }) {
  const t = useTranslations("OrderConfirm");

  return (
    <p className="text-ui-13 text-muted-foreground text-center mt-6 leading-relaxed">
      {address ? (
        <>
          BigBike.vn · {address}
          <br />
        </>
      ) : null}
      {t("footerHours")}
    </p>
  );
}

function pickOrderConfirmSetting(settings: Map<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = settings.get(key)?.trim();
    if (value) return value;
  }
  return "";
}

function resolveZaloContact(settings: Map<string, string>): ZaloContact | null {
  const hrefValue = pickOrderConfirmSetting(settings, ["zalo_url", "hotline_2", "hotline"]);
  const rawLabel = pickOrderConfirmSetting(settings, ["zalo_display", "hotline_2", "hotline", "zalo_url"]);
  const label = rawLabel ? stripZaloUrl(rawLabel) : stripZaloUrl(hrefValue);
  if (!hrefValue && !label) return null;
  return { hrefValue: hrefValue || label, label: label || hrefValue };
}

function stripZaloUrl(value: string): string {
  if (!/^https?:\/\//i.test(value)) return value;
  return value.replace(/[^\d]/g, "") || value;
}

function formatZaloDisplay(label: string): string {
  return /\bzalo\b/i.test(label) ? label : `Zalo ${label}`;
}

// WP-parity: order-received là endpoint của trang checkout trong WooCommerce.
// Rút gọn khung trang tối đa (max-width 680px) để tập trung hiển thị hóa đơn.
function OrderShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("OrderConfirm");
  const title = t("pageTitle");
  return (
    <WpStaticShell
      title={title}
      breadcrumb={[{ label: "Bigbike.vn", href: "/" }, { label: title }]}
      showHero={false}
      mainClassName="bb-checkout-page"
      cssHref="/wp-content/themes/bigbike/css/wp-theme-checkout.css?v=4"
    >
      <div className="bb-oc-wrap">
        {children}
      </div>
    </WpStaticShell>
  );
}

// Banner thông báo đặt hàng thành công màu đen theo Mockup 2
function SuccessBanner({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations("OrderConfirm");
  return (
    <div className="bb-oc-success-banner">
      <div className="bb-oc-success-icon">
        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
      </div>
      <h1 className="bb-oc-success-title">{t("successTitle")}</h1>
      <p className="bb-oc-order-code">{t("orderCode")} <strong>#{orderNumber}</strong></p>
    </div>
  );
}

// Khung hiển thị 3 bước tiếp theo của quy trình giao nhận
function NextSteps({ phone }: { phone: string }) {
  const t = useTranslations("OrderConfirm");
  const richBold = { b: (chunks: React.ReactNode) => <strong>{chunks}</strong> };
  return (
    <div className="bb-oc-next-step text-left">
      <p className="bb-oc-next-step-title">{t("nextStepsTitle")}</p>
      <div className="bb-oc-step-row">
        <div className="bb-oc-step-num">1</div>
        <div className="bb-oc-step-content">
          <strong>{t("step1Title")}</strong>
          {t.rich("step1Body", { ...richBold, phone })}
        </div>
      </div>
      <div className="bb-oc-step-row">
        <div className="bb-oc-step-num">2</div>
        <div className="bb-oc-step-content">
          <strong>{t("step2Title")}</strong>
          {t("step2Body")}
        </div>
      </div>
      <div className="bb-oc-step-row">
        <div className="bb-oc-step-num">3</div>
        <div className="bb-oc-step-content">
          <strong>{t("step3Title")}</strong>
          {t("step3Body")}
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
function OrderLoadFallback({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations("OrderConfirm");
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
function OrderDetails({ order }: { order: OrderDetail }) {
  const t = useTranslations("OrderConfirm");
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
                <svg viewBox="0 0 24 24" className="w-[36px] h-[36px] fill-border">
                  <path d="M21 6.5C21 4.01 18.99 2 16.5 2h-9C5.01 2 3 4.01 3 6.5v11C3 19.99 5.01 22 7.5 22h9c2.49 0 4.5-2.01 4.5-4.5v-11z" />
                </svg>
              )}
            </div>
            <div className="item-info">
              <p className="item-name">{item.productName}</p>
              <p className="item-meta">
                {item.variantName ? `${item.variantName} · ` : ""}{t("qtyAbbrev")}: {item.quantity}
              </p>
              <p className="item-price">{formatVnd(item.lineTotal)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-left">
        <div className="price-row">
          <span>{t("subtotalLabel")}</span>
          <span>{formatVnd(order.subtotalAmount)}</span>
        </div>

        {order.discountAmount > 0 && (
          <div className="price-row">
            <span>{t("discountLabel")}</span>
            <span className="text-brand font-semibold">-{formatVnd(order.discountAmount)}</span>
          </div>
        )}

        <div className="price-row">
          <span>{t("shippingLabel")}</span>
          <span className="text-state-success-text font-bold uppercase">{t("shippingFree")}</span>
        </div>

        {paymentMethod && (
          <div className="price-row">
            <span>{t("paymentMethodLabel")}</span>
            <span>{legacyPaymentMethodLabel(paymentMethod, t)}</span>
          </div>
        )}

        <div className="price-row total">
          <span>{t("totalLabel")}</span>
          <span className="val">{formatVnd(order.totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}

// Bảng thông tin chuyển khoản cho đơn BACS. BigBike đối soát thủ công — số tài khoản do admin
// tự nhập ở Cài đặt → Thanh toán (group "payment", public). Chưa cấu hình thì hiện fallback
// hotline thay vì box trống.
function BankTransferInfo({ order, settings }: { order: OrderDetail; settings: Map<string, string> }) {
  const t = useTranslations("OrderConfirm");
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
function CustomerDetails({ order }: { order: OrderDetail }) {
  const t = useTranslations("OrderConfirm");
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
      <p className="bb-co-card-title">{t("customerDetailsTitle")}</p>
      <table className="bb-oc-info-table text-left">
        <tbody>
          <tr>
            <td>{t("recipientLabel")}</td>
            <td>{billingAddress.fullName}</td>
          </tr>
          <tr>
            <td>{t("phoneFieldLabel")}</td>
            <td>{billingAddress.phone}</td>
          </tr>
          <tr>
            <td>{t("addressFieldLabel")}</td>
            <td>{addressText}</td>
          </tr>
          {order.customerNote && (
            <tr>
              <td>{t("noteFieldLabel")}</td>
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

function legacyPaymentMethodLabel(method: string, t: ReturnType<typeof useTranslations<"OrderConfirm">>): string {
  switch (method.trim().toUpperCase()) {
    case "COD":
      return t("paymentCod");
    case "BACS":
      return t("paymentBacs");
    default:
      return method;
  }
}
