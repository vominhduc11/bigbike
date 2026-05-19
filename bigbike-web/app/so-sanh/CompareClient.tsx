"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { useCompare } from "@/lib/compare-context";
import { fetchPublicProduct } from "@/lib/api/client-api";
import { queryKeys } from "@/lib/query/keys";
import { ComparisonTable } from "@/components/catalog/ComparisonTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/button";
import { toProductListPath } from "@/lib/utils/routes";
import type { Product } from "@/lib/contracts/public";

export function CompareClient() {
  const { items, hydrated } = useCompare();

  // One detail fetch per queued product — needed for `specifications`,
  // which the list endpoint omits.
  const results = useQueries({
    queries: items.map((item) => ({
      queryKey: queryKeys.productDetail(item.slug),
      queryFn: () => fetchPublicProduct(item.slug),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const loading = results.some((r) => r.isLoading);
  const products = results
    .map((r) => r.data)
    .filter((p): p is Product => Boolean(p));

  return (
    <section className="bb-page">
      <div className="bb-container pb-28">
        <header className="mb-6">
          <p className="font-heading text-xs font-semibold uppercase tracking-[0.12em] text-brand">
            BigBike
          </p>
          <h1 className="font-display text-2xl font-semibold uppercase text-foreground">
            So sánh sản phẩm
          </h1>
          <p className="mt-1 text-muted-foreground">
            Đặt các sản phẩm cạnh nhau để so thông số, giá và đánh giá trước khi chọn mua.
          </p>
        </header>

        {!hydrated ? (
          <p className="text-muted-foreground">Đang tải danh sách so sánh…</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="Chưa có sản phẩm để so sánh"
            description="Bấm nút so sánh trên các sản phẩm cùng loại để thêm vào đây."
            action={
              <Button asChild variant="primary">
                <Link href={toProductListPath()}>Xem sản phẩm</Link>
              </Button>
            }
          />
        ) : loading && products.length === 0 ? (
          <p className="text-muted-foreground">Đang tải thông tin sản phẩm…</p>
        ) : products.length === 0 ? (
          <ErrorState
            message="Không tải được thông tin sản phẩm để so sánh."
            retryHref={toProductListPath()}
          />
        ) : (
          <ComparisonTable products={products} />
        )}
      </div>
    </section>
  );
}
