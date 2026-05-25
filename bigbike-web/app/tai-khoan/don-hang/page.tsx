"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { OrderListItem } from "@/lib/contracts/commerce";
import { useOrders } from "@/lib/query/hooks";
import { AccountSectionHeading, AccountShell } from "@/components/layout/AccountShell";
import { formatDate, formatVnd, orderStatusLabelWithT } from "@/lib/utils/format";
import { toOrderDetailPath } from "@/lib/utils/routes";

function OrderHistoryContent() {
  const t = useTranslations("Account.orders");
  const tNav = useTranslations("Account.nav");
  const [page, setPage] = useState(1);

  const { data, isLoading: loading, error: queryError } = useOrders(page);
  const orders: OrderListItem[] = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const error = queryError ? (queryError as Error).message ?? t("loadFailed") : "";

  return (
    <>
      <AccountSectionHeading title={tNav("orders")} />

      {error && <p className="mb-4 text-sm text-brand">{error}</p>}

      {loading ? (
        <div className="overflow-x-auto" aria-busy="true">
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-b border-border">
                  <td className="py-4 pr-4">
                    <span className="bb-skel bb-skel--text bb-skel-w-60" />
                  </td>
                  <td className="py-4 pr-4">
                    <span className="bb-skel bb-skel--text bb-skel-w-40" />
                  </td>
                  <td className="py-4 pr-4">
                    <span className="bb-skel bb-skel--text bb-skel-w-50" />
                  </td>
                  <td className="py-4 pr-4">
                    <span className="bb-skel bb-skel--text bb-skel-w-60" />
                  </td>
                  <td className="py-4">
                    <span className="bb-skel bb-skel--btn bb-skel-w-80" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-[60px] text-center">
          <p className="m-0 text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 font-semibold text-foreground">{t("colOrder")}</th>
                  <th className="py-3 pr-4 font-semibold text-foreground">{t("colDate")}</th>
                  <th className="py-3 pr-4 font-semibold text-foreground">{t("colStatus")}</th>
                  <th className="py-3 pr-4 font-semibold text-foreground">{t("colTotal")}</th>
                  <th className="py-3 font-semibold text-foreground">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-border">
                    <td className="py-4 pr-4 align-top">
                      <Link href={toOrderDetailPath(order.id)} className="bb-link font-normal">
                        #{order.orderNumber}
                      </Link>
                    </td>
                    <td className="py-4 pr-4 align-top text-muted-foreground">{formatDate(order.placedAt)}</td>
                    <td className="py-4 pr-4 align-top text-muted-foreground">{orderStatusLabelWithT(order.status, t)}</td>
                    <td className="py-4 pr-4 align-top text-muted-foreground">
                      {t("totalCell", {
                        total: formatVnd(order.totalAmount),
                        count: order.itemCount,
                      })}
                    </td>
                    <td className="py-4 align-top">
                      <Link
                        href={toOrderDetailPath(order.id)}
                        className="inline-flex h-9 items-center justify-center bg-brand px-5 font-cta text-sm font-semibold uppercase text-white hover:bg-brand-hover"
                      >
                        {t("view")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-end gap-4 text-sm">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-foreground underline disabled:opacity-30"
              >
                {t("previous")}
              </button>
              <span className="text-muted-foreground">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-foreground underline disabled:opacity-30"
              >
                {t("next")}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function OrderHistoryPage() {
  return (
    <AccountShell loginRedirect="/tai-khoan/don-hang/">
      <OrderHistoryContent />
    </AccountShell>
  );
}
