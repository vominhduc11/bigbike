"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCompare } from "@/lib/compare-context";
import { useCart } from "@/lib/cart-context";
import { MediaImage } from "@/components/ui/MediaImage";
import { RatingStars } from "@/components/ui/RatingStars";
import { formatVnd, safeText } from "@/lib/utils/format";
import { toProductPath } from "@/lib/utils/routes";
import type { Product } from "@/lib/contracts/public";

type ComparisonTableProps = {
  products: Product[];
};

function priceOf(p: Product): { current: number; compare: number | null } {
  const retail = p.price?.retailPrice ?? 0;
  const sale = p.price?.salePrice && p.price.salePrice > 0 ? p.price.salePrice : null;
  const compareAt =
    p.price?.compareAtPrice && p.price.compareAtPrice > 0 ? p.price.compareAtPrice : null;
  const current = sale ?? retail;
  return { current, compare: compareAt && compareAt > current ? compareAt : null };
}

/** Distinct variant option values per attribute name (e.g. Màu sắc → [Đỏ, Đen]). */
function optionsSummary(p: Product): { name: string; values: string[] }[] {
  const map = new Map<string, Set<string>>();
  for (const variant of p.variants ?? []) {
    for (const option of variant.options ?? []) {
      const name = option.name?.trim();
      const value = option.value?.trim();
      if (!name || !value) continue;
      if (!map.has(name)) map.set(name, new Set());
      map.get(name)!.add(value);
    }
  }
  return [...map.entries()].map(([name, values]) => ({ name, values: [...values] }));
}

export function ComparisonTable({ products }: ComparisonTableProps) {
  const t = useTranslations("Compare");
  const tProduct = useTranslations("Product");
  const { remove } = useCompare();
  const { addToCart, showToast } = useCart();

  function stockLabelT(stockState: string | null | undefined): string {
    switch (stockState) {
      case "IN_STOCK": return tProduct("stockState.IN_STOCK");
      case "LOW_STOCK": return tProduct("stockState.LOW_STOCK");
      case "OUT_OF_STOCK": return tProduct("stockState.OUT_OF_STOCK");
      default: return tProduct("stockState.UNKNOWN");
    }
  }

  // ── Union of specification rows across every product, clustered by group ──
  const specKeys: { group: string | null; name: string }[] = [];
  const seen = new Set<string>();
  for (const product of products) {
    for (const spec of product.specifications ?? []) {
      const name = (spec.name ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      specKeys.push({ group: spec.group?.trim() || null, name });
    }
  }
  const groupOrder = new Map<string, number>();
  specKeys.forEach((k) => {
    const g = k.group ?? "";
    if (!groupOrder.has(g)) groupOrder.set(g, groupOrder.size);
  });
  const sortedSpecKeys = specKeys
    .map((k, i) => ({ k, i }))
    .sort(
      (a, b) =>
        (groupOrder.get(a.k.group ?? "") ?? 0) - (groupOrder.get(b.k.group ?? "") ?? 0) ||
        a.i - b.i,
    )
    .map((x) => x.k);

  const specLookups = products.map((product) => {
    const lookup = new Map<string, string>();
    for (const spec of product.specifications ?? []) {
      const name = (spec.name ?? "").trim().toLowerCase();
      if (name && !lookup.has(name)) lookup.set(name, safeText(spec.value, "—"));
    }
    return lookup;
  });

  async function handleAddToCart(product: Product) {
    try {
      await addToCart(product.id, 1);
    } catch (err) {
      showToast(
        t("addToCartErrorTitle"),
        err instanceof Error ? err.message : t("addToCartError"),
      );
    }
  }

  const colCount = products.length + 1;

  /** Builds a labelled criterion row — one label cell + one cell per product. */
  const criterionRow = (label: string, render: (p: Product, i: number) => ReactNode) => (
    <tr className="border-t border-border">
      <th
        scope="row"
        className="sticky left-0 z-[1] min-w-[120px] bg-muted px-3 py-3 text-left align-top font-medium text-muted-foreground"
      >
        {label}
      </th>
      {products.map((product, i) => (
        <td key={product.id} className="min-w-[160px] px-3 py-3 align-top text-foreground">
          {render(product, i)}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-[1] min-w-[120px] bg-muted px-3 py-3 text-left align-bottom font-heading text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {t("tableProductCol")}
            </th>
            {products.map((product) => {
              const name = safeText(product.name, t("tableProductCol"));
              return (
                <th key={product.id} className="min-w-[160px] px-3 py-3 align-top">
                  <div className="relative flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => remove(product.id)}
                      aria-label={t("removeAriaLabel", { name })}
                      className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center bg-white text-muted-foreground transition-colors hover:text-brand"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                    <Link href={toProductPath(product.slug)} className="block">
                      <MediaImage
                        image={product.image}
                        altFallback={name}
                        width={200}
                        height={200}
                        className="aspect-square w-full object-cover"
                      />
                    </Link>
                    <Link
                      href={toProductPath(product.slug)}
                      className="line-clamp-3 text-left font-heading text-sm font-semibold uppercase leading-tight text-foreground transition-colors hover:text-brand"
                    >
                      {name}
                    </Link>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {criterionRow(t("brandRow"), (p) => safeText(p.brand?.name, "BigBike"))}
          {criterionRow(t("priceRow"), (p) => {
            const { current, compare } = priceOf(p);
            return (
              <span className="flex flex-col">
                <b className="font-display text-base text-brand">
                  {current > 0 ? formatVnd(current) : t("contactPrice")}
                </b>
                {compare && (
                  <s className="text-xs text-muted-foreground">{formatVnd(compare)}</s>
                )}
              </span>
            );
          })}
          {criterionRow(t("ratingRow"), (p) =>
            p.rating != null && p.rating > 0 ? (
              <span className="flex flex-col gap-0.5">
                <RatingStars value={p.rating} />
                {p.ratingCount != null && p.ratingCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {t("ratingCount", { count: p.ratingCount })}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">{t("noRating")}</span>
            ),
          )}
          {criterionRow(t("stockRow"), (p) =>
            stockLabelT(p.forceOutOfStock ? "OUT_OF_STOCK" : p.stockState),
          )}
          {criterionRow(t("optionsRow"), (p) => {
            const groups = optionsSummary(p);
            if (groups.length === 0) return <span className="text-muted-foreground">{t("noOptions")}</span>;
            return (
              <span className="flex flex-col gap-1">
                {groups.map((g) => (
                  <span key={g.name}>
                    <span className="text-muted-foreground">{g.name}: </span>
                    {g.values.join(", ")}
                  </span>
                ))}
              </span>
            );
          })}

          {/* Technical specifications — union of every product's spec rows. */}
          {sortedSpecKeys.length > 0 &&
            sortedSpecKeys.map((specKey, index) => {
              const prevGroup =
                index > 0 ? sortedSpecKeys[index - 1].group : "__none__";
              const showHeader = specKey.group !== null && specKey.group !== prevGroup;
              return (
                <Fragment key={`spec-${index}`}>
                  {showHeader && (
                    <tr>
                      <th
                        colSpan={colCount}
                        className="border-t border-border bg-secondary px-3 py-2 text-left font-heading text-xs font-semibold uppercase tracking-[0.06em] text-foreground"
                      >
                        {specKey.group}
                      </th>
                    </tr>
                  )}
                  <tr className="border-t border-border">
                    <th
                      scope="row"
                      className="sticky left-0 z-[1] min-w-[120px] bg-muted px-3 py-3 text-left align-top font-medium text-muted-foreground"
                    >
                      {specKey.name}
                    </th>
                    {products.map((product, i) => (
                      <td
                        key={product.id}
                        className="min-w-[160px] px-3 py-3 align-top text-foreground"
                      >
                        {specLookups[i].get(specKey.name.toLowerCase()) ?? "—"}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              );
            })}

          {/* Actions */}
          <tr className="border-t border-border">
            <th
              scope="row"
              className="sticky left-0 z-[1] min-w-[120px] bg-muted px-3 py-3 text-left align-top font-medium text-muted-foreground"
            >
              {""}
            </th>
            {products.map((product) => {
              const hasVariants = !!product.variants?.length;
              const soldOut =
                product.forceOutOfStock || product.stockState === "OUT_OF_STOCK";
              return (
                <td key={product.id} className="min-w-[160px] px-3 py-3 align-top">
                  <div className="flex flex-col gap-2">
                    {!hasVariants && !soldOut && (
                      <button
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        className="bg-brand px-3 py-2 text-center font-heading text-xs font-semibold uppercase tracking-[0.04em] text-white transition-colors hover:bg-brand-hover"
                      >
                        {t("addToCart")}
                      </button>
                    )}
                    <Link
                      href={toProductPath(product.slug)}
                      className="border border-border px-3 py-2 text-center font-heading text-xs font-semibold uppercase tracking-[0.04em] text-foreground transition-colors hover:border-brand hover:text-brand"
                    >
                      {t("viewProduct")}
                    </Link>
                  </div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
