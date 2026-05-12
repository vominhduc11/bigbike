"use client";
import { Swiper, SwiperSlide } from "swiper/react";
import Image from "next/image";
import Link from "next/link";
import "swiper/css";
import type { Brand } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toBrandPath } from "@/lib/utils/routes";

type Props = { brands: Brand[] };

export function BrandCarousel({ brands }: Props) {
  if (brands.length === 0) return null;

  return (
    <div className="bb-container">
      <div className="wp-brands-wrap">
        <Swiper
          speed={1000}
          slidesPerView={2}
          spaceBetween={13}
          breakpoints={{
            767: { slidesPerView: 5, spaceBetween: 40 },
          }}
        >
          {brands.map((b) => {
            const logo = b.logo?.url ? resolveMediaUrl(b.logo.url.trim()) : null;
            return (
              <SwiperSlide key={b.id} className="wp-brand-slide">
                <Link href={toBrandPath(b.slug)} className="wp-brand-item">
                  {logo ? (
                    <Image
                      src={logo}
                      alt={safeText(b.logo?.alt, b.name)}
                      width={120}
                      height={56}
                      style={{ objectFit: "contain", width: "auto", height: 56 }}
                    />
                  ) : (
                    <span className="wp-brand-text-fallback">{b.name}</span>
                  )}
                </Link>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>
    </div>
  );
}
