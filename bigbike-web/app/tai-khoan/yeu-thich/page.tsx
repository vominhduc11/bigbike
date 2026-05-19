"use client";

import Link from "next/link";
import { useWishlistProducts } from "@/lib/query/hooks";
import { AccountShell } from "@/components/layout/AccountShell";
import { ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";

function WishlistContent() {
  const { data, isLoading, error } = useWishlistProducts();
  const products = data?.data ?? [];

  return (
    <>
      <div className="flex justify-between items-end mb-5 pb-4 border-b border-border">
        <h2 className="font-display uppercase text-26 tracking-[0.01em] m-0 text-foreground">Sản phẩm yêu thích</h2>
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
          title="Chưa có sản phẩm yêu thích"
          description="Nhấn vào biểu tượng trái tim trên sản phẩm bất kỳ để lưu vào đây."
          action={<Button asChild variant="primary" size="sm"><Link href="/san-pham/">Khám phá sản phẩm</Link></Button>}
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
