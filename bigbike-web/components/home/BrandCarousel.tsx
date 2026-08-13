"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import Link from "@/i18n/StorefrontLink";
import "swiper/css";
import type { Brand } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { Container } from "@/components/layout/Container";

type Props = { brands: Brand[] };

/**
 * Section "thương hiệu" của trang chủ.
 *
 * Trước đây dải logo này là markup WP thô được khởi tạo bởi home.min.js — script
 * chỉ chạy MỘT lần lúc tải nguyên trang (DOMContentLoaded). Khi điều hướng nội bộ
 * (chuyển trang rồi quay lại) script không chạy lại → Swiper không init → logo bung
 * to ra giữa khoảng trắng, phải F5 mới hết. Dựng qua Swiper React để vòng đời React
 * tự init mỗi lần mount, sống sót qua client navigation — giống ExperienceCarousel /
 * HomeVideoCarousel trên cùng trang.
 *
 * Class wrapper (`container` / `swiper-container`) và cấu hình
 * (speed/slidesPerView/spaceBetween/breakpoints) giữ ĐÚNG bản WP gốc để không lệch
 * giao diện so với khi reload.
 *
 * Căn logo: không dựa vào CSS `.bb-home .partner-slide` cũ trong globals.css —
 * `bb-home`/`partner-slide` không còn được gắn vào markup thật (chỉ còn ở skeleton
 * loading) nên các rule đó đã chết; hậu quả là mỗi ảnh logo hiển thị đúng kích thước
 * gốc của file (rất lệch nhau) và top-align trong khung cao bằng logo cao nhất, nhìn
 * lệch dòng. Mỗi logo giờ nằm trong khung cao cố định, canh giữa cả 2 chiều ngay tại
 * component để không phụ thuộc CSS chết.
 */
export function BrandCarousel({ brands }: Props) {
  if (brands.length === 0) return null;
  const hasMultipleBrands = brands.length > 1;

  return (
    <section className="py-30">
      <Container>
        <Swiper
          // KHÔNG đặt `swiper-container`: home.min.js `partnerSlide()` gọi
          // `new Swiper(".partner-slide .swiper-container")` → double-init đè lên Swiper
          // React trên reload home. Swiper React tự render class `.swiper` + style từ
          // `swiper/css`, không cần class WP cũ nên giao diện giữ nguyên.
          //
          // PRE-INIT GUARD: trước khi `.swiper-initialized` được thêm, mỗi slide
          // width:100% → 1 logo phình bằng cả khung rồi nhảy thành dải khi JS chạy.
          // Khoá bề rộng slide khớp slidesPerView (2 / 767:5) tới khi init.
          className="[&:not(.swiper-initialized)_.swiper-slide]:!w-1/2 min-[767px]:[&:not(.swiper-initialized)_.swiper-slide]:!w-1/5"
          // Tự chuyển logo mỗi 3 giây và quay lại logo đầu khi đi hết danh sách.
          modules={hasMultipleBrands ? [Autoplay] : []}
          speed={1000}
          slidesPerView={2}
          spaceBetween={13}
          rewind={hasMultipleBrands}
          autoplay={hasMultipleBrands ? { delay: 3000, disableOnInteraction: false, pauseOnMouseEnter: true } : undefined}
          watchOverflow
          breakpoints={{
            767: { slidesPerView: 5, spaceBetween: 40 },
          }}
        >
          {brands.map((b) => {
            // Logo từ MinIO (same-origin), không hotlink web cũ (AGENTS.md §14.3).
            const logo = resolveMediaUrl(b.logo?.url?.trim());
            return (
              <SwiperSlide className="swiper-slide" key={b.id}>
                <Link href={`/brands/${b.slug}`} className="flex h-32 items-center justify-center">
                  {/* Logo tải trực tiếp — thiếu logo thì dùng placeholder dùng chung. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo ?? "/wp/logo-1.png"} alt={b.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                </Link>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </Container>
    </section>
  );
}
