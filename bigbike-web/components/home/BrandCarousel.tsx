"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import Link from "next/link";
import "swiper/css";
import type { Brand } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toBrandPath } from "@/lib/utils/routes";

type Props = { brands: Brand[] };

function toLegacyWpMediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  return src.startsWith("/wp-content/") ? `https://bigbike.vn${src}` : src;
}

export function BrandCarousel({ brands }: Props) {
  if (brands.length === 0) return null;

  return (
    <div className="container">
      <div className="bb-brand-mobile-grid md:hidden">
        {brands.map((b) => {
          const logo = b.logo?.url
            ? toLegacyWpMediaUrl(resolveMediaUrl(b.logo.url.trim()))
            : null;
          return (
            <Link key={b.id} href={toBrandPath(b.slug)} className="bb-brand-mobile-cell">
              {logo ? (
                <img
                  src={logo}
                  alt={safeText(b.logo?.alt, b.name)}
                  loading="lazy"
                />
              ) : (
                <span>{b.name}</span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="hidden md:block">
        <Swiper
          className="swiper-container"
          speed={1000}
          slidesPerView={2}
          spaceBetween={13}
          watchOverflow
          breakpoints={{
            767: { slidesPerView: 5, spaceBetween: 40 },
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
                    <>
                      <img
                        src={logo}
                        alt={safeText(b.logo?.alt, b.name)}
                        className="swiper-lazy"
                        width={1}
                        height={1}
                        loading={index < 5 ? "eager" : "lazy"}
                      />
                      <div className="swiper-lazy-preloader" />
                    </>
                  ) : (
                    <span>{b.name}</span>
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
