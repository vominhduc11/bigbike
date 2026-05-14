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
    const filtered = getRecentProducts().filter((p) => p.id !== currentProductId).slice(0, 6);
    const id = setTimeout(() => setItems(filtered), 0);
    return () => clearTimeout(id);
  }, [currentProductId, currentProduct]);

  if (items.length < 2) return null;

  return (
    <section className="bb-pdp-recently-viewed">
      <div className="bb-pdp-recently-header">
        <p className="bb-kicker">VỪA XEM</p>
        <h2 className="bb-pdp-recently-title">Sản phẩm đã xem gần đây</h2>
      </div>
      <div className="bb-pdp-recently-grid">
        {items.map((p) => {
          const src = p.imageUrl ? resolveMediaUrl(p.imageUrl) : null;
          return (
            <Link key={p.id} href={toProductPath(p.slug)} className="bb-pdp-recently-card">
              <div className="bb-pdp-recently-img">
                {src ? (
                  <Image
                    src={src}
                    alt={safeText(p.name, "Sản phẩm")}
                    fill
                    sizes="(max-width: 600px) 50vw, 200px"
                  />
                ) : (
                  <div className="bb-pdp-recently-img-fallback" />
                )}
              </div>
              <div className="bb-pdp-recently-body">
                {p.categoryName && <p className="bb-pdp-recently-cat">{p.categoryName}</p>}
                <p className="bb-pdp-recently-name">{p.name}</p>
                {p.price != null && p.price > 0 && (
                  <p className="bb-pdp-recently-price">{formatVnd(p.price)}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
