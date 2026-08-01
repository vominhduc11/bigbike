"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AccountSectionHeading } from "@/components/account/AccountNav";
import { OrderDetailContent } from "./OrderDetailContent";

export function OrderDetailContentIsland() {
  const t = useTranslations("Account.orders");
  const params = useParams<{ id?: string | string[] }>();
  const rawId = params.id;
  const orderId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!orderId) {
    return (
      <>
        <AccountSectionHeading title={t("detailHeading")} />
        <p className="mb-4 text-a4-content text-brand">{t("orderNotFoundShort")}</p>
      </>
    );
  }

  return <OrderDetailContent orderId={orderId} />;
}
