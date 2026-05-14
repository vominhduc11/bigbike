"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchWishlist } from "@/lib/api/client-api";
import { listProducts } from "@/lib/api/public-api";
import type { Product } from "@/lib/contracts/public";
import { AccountShell } from "@/components/layout/AccountShell";
import { ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";

function WishlistContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchWishlist()
      .then(async (ids) => {
        if (!active) return;
        if (ids.length === 0) { setProducts([]); return; }
        // Fetch all products matching wishlist IDs — use id filter via search
        // Products API doesn't support multi-ID lookup; fall back to listing and filtering client-side.
        // For production scale consider a dedicated batch endpoint.
        const result = await listProducts({ page: 1, size: 100 });
        if (!active) return;
        const idSet = new Set(ids);
        const sorted = (result.data ?? []).filter((p) => idSet.has(p.id));
        setProducts(sorted);
      })
      .catch((err: Error) => { if (active) setError(err.message ?? "Không tải được danh sách yêu thích."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <>
      <div className="flex justify-between items-end mb-5 pb-4 border-b border-border">
        <h2 className="font-display uppercase text-[26px] tracking-[0.01em] m-0 text-foreground">Sản phẩm yêu thích</h2>
      </div>

      {error && <p className="text-brand text-sm mb-4 m-0">{error}</p>}

      {loading ? (
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
