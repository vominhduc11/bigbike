"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { OrderListItem } from "@/lib/contracts/commerce";
import { useOrders } from "@/lib/query/hooks";
import { WpAccountSectionHeading } from "@/components/wp/WpAccountNav";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { formatDate, formatVnd, orderStatusLabelWithT } from "@/lib/utils/format";
import { toOrderDetailPath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils";
import { bbLink, skelBase } from "@/lib/ui-classes";

const ORDERS_PATH = "/tai-khoan/don-hang/";

export function OrderHistoryContent() {
  const t = useTranslations("Account.orders");
  const tNav = useTranslations("Account.nav");
  const searchParams = useSearchParams();
  const pageParam = Number(searchParams.get("page"));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const { data, isLoading: loading, error: queryError } = useOrders(page);
  const orders: OrderListItem[] = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const error = queryError ? (queryError as Error).message ?? t("loadFailed") : "";

  return (
    <>
      <WpAccountSectionHeading title={tNav("orders")} />

      {error && <p className="mb-4 text-sm text-brand">{error}</p>}

      {loading ? (
        <div className="overflow-x-auto" aria-busy="true">
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-b border-border">
                  <td className="py-4 pr-4">
                    <span className={cn(skelBase, "h-[0.85em] w-3/5")} />
                  </td>
                  <td className="py-4 pr-4">
                    <span className={cn(skelBase, "h-[0.85em] w-2/5")} />
                  </td>
                  <td className="py-4 pr-4">
                    <span className={cn(skelBase, "h-[0.85em] w-1/2")} />
                  </td>
                  <td className="py-4 pr-4">
                    <span className={cn(skelBase, "h-[0.85em] w-3/5")} />
                  </td>
                  <td className="py-4">
                    <span className={cn(skelBase, "h-10 w-4/5")} />
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
          {/* Desktop (md+): full 5-column table */}
          <div className="hidden overflow-x-auto md:block">
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
                      <Link href={toOrderDetailPath(order.id)} className={bbLink}>
                        #{order.orderNumber}
                      </Link>
                      {order.productNames && order.productNames.length > 0 && (
                        <p className="m-0 mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {order.productNames.join(", ")}
                        </p>
                      )}
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

          {/* Mobile (≤767): stacked labelled cards — WP shop_table_responsive parity (no horizontal scroll) */}
          <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
            {orders.map((order) => (
              <li key={order.id} className="border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <Link href={toOrderDetailPath(order.id)} className={`${bbLink} font-semibold`}>
                    #{order.orderNumber}
                  </Link>
                  <span className="text-sm text-muted-foreground">{orderStatusLabelWithT(order.status, t)}</span>
                </div>
                {order.productNames && order.productNames.length > 0 && (
                  <p className="m-0 mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {order.productNames.join(", ")}
                  </p>
                )}
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="font-semibold text-foreground">{t("colDate")}</dt>
                  <dd className="m-0 text-muted-foreground">{formatDate(order.placedAt)}</dd>
                  <dt className="font-semibold text-foreground">{t("colTotal")}</dt>
                  <dd className="m-0 text-muted-foreground">
                    {t("totalCell", { total: formatVnd(order.totalAmount), count: order.itemCount })}
                  </dd>
                </dl>
                <Link
                  href={toOrderDetailPath(order.id)}
                  className="mt-3 inline-flex h-11 w-full items-center justify-center bg-brand px-5 font-cta text-sm font-semibold uppercase text-white hover:bg-brand-hover"
                >
                  {t("view")}
                </Link>
              </li>
            ))}
          </ul>

          <PaginationNav page={page} totalPages={totalPages} baseHref={ORDERS_PATH} />
        </>
      )}
    </>
  );
}
