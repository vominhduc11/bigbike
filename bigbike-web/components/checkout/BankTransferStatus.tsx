"use client";

import { useTranslations } from "next-intl";
import type { OrderDetail } from "@/lib/contracts/commerce";
import { bankTransferStatus } from "@/lib/utils/orders";

export function BankTransferStatus({ order }: { order: OrderDetail }) {
  const t = useTranslations("OrderConfirm");
  const status = bankTransferStatus(order);
  if (!status) return null;
  return (
    <p className="my-3 text-a4-content font-semibold text-foreground" role="status">
      {t("transferStatusLabel")}: {t(`transferStatus${status}`)}
    </p>
  );
}
