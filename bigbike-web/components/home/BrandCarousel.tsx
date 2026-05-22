"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import Image from "next/image";
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
    <div className="bb-container">
      <div className="relative">
        <Swiper
          speed={1000}
          slidesPerView={2}
          spaceBetween={13}
          watchOverflow
          centerInsufficientSlides
          className="[&_.swiper-wrapper]:items-center"
          breakpoints={{
            767: { slidesPerView: 5, spaceBetween: 40 },
          }}
        >
          {orderedBrands.map((b, index) => {
            const logo = b.logo?.url ? resolveMediaUrl(b.logo.url.trim()) : null;
            return (
              <SwiperSlide
                key={b.id}
                className="!flex !h-auto !items-center !justify-center text-center"
              >
                <Link
                  href={toBrandPath(b.slug)}
                  className="group flex h-[82px] w-full items-center justify-center no-underline max-[766px]:h-[64px]"
                >
                  {logo ? (
                    <span className="relative block h-full w-full max-w-[220px] max-[766px]:max-w-[140px]">
                      <Image
                        src={logo}
                        alt={safeText(b.logo?.alt, b.name)}
                        fill
                        className="object-contain object-center"
                        sizes="(max-width: 766px) 42vw, 18vw"
                        priority={index < 5}
                      />
                    </span>
                  ) : (
                    <span className="font-heading text-17 font-semibold uppercase leading-none text-foreground">
                      {b.name}
                    </span>
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
