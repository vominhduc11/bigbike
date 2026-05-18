"use client";
import { Swiper, SwiperSlide } from "swiper/react";
import Image from "next/image";
import Link from "next/link";
import "swiper/css";
import type { Brand } from "@/lib/contracts/public";
import { BB_BREAKPOINTS } from "@/lib/ui/breakpoints";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toBrandPath } from "@/lib/utils/routes";

type Props = { brands: Brand[] };

export function BrandCarousel({ brands }: Props) {
  if (brands.length === 0) return null;

  return (
    <div className="bb-container">
      <div className="relative">
        <Swiper
          speed={1000}
          slidesPerView={2}
          spaceBetween={13}
          breakpoints={{
            [BB_BREAKPOINTS.sm]: { slidesPerView: 3, spaceBetween: 24 },
            [BB_BREAKPOINTS.md]: { slidesPerView: 5, spaceBetween: 40 },
          }}
        >
          {brands.map((b) => {
            const logo = b.logo?.url ? resolveMediaUrl(b.logo.url.trim()) : null;
            return (
              <SwiperSlide key={b.id} className="text-center flex items-center justify-center">
                <Link href={toBrandPath(b.slug)} className="flex items-center justify-center no-underline">
                  {logo ? (
                    <Image
                      src={logo}
                      alt={safeText(b.logo?.alt, b.name)}
                      width={120}
                      height={56}
                      style={{ objectFit: "contain", width: "auto", height: 56 }}
                    />
                  ) : (
                    <span className="text-13 font-bold text-muted-foreground uppercase">{b.name}</span>
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
