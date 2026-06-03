"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import Link from "next/link";
import "swiper/css";
import type { Brand } from "@/lib/contracts/public";
import { Container } from "@/components/layout/Container";
import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { toBrandPath } from "@/lib/utils/routes";

type Props = { brands: Brand[] };

export function BrandCarousel({ brands }: Props) {
  if (brands.length === 0) return null;

  return (
    <Container>
      {/* Một carousel duy nhất, tự co giãn responsive từ mobile lên desktop */}
      <Swiper
        className="swiper-container"
        speed={1000}
        slidesPerView={2}
        spaceBetween={13}
        watchOverflow
        breakpoints={{
          430: { slidesPerView: 3, spaceBetween: 16 },
          600: { slidesPerView: 4, spaceBetween: 24 },
          767: { slidesPerView: 5, spaceBetween: 40 },
          1920: { slidesPerView: 6, spaceBetween: 48 },
          2560: { slidesPerView: 7, spaceBetween: 56 },
        }}
      >
        {brands.map((b, index) => {
          const logo = b.logo?.url
            ? toLegacyWpMediaUrl(resolveMediaUrl(b.logo.url.trim()))
            : null;
          return (
            <SwiperSlide key={b.id}>
              <Link href={toBrandPath(b.slug)}>
                {logo ? (
                  <img
                    src={logo}
                    alt={safeText(b.logo?.alt, b.name)}
                    width={1}
                    height={1}
                    loading={index < 5 ? "eager" : "lazy"}
                  />
                ) : (
                  <span>{b.name}</span>
                )}
              </Link>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </Container>
  );
}
