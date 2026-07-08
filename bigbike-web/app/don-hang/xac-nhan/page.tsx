import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getOrderLookup, listPublicSettings } from "@/lib/api/public-api";
import { PurchaseEvent } from "@/components/analytics/PurchaseEvent";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { OrderConfirmView } from "./OrderConfirmView";

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

// Fetch (mã đơn + key tra cứu) làm ở SERVER — nhưng toàn bộ hiển thị/dịch thuật giao cho
// `OrderConfirmView` ("use client"): trang này không có lý do giữ ISR/SSG (searchParams-
// dependent, noIndex), nên không cần ép server render `vi` như PDP/catalog — xem comment
// trong OrderConfirmView.tsx.
export default async function OrderConfirmPage({ searchParams }: Props) {
  const { so: orderNumber, key: orderKey } = await searchParams;
  const [orderLookup, settingsResult] = await Promise.all([
    orderNumber && orderKey ? getOrderLookup(orderNumber, orderKey) : Promise.resolve({ data: null, error: null }),
    listPublicSettings("vi"),
  ]);
  const order = orderLookup.data;
  const settingsRecord = Object.fromEntries(
    (settingsResult.data ?? []).map((s) => [s.settingKey, s.settingValue]),
  );

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
      <OrderConfirmView orderNumber={orderNumber} orderKey={orderKey} order={order} settingsRecord={settingsRecord} />
    </>
  );
}
