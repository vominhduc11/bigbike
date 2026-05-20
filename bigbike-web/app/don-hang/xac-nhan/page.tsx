import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getOrderLookup, listPublicSettings } from "@/lib/api/public-api";
import { PurchaseEvent } from "@/components/analytics/PurchaseEvent";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { formatVnd } from "@/lib/utils/format";
import { toHomePath, toOrderHistoryPath, toProductListPath } from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";
import { Button } from "@/components/ui/button";

const FALLBACK_HOTLINE = "0906.902.404";

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
  const [orderLookup, settingsResult, t] = await Promise.all([
    orderNumber && orderKey ? getOrderLookup(orderNumber, orderKey) : Promise.resolve({ data: null, error: null }),
    listPublicSettings(),
    getTranslations("OrderConfirm"),
  ]);
  const order = orderLookup.data;
  const settings = settingsResult.data ?? [];
  const hotline = pickSetting(settings, ["hotline", "phone", "support_phone"]) || FALLBACK_HOTLINE;
  const bankName = pickSetting(settings, ["bank_name"]);
  const bankNumber = pickSetting(settings, ["bank_account_number", "bank_number"]);
  const bankHolder = pickSetting(settings, ["bank_account_holder", "bank_holder"]);
  const bankBranch = pickSetting(settings, ["bank_branch"]);

  // Order-success biker illustration. The asset is supplied separately; until it
  // is added to public/, the page falls back to a branded check badge so there is
  // no broken image. Drop the file at public/illustrations/order-success.png.
  const orderSuccessImage = "/illustrations/order-success.png";
  const hasIllustration = existsSync(join(process.cwd(), "public", orderSuccessImage));

  const rawPaymentMethod = order?.payments?.[0]?.paymentMethod ?? "";
  const paymentMethodCode = rawPaymentMethod.trim().toUpperCase();
  const isBacs = paymentMethodCode === "BACS";
  const paymentStatus = (order?.paymentStatus ?? "").trim().toUpperCase();
  const isAlreadyPaid = paymentStatus === "PAID";
  const heading = isAlreadyPaid
    ? t("headingPaid")
    : isBacs
      ? t("headingBacs")
      : t("headingDefault");
  const subline = isAlreadyPaid
    ? t("sublinePaid")
    : isBacs
      ? t("sublineBacs")
      : t("sublineDefault");

  if (!orderNumber || !orderKey) {
    return (
      <div className="max-w-[720px] mx-auto my-[60px] px-6 text-center max-sm:px-4 max-sm:my-8">
        <div className="bb-round w-[88px] h-[88px] rounded-full bg-muted flex items-center justify-center mx-auto mb-[22px] border-2 border-border">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="font-display text-32 tracking-[0.01em] uppercase m-0 mb-[10px]">{t("notFoundTitle")}</h1>
        <p className="text-muted-foreground m-0 mb-7">{t("notFoundDescription")}</p>
        <div className="flex gap-[10px] justify-center max-sm:flex-col">
          <Button asChild variant="secondary">
            <Link href={toHomePath()}>{t("backHome")}</Link>
          </Button>
          <Button asChild variant="primary">
            <Link href={toOrderHistoryPath()}>{t("viewMyOrders")}</Link>
          </Button>
        </div>
      </div>
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

      <div className="max-w-[640px] mx-auto my-[60px] px-6 text-center max-sm:px-4 max-sm:my-8">
        {/* Order-success illustration inside a branded pink circle. Falls back to
            a check badge until the biker artwork is added to public/. */}
        <div className="bb-round w-[180px] h-[180px] rounded-full bg-[rgba(255,12,9,0.10)] flex items-center justify-center mx-auto mb-7 overflow-hidden max-sm:w-[140px] max-sm:h-[140px]">
          {hasIllustration ? (
            <Image
              src={orderSuccessImage}
              alt={t("successImageAlt")}
              width={180}
              height={180}
              className="w-full h-full object-contain"
              priority
            />
          ) : (
            <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="var(--bb-brand-primary, #FF0C09)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </div>

        <h1 className="font-display text-32 tracking-[0.01em] uppercase m-0 mb-3 max-sm:text-2xl">{heading}</h1>
        <p className="text-muted-foreground m-0 mb-4 leading-[1.7]">{subline}</p>

        <p className="m-0 mb-7 text-base text-foreground">
          {t("orderCode")} <strong className="font-display text-brand font-semibold tracking-[0.01em]">#{orderNumber}</strong>
        </p>

        {isBacs && order && (bankNumber || bankName) && (
          <div className="bg-card border border-border p-[20px_22px] max-w-[480px] mx-auto mb-7 text-left">
            <p className="text-sm font-bold tracking-[0.06em] uppercase text-foreground mb-[10px] m-0">{t("bankTitle")}</p>
            {bankHolder && (
              <div className="flex justify-between items-baseline text-sm py-1.5 gap-3">
                <span className="text-muted-foreground">{t("bankHolder")}</span>
                <b className="text-foreground whitespace-nowrap font-bold">{bankHolder}</b>
              </div>
            )}
            {bankNumber && (
              <div className="flex justify-between items-baseline text-sm py-1.5 gap-3">
                <span className="text-muted-foreground">{t("bankNumber")}</span>
                <b className="text-foreground whitespace-nowrap font-bold">{bankNumber}</b>
              </div>
            )}
            {bankName && (
              <div className="flex justify-between items-baseline text-sm py-1.5 gap-3">
                <span className="text-muted-foreground">{t("bankName")}</span>
                <b className="text-foreground whitespace-nowrap font-bold">{bankName}{bankBranch ? ` — ${bankBranch}` : ""}</b>
              </div>
            )}
            <div className="flex justify-between items-baseline text-sm py-1.5 gap-3">
              <span className="text-muted-foreground">{t("bankTransferNote")}</span>
              <b className="text-foreground whitespace-nowrap font-bold">BIGBIKE {orderNumber}</b>
            </div>
            {order && (
              <div className="flex justify-between items-baseline text-sm py-1.5 gap-3">
                <span className="text-muted-foreground">{t("bankAmount")}</span>
                <b className="text-brand whitespace-nowrap font-bold">{formatVnd(order.totalAmount)}</b>
              </div>
            )}
          </div>
        )}

        {isBacs && order && !bankNumber && !bankName && (
          <div className="bg-card border border-border p-[20px_22px] max-w-[480px] mx-auto mb-7 text-left">
            <p className="text-sm text-foreground m-0 leading-[1.6]">
              {t.rich("bankHotlineFallback", {
                hotline,
                orderNumber,
                b: (chunks) => <b className="text-brand">{chunks}</b>,
                code: (chunks) => <b>{chunks}</b>,
              })}
            </p>
          </div>
        )}

        {orderLookup.error && !order && (
          <p className="text-brand text-sm mb-4 m-0">{t("loadFailed")}</p>
        )}

        <div className="flex justify-center">
          <Button asChild variant="primary" size="lg" className="w-full sm:w-auto sm:min-w-[280px]">
            <Link href={toProductListPath()}>{t("continueShopping")}</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
