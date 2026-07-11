"use client";

import { useParams } from "next/navigation";
import { AccountSectionHeading } from "@/components/account/AccountNav";
import { OrderDetailContent } from "./OrderDetailContent";

export function OrderDetailContentIsland() {
  const params = useParams<{ id?: string | string[] }>();
  const rawId = params.id;
  const orderId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!orderId) {
    return (
      <>
        <AccountSectionHeading title="Đơn hàng" />
        <p className="mb-4 text-ui-16 max-md:text-ui-14 text-brand">Không tìm thấy mã đơn hàng.</p>
      </>
    );
  }

  return <OrderDetailContent orderId={orderId} />;
}
