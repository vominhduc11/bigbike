"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useWishlistProducts } from "@/lib/query/hooks";
import { AccountShell } from "@/components/layout/AccountShell";
import { ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";

function WishlistContent() {
  const t = useTranslations("Account.wishlist");
  const { data, isLoading, error } = useWishlistProducts();
  const products = data?.data ?? [];

  return (
    <>
      <div className="flex justify-between items-end mb-5 pb-4 border-b border-border">
        <h2 className="font-display uppercase text-26 tracking-wide m-0 text-foreground">{t("heading")}</h2>
      </div>

      {error && <p className="text-brand text-sm mb-4 m-0">{(error as Error).message}</p>}

      {isLoading ? (
        <div className="bb-product-grid" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bb-product-card">
              <div className="bb-product-image bb-skel" style={{ aspectRatio: "1/1" }} />
              <div className="bb-product-body bb-skel-stack">
                <span className="bb-skel bb-skel--text bb-skel-w-40" />
                <span className="bb-skel bb-skel--text bb-skel-w-80" />
                <span className="bb-skel bb-skel--text bb-skel-w-60" />
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
        <div className="bb-product-grid">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </>
  );
}

export default function WishlistPage() {
  return (
    <AccountShell loginRedirect="/tai-khoan/yeu-thich/">
      <WishlistContent />
    </AccountShell>
  );
}
