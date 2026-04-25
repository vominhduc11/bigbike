"use client";
import { useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Brand } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toBrandPath } from "@/lib/utils/routes";

type Props = { brands: Brand[] };

export function BrandCarousel({ brands }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  }, []);

  if (brands.length === 0) return null;

  return (
    <div className="wp-brands-wrap">
      <button
        className="wp-car-btn wp-car-prev"
        onClick={() => scroll(-1)}
        aria-label="Cuộn trái"
      >
        ‹
      </button>

      <div className="wp-brands-carousel" ref={trackRef}>
        {brands.map((b) => {
          const logo = b.logo?.url ? resolveMediaUrl(b.logo.url.trim()) : null;
          return (
            <Link key={b.id} href={toBrandPath(b.slug)} className="wp-brand-item">
              {logo ? (
                <Image
                  src={logo}
                  alt={safeText(b.logo?.alt, b.name)}
                  width={120}
                  height={56}
                  style={{ objectFit: "contain", width: "auto", height: 56 }}
                  unoptimized
                />
              ) : (
                <span className="wp-brand-text-fallback">{b.name}</span>
              )}
            </Link>
          );
        })}
      </div>

      <button
        className="wp-car-btn wp-car-next"
        onClick={() => scroll(1)}
        aria-label="Cuộn phải"
      >
        ›
      </button>
    </div>
  );
}
