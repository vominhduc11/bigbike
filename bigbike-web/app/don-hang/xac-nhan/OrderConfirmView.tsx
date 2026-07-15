"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { OrderAddress, OrderDetail } from "@/lib/contracts/commerce";
import { StaticPageShell } from "@/components/layout/StaticPageShell";
import { sectionHeading } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { formatAddress, formatVnd, telHref, zaloHref } from "@/lib/utils/format";
import { resolveBankTransfer } from "@/lib/utils/orders";
import { Button } from "@/components/ui/button";

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
 * `OrderDetailContent`/`CheckoutClient` (xem AGENTS.md §6 — client component + next-intl).
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
            <Link href="/" className="block w-full border-2 border-foreground bg-card px-6 py-3.5 text-center font-cta text-b4-action font-bold uppercase text-foreground hover:bg-secondary">
              ← {t("continueShopping")}
            </Link>
          </div>

          <StoreFooterNote address={storeAddress} />
        </>
      ) : (
        <>
          <ThankYouHero message={t("receivedNotice")} />
          {isLoading ? (
            <p className="mx-auto mt-3 max-w-105 text-center text-a4-content leading-6 text-muted-foreground">
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
    <div className="mb-4 flex flex-wrap items-center justify-center gap-3 bg-surface-dark px-5 py-4 text-a5-meta text-white">
      {hotline && (
        <>
          <span>{t("hotlineUrgentPrompt")}</span>
          <span>
            <a href={telHref(hotline)} className="text-white">
              <strong className="text-brand">{hotline}</strong>
            </a>
          </span>
        </>
      )}
      {hotline && zalo && <span>{t("hotlineOr")}</span>}
      {zalo && (
        <span>
          <a href={zaloHref(zalo.hrefValue)} target="_blank" rel="noopener noreferrer" className="text-white">
            <strong className="text-brand">{formatZaloDisplay(zalo.label)}</strong>
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
      className="flex w-full items-center justify-center gap-2 bg-blue px-6 py-4 font-cta text-a3-section font-bold uppercase text-white hover:bg-blue/90"
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
    <p className="text-a5-meta text-muted-foreground text-center mt-6 leading-relaxed">
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
    <StaticPageShell
      title={title}
      breadcrumb={[{ label: "Bigbike.vn", href: "/" }, { label: title }]}
      showHero={false}
      mainClassName="bb-checkout-page"
    >
      <div className="mx-auto max-w-170 px-4 py-8 max-sm:px-3 max-sm:py-4">
        {children}
      </div>
    </StaticPageShell>
  );
}

// Banner thông báo đặt hàng thành công màu đen theo Mockup 2
function SuccessBanner({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations("OrderConfirm");
  return (
    <div className="mb-6 bg-surface-dark px-6 py-7 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand">
        <svg viewBox="0 0 24 24" className="h-8 w-8 fill-white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
      </div>
      <h1 className="mb-2 font-cta text-a1-title font-bold uppercase tracking-wide text-white">{t("successTitle")}</h1>
      <p className="m-0 text-a4-content text-white/70">{t("orderCode")} <strong className="font-cta text-a3-section text-brand">#{orderNumber}</strong></p>
    </div>
  );
}

// Khung hiển thị 3 bước tiếp theo của quy trình giao nhận
function NextSteps({ phone }: { phone: string }) {
  const t = useTranslations("OrderConfirm");
  const richBold = { b: (chunks: React.ReactNode) => <strong>{chunks}</strong> };
  return (
    <div className="mb-4 border border-border border-l-4 border-l-brand bg-secondary p-5 text-left">
      <p className="mb-3 font-cta text-a4-content font-bold uppercase tracking-wide text-brand">{t("nextStepsTitle")}</p>
      <div className="mb-3.5 flex items-start gap-3.5">
        <div className="flex h-8 w-8 min-w-8 items-center justify-center bg-brand font-cta text-a4-content font-bold text-white">1</div>
        <div className="pt-1 text-a4-content leading-relaxed text-foreground [&>strong]:mb-0.5 [&>strong]:block">
          <strong>{t("step1Title")}</strong>
          {t.rich("step1Body", { ...richBold, phone })}
        </div>
      </div>
      <div className="mb-3.5 flex items-start gap-3.5">
        <div className="flex h-8 w-8 min-w-8 items-center justify-center bg-brand font-cta text-a4-content font-bold text-white">2</div>
        <div className="pt-1 text-a4-content leading-relaxed text-foreground [&>strong]:mb-0.5 [&>strong]:block">
          <strong>{t("step2Title")}</strong>
          {t("step2Body")}
        </div>
      </div>
      <div className="flex items-start gap-3.5">
        <div className="flex h-8 w-8 min-w-8 items-center justify-center bg-brand font-cta text-a4-content font-bold text-white">3</div>
        <div className="pt-1 text-a4-content leading-relaxed text-foreground [&>strong]:mb-0.5 [&>strong]:block">
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
    <div className="mx-auto max-w-120 py-2 text-center">
      <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bb-brand-primary-soft)] text-brand">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <p className="m-0 font-cta text-a2-page font-semibold uppercase text-foreground">
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
    <div className="mx-auto max-w-120 text-center">
      <p className="m-0 text-a5-meta uppercase leading-6 text-muted-foreground">
        {t("orderCode")}{" "}
        <strong className="block normal-case text-foreground">{orderNumber}</strong>
      </p>
      <p className="mx-auto mt-3 max-w-105 text-a4-content leading-6 text-muted-foreground">
        {t("loadFailed")}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild><Link href="/">{t("continueShopping")}</Link></Button>
        <Button asChild variant="outline"><Link href="/tai-khoan/don-hang">{t("viewMyOrders")}</Link></Button>
      </div>
    </div>
  );
}

// Card chi tiết đơn hàng gồm danh sách sản phẩm và tổng giá
function OrderDetails({ order }: { order: OrderDetail }) {
  const t = useTranslations("OrderConfirm");
  const paymentMethod = order.payments[0]?.paymentMethod ?? "";

  return (
    <div className="border border-border bg-card p-6 max-sm:p-4">
      <p className="mb-5 border-b-2 border-brand pb-3 font-cta text-a3-section font-bold uppercase tracking-wide text-foreground">{t("orderDetailsTitle")}</p>

      <div className="space-y-4">
        {order.lineItems.map((item) => (
          <div key={item.id} className="mb-3 flex items-center gap-3 border-b border-border pb-3 text-left last:mb-0 last:border-b-0">
            <div className="h-12 w-12 shrink-0 border border-border bg-secondary">
              {item.productThumbnailUrl ? (
                <span
                  role="img"
                  aria-label={item.productName}
                  className="block h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url("${item.productThumbnailUrl}")` }}
                />
              ) : (
                <svg viewBox="0 0 24 24" className="w-9 h-9 fill-border">
                  <path d="M21 6.5C21 4.01 18.99 2 16.5 2h-9C5.01 2 3 4.01 3 6.5v11C3 19.99 5.01 22 7.5 22h9c2.49 0 4.5-2.01 4.5-4.5v-11z" />
                </svg>
              )}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="m-0 mb-1 line-clamp-2 text-a5-meta font-medium leading-snug text-foreground">{item.productName}</p>
              <p className="m-0 text-b5-label text-muted-foreground">
                {item.variantName ? `${item.variantName} · ` : ""}{t("qtyAbbrev")}: {item.quantity}
              </p>
              <p className="m-0 text-a5-meta font-bold text-foreground">{formatVnd(item.lineTotal)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-left">
        <div className="mb-2.5 flex items-center justify-between text-a5-meta text-foreground">
          <span>{t("subtotalLabel")}</span>
          <span>{formatVnd(order.subtotalAmount)}</span>
        </div>

        {order.discountAmount > 0 && (
          <div className="mb-2.5 flex items-center justify-between text-a5-meta text-foreground">
            <span>{t("discountLabel")}</span>
            <span className="text-brand font-semibold">-{formatVnd(order.discountAmount)}</span>
          </div>
        )}

        <div className="mb-2.5 flex items-center justify-between text-a5-meta text-foreground">
          <span>{t("shippingLabel")}</span>
          <span className="text-state-success-text font-bold uppercase">{t("shippingFree")}</span>
        </div>

        {paymentMethod && (
          <div className="mb-2.5 flex items-center justify-between text-a5-meta text-foreground">
            <span>{t("paymentMethodLabel")}</span>
            <span>{legacyPaymentMethodLabel(paymentMethod, t)}</span>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-a5-meta font-bold text-foreground">
          <span>{t("totalLabel")}</span>
          <span className="font-cta text-a3-section text-brand">{formatVnd(order.totalAmount)}</span>
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
    <section>
      <h2 className={cn(sectionHeading, "m-0 mb-4")}>{t("bankTitle")}</h2>
      <div className="border border-border p-4 text-a4-content leading-7 text-foreground">
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
    <div className="border border-border bg-card p-6 max-sm:p-4">
      <p className="mb-5 border-b-2 border-brand pb-3 font-cta text-a3-section font-bold uppercase tracking-wide text-foreground">{t("customerDetailsTitle")}</p>
      <table className="w-full border-collapse text-left text-a4-content">
        <tbody>
          <tr>
            <td className="w-32 border-b border-border py-2.5 pr-3 align-top text-muted-foreground">{t("recipientLabel")}</td>
            <td className="border-b border-border py-2.5 font-bold text-foreground">{billingAddress.fullName}</td>
          </tr>
          <tr>
            <td className="w-32 border-b border-border py-2.5 pr-3 align-top text-muted-foreground">{t("phoneFieldLabel")}</td>
            <td className="border-b border-border py-2.5 font-bold text-foreground">{billingAddress.phone}</td>
          </tr>
          <tr>
            <td className="w-32 border-b border-border py-2.5 pr-3 align-top text-muted-foreground">{t("addressFieldLabel")}</td>
            <td className="border-b border-border py-2.5 font-bold text-foreground">{addressText}</td>
          </tr>
          {order.customerNote && (
            <tr>
              <td className="w-32 py-2.5 pr-3 align-top text-muted-foreground">{t("noteFieldLabel")}</td>
              <td className="py-2.5 font-normal italic text-muted-foreground">{order.customerNote}</td>
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
