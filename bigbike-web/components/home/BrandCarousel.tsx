"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import Link from "next/link";
import "swiper/css";
import type { Brand } from "@/lib/contracts/public";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";

type Props = { brands: Brand[] };

/**
 * Section "thương hiệu" của trang chủ (partner-slide).
 *
 * Trước đây dải logo này là markup WP thô được khởi tạo bởi home.min.js — script
 * chỉ chạy MỘT lần lúc tải nguyên trang (DOMContentLoaded). Khi điều hướng nội bộ
 * (chuyển trang rồi quay lại) script không chạy lại → Swiper không init → logo bung
 * to ra giữa khoảng trắng, phải F5 mới hết. Dựng qua Swiper React để vòng đời React
 * tự init mỗi lần mount, sống sót qua client navigation — giống ExperienceCarousel /
 * HomeVideoCarousel trên cùng trang.
 *
 * Class wrapper (`partner-slide` / `container` / `swiper-container`) và cấu hình
 * (speed/slidesPerView/spaceBetween/breakpoints) giữ ĐÚNG bản WP gốc để không lệch
 * giao diện so với khi reload.
 */
export function BrandCarousel({ brands }: Props) {
  if (brands.length === 0) return null;

  return (
    <div className="partner-slide pt-120 pb-120">
      <div className="container">
        <Swiper
          // KHÔNG đặt `swiper-container`: home.min.js `partnerSlide()` gọi
          // `new Swiper(".partner-slide .swiper-container")` → double-init đè lên Swiper
          // React trên reload home. Swiper React tự render class `.swiper` + style từ
          // `swiper/css`, không cần class WP cũ nên giao diện giữ nguyên.
          speed={1000}
          slidesPerView={2}
          spaceBetween={13}
          watchOverflow
          breakpoints={{
            767: { slidesPerView: 5, spaceBetween: 40 },
          }}
        >
          {brands.map((b) => {
            const logo = toLegacyWpMediaUrl(resolveMediaUrl(b.logo?.url?.trim()));
            return (
              <SwiperSlide className="swiper-slide" key={b.id}>
                <Link href={`/brands/${b.slug}`}>
                  {/* Logo tải trực tiếp — thiếu logo thì dùng placeholder dùng chung. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo ?? "/wp/logo-1.png"} alt={b.name} width={1} height={1} />
                </Link>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>
    </div>
  );
}
