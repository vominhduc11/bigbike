"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWishlistProducts } from "@/lib/query/hooks";
import { WpAccountSectionHeading } from "@/components/wp/WpAccountNav";
import { ProductCard } from "@/components/catalog/ProductCard";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { productGrid, skelBase, skelStack } from "@/lib/ui-classes";

const WISHLIST_PATH = "/tai-khoan/yeu-thich/";

export function WishlistContent() {
  const t = useTranslations("Account.wishlist");
  const searchParams = useSearchParams();
  const pageParam = Number(searchParams.get("page"));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const { data, isLoading, error } = useWishlistProducts(page);
  const products = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;

  return (
    <>
      <WpAccountSectionHeading title={t("heading")} />

      {error && <p className="text-brand text-sm mb-4 m-0">{(error as Error).message}</p>}

      {isLoading ? (
        <div className={productGrid} aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bb-product-card">
              <div className={cn("bb-product-image", skelBase)} style={{ aspectRatio: "1/1" }} />
              <div className={cn("bb-product-body", skelStack)}>
                <span className={cn(skelBase, "h-[0.85em] w-2/5")} />
                <span className={cn(skelBase, "h-[0.85em] w-4/5")} />
                <span className={cn(skelBase, "h-[0.85em] w-3/5")} />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={<Button asChild variant="primary" size="sm"><Link href="/san-pham/">{t("emptyAction")}</Link></Button>}
        />
      ) : (
        <>
          <div className={productGrid}>
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          <PaginationNav page={page} totalPages={totalPages} baseHref={WISHLIST_PATH} />
        </>
      )}
    </>
  );
}
