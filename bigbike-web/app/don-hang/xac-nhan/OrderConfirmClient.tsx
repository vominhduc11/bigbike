"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { PurchaseEvent } from "@/components/analytics/PurchaseEvent";
import { fetchOrderLookup, fetchPublicSettings } from "@/lib/api/client-api";
import { OrderConfirmView } from "./OrderConfirmView";

export function OrderConfirmClient() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const orderNumber = searchParams.get("so") ?? undefined;
  const orderKey = searchParams.get("key") ?? undefined;
  const canLookup = Boolean(orderNumber && orderKey);

  const orderQuery = useQuery({
    queryKey: ["order-lookup", orderNumber, orderKey],
    queryFn: () => fetchOrderLookup(orderNumber!, orderKey!),
    enabled: canLookup,
    retry: false,
  });

  const settingsQuery = useQuery({
    queryKey: ["public-settings", locale],
    queryFn: () => fetchPublicSettings(locale),
    staleTime: 5 * 60 * 1000,
  });

  const settingsRecord = useMemo(
    () => Object.fromEntries((settingsQuery.data ?? []).map((s) => [s.settingKey, s.settingValue])),
    [settingsQuery.data],
  );
  const order = orderQuery.data ?? null;

  return (
    <>
      {order ? (
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
      ) : null}
      <OrderConfirmView
        orderNumber={orderNumber}
        orderKey={orderKey}
        order={order}
        settingsRecord={settingsRecord}
        isLoading={canLookup && (orderQuery.isLoading || settingsQuery.isLoading)}
      />
    </>
  );
}
