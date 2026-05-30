"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import "swiper/css";
import type { Brand } from "@/lib/contracts/public";
import { MobileSectionHeader } from "@/components/home/MobileSectionHeader";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toBrandPath } from "@/lib/utils/routes";

type Props = {
  brands: Brand[];
  viewAllHref?: string;
};

function toLegacyWpMediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  return src.startsWith("/wp-content/") ? `https://bigbike.vn${src}` : src;
}

export function BrandCarousel({ brands, viewAllHref }: Props) {
  if (brands.length === 0) return null;

  return (
    <div className="bb-container">

      {/* Mobile: MobileSectionHeader chuẩn (ẩn ≥ md) */}
      <div className="md:hidden">
        <MobileSectionHeader
          kicker="Đối tác"
          title="Thương hiệu"
          href={viewAllHref}
        />
      </div>

      {/* Desktop: section header row — chỉ render khi có link, ẩn < md */}
      {viewAllHref && (
        <div className="hidden md:flex items-end justify-between gap-6 pb-4 mb-8 border-b border-border">
          <div>
            <p className="bb-kicker">Đối tác</p>
            <h2 className="bb-section-title m-0">Thương hiệu</h2>
          </div>
          <Link
            href={viewAllHref}
            className="flex shrink-0 items-center gap-1 pb-0.5 text-sm font-medium text-muted-foreground hover:text-brand transition-colors"
          >
            Xem tất cả
            <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Mobile grid (ẩn ≥ md) */}
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

    </div>
  );
}
