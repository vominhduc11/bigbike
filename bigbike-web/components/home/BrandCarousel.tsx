"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import { useLocale } from "next-intl";
import Link from "@/i18n/StorefrontLink";
import "swiper/css";
import type { Brand } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { toBrandPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { Container } from "@/components/layout/Container";
import { BrandLogo } from "@/components/catalog/BrandLogo";

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
  // Đường dẫn phải đi qua toBrandPath: helper tự thêm dấu "/" cuối (next.config
  // đặt trailingSlash: true) và tự gắn tiền tố /en cho bản tiếng Anh. Viết tay
  // `/brands/${slug}` như trước làm mỗi cú bấm tốn thêm một nhịp 308 và đẩy khách
  // EN sang trang tiếng Việt.
  const locale = useLocale() as Locale;
  if (brands.length === 0) return null;
  const hasMultipleBrands = brands.length > 1;

  return (
    <section data-home-brand-carousel className="py-15">
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
          autoplay={
            hasMultipleBrands
              ? { delay: 3000, disableOnInteraction: false, pauseOnMouseEnter: true }
              : undefined
          }
          watchOverflow
          breakpoints={{
            767: { slidesPerView: 5, spaceBetween: 40 },
          }}
        >
          {brands.map((b) => {
            // Logo từ MinIO (same-origin), không hotlink web cũ (AGENTS.md §14.3).
            const logo = resolveMediaUrl(b.logo?.url?.trim());
            const image = logo && b.logo ? { ...b.logo, url: logo } : null;
            return (
              <SwiperSlide className="swiper-slide" key={b.id}>
                <Link
                  href={toBrandPath(b.slug, locale)}
                  className="flex h-22 min-[992px]:h-32 items-center justify-center"
                >
                  <BrandLogo name={b.name} image={image} variant="home" />
                </Link>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </Container>
    </section>
  );
}
