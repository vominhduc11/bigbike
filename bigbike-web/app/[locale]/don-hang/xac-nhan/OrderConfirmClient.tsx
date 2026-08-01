"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { PurchaseEvent } from "@/components/analytics/PurchaseEvent";
import { fetchOrderLookup, fetchPublicSettings } from "@/lib/api/client-api";
import { queryKeys } from "@/lib/query/keys";
import { OrderConfirmView } from "./OrderConfirmView";

const ORDER_POLL_INTERVAL_MS = 15_000;
const ORDER_TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

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
    refetchOnWindowFocus: true,
    // Chỉ bắt đầu polling sau khi đã tra cứu thành công để không lặp vô hạn
    // với một liên kết sai hoặc lỗi xác thực cố định.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || ORDER_TERMINAL_STATUSES.has(status)) return false;
      return ORDER_POLL_INTERVAL_MS;
    },
    // Mặc định không polling khi tab bị ẩn; lần focus tiếp theo sẽ refetch.
    refetchIntervalInBackground: false,
  });

  const settingsQuery = useQuery({
    queryKey: queryKeys.publicSettings(locale),
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
