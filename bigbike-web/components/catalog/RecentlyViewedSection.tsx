"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { type RecentProduct, getRecentProducts, saveRecentProduct } from "@/lib/recently-viewed";
import { formatVnd, resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toProductPath } from "@/lib/utils/routes";

type Props = {
  currentProductId: string;
  currentProduct: {
    id: string;
    slug: string;
    name: string;
    price?: number | null;
    imageUrl?: string | null;
    categoryName?: string | null;
  };
};

export function RecentlyViewedSection({ currentProductId, currentProduct }: Props) {
  const [items, setItems] = useState<RecentProduct[]>([]);

  useEffect(() => {
    saveRecentProduct(currentProduct);
    const all = getRecentProducts();
    setItems(all.filter((p) => p.id !== currentProductId).slice(0, 6));
  }, [currentProductId, currentProduct]);

  if (items.length === 0) return null;

  return (
    <section className="wp-pdp-recently-viewed">
      <div className="wp-pdp-recently-header">
        <p className="wp-kicker">VỪA XEM</p>
        <h2 className="wp-pdp-recently-title">Sản phẩm đã xem gần đây</h2>
      </div>
      <div className="wp-pdp-recently-grid">
        {items.map((p) => {
          const src = p.imageUrl ? resolveMediaUrl(p.imageUrl) : null;
          return (
            <Link key={p.id} href={toProductPath(p.slug)} className="wp-pdp-recently-card">
              <div className="wp-pdp-recently-img">
                {src ? (
                  <Image
                    src={src}
                    alt={safeText(p.name, "Sản phẩm")}
                    fill
                    sizes="(max-width: 600px) 50vw, 200px"
                  />
                ) : (
                  <div className="wp-pdp-recently-img-fallback" />
                )}
              </div>
              <div className="wp-pdp-recently-body">
                {p.categoryName && <p className="wp-pdp-recently-cat">{p.categoryName}</p>}
                <p className="wp-pdp-recently-name">{p.name}</p>
                {p.price != null && p.price > 0 && (
                  <p className="wp-pdp-recently-price">{formatVnd(p.price)}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
