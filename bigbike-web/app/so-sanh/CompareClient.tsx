"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("Compare");
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
    <section className="bb-page bb-compare-page">
      <div className="bb-container pb-28">
        <header className="mb-6">
          <p className="font-heading text-xs font-semibold uppercase tracking-display text-brand">
            {t("kicker")}
          </p>
          <h1 className="font-display text-26 font-semibold uppercase text-foreground">
            {t("heading")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("subheading")}
          </p>
        </header>

        {!hydrated ? (
          <p className="text-muted-foreground">{t("loading")}</p>
        ) : items.length === 0 ? (
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              <Button asChild variant="primary">
                <Link href={toProductListPath()}>{t("browseProducts")}</Link>
              </Button>
            }
          />
        ) : loading && products.length === 0 ? (
          <p className="text-muted-foreground">{t("loadingProducts")}</p>
        ) : products.length === 0 ? (
          <ErrorState
            message={t("loadFailed")}
            retryHref={toProductListPath()}
          />
        ) : (
          <ComparisonTable products={products} />
        )}
      </div>
    </section>
  );
}
