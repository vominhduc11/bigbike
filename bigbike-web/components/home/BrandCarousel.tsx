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

      {/* Mobile grid (ẩn ≥ md) */}
      <div className="md:hidden grid max-md:grid-cols-2 min-[430px]:max-md:grid-cols-3 min-[600px]:max-md:grid-cols-4 max-md:gap-2">
        {brands.map((b) => {
          const logo = b.logo?.url
            ? toLegacyWpMediaUrl(resolveMediaUrl(b.logo.url.trim()))
            : null;
          return (
            <Link
              key={b.id}
              href={toBrandPath(b.slug)}
              className="max-md:flex max-md:items-center max-md:justify-center max-md:bg-card max-md:p-2.5 max-md:text-foreground max-md:font-heading max-md:text-[12px] max-md:font-semibold max-md:leading-[1.05] max-md:text-center max-md:uppercase max-md:min-h-[78px] max-md:border max-md:border-border"
            >
              {logo ? (
                <img
                  src={logo}
                  alt={safeText(b.logo?.alt, b.name)}
                  loading="lazy"
                  className="max-md:!max-w-[86%] max-md:max-h-[44px] max-md:!object-contain"
                />
              ) : (
                <span className="max-md:flex max-md:min-h-[42px] max-md:w-full max-md:items-center max-md:justify-center max-md:border max-md:border-dashed max-md:border-[var(--bb-border-default)] max-md:bg-[var(--bb-bg-surface-raised)] max-md:px-1.5 max-md:py-1 max-md:text-muted-foreground">
                  {b.name}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Desktop Swiper (ẩn < md) */}
      <div className="hidden md:block">
        <Swiper
          className="swiper-container"
          speed={1000}
          slidesPerView={2}
          spaceBetween={13}
          watchOverflow
          breakpoints={{
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
      </div>

    </Container>
  );
}
