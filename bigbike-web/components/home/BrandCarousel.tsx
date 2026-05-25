"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import Link from "next/link";
import "swiper/css";
import type { Brand } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toBrandPath } from "@/lib/utils/routes";

type Props = { brands: Brand[] };

const HOMEPAGE_BRAND_PRIORITY = ["agv", "alpinestars", "xpro", "augi", "bullfighter"];

function normalizeBrandName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toLegacyWpMediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  return src.startsWith("/wp-content/") ? `https://bigbike.vn${src}` : src;
}

function sortBrandsForHomepage(brands: Brand[]): Brand[] {
  return brands
    .map((brand, index) => ({ brand, index }))
    .sort((a, b) => {
      const aPriority = HOMEPAGE_BRAND_PRIORITY.indexOf(normalizeBrandName(a.brand.name));
      const bPriority = HOMEPAGE_BRAND_PRIORITY.indexOf(normalizeBrandName(b.brand.name));
      const normalizedAPriority = aPriority === -1 ? Number.MAX_SAFE_INTEGER : aPriority;
      const normalizedBPriority = bPriority === -1 ? Number.MAX_SAFE_INTEGER : bPriority;

      if (normalizedAPriority !== normalizedBPriority) {
        return normalizedAPriority - normalizedBPriority;
      }

      return a.index - b.index;
    })
    .map(({ brand }) => brand);
}

export function BrandCarousel({ brands }: Props) {
  if (brands.length === 0) return null;

  const orderedBrands = sortBrandsForHomepage(brands);

  return (
    <div className="container">
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
        {orderedBrands.map((b, index) => {
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
  );
}
