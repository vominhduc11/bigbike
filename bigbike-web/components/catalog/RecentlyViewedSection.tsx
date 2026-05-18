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
    <section className="mt-12 border-t border-[color:var(--bb-border-default)] pt-9">
      <div className="mb-[18px]">
        <p className="bb-kicker">VỪA XEM</p>
        <h2 className="mt-1 mb-0 font-heading text-[clamp(1.1rem,2vw,1.4rem)] font-semibold uppercase leading-normal text-foreground">
          Sản phẩm đã xem gần đây
        </h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3.5">
        {items.map((p) => {
          const src = p.imageUrl ? resolveMediaUrl(p.imageUrl) : null;
          return (
            <Link
              key={p.id}
              href={toProductPath(p.slug)}
              className="flex flex-col gap-2 overflow-hidden border border-[color:var(--bb-border-default)] bg-card no-underline transition-colors hover:border-brand"
            >
              <div className="relative aspect-square bg-white">
                {src ? (
                  <Image
                    src={src}
                    alt={safeText(p.name, "Sản phẩm")}
                    fill
                    sizes="(max-width: 600px) 50vw, 200px"
                    className="object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[color:var(--bb-color-gray-100)]" />
                )}
              </div>
              <div className="flex flex-col gap-[3px] px-2.5 pt-2 pb-2.5">
                {p.categoryName && (
                  <p className="m-0 text-sm font-bold uppercase tracking-[0.12em] text-brand">
                    {p.categoryName}
                  </p>
                )}
                <p className="m-0 line-clamp-2 text-sm font-bold uppercase leading-[1.35] tracking-[0.03em] text-foreground">
                  {p.name}
                </p>
                {p.price != null && p.price > 0 && (
                  <p className="m-0 text-sm font-bold text-brand">{formatVnd(p.price)}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
