"use client";

import Script from "next/script";

/**
 * Bundle JS của theme WP — jQuery + Swiper + headroom + lozad + init
 * swiper/menu/search/scrollToTop/rating. Đây là script CHUNG của theme: bản WP
 * gốc enqueue ở MỌI trang, nên ở đây nạp cho mọi route WP (qua layout) chứ không
 * chỉ trang chủ — nếu chỉ nạp ở trang chủ thì header (hamburger, drawer
 * information-slide, sticky headroom, scrollToTop) sẽ "chết" trên các trang khác.
 * home.min.js tự chứa jQuery nên không cần nạp riêng. obj_ajax là global mà theme
 * tham chiếu (header inline gốc).
 */
export function WpThemeScripts() {
  return (
    <>
      <Script id="wp-obj-ajax" strategy="afterInteractive">
        {`window.obj_ajax = window.obj_ajax || { ajaxurl: "" };`}
      </Script>
      <Script
        src="/wp-content/themes/bigbike/dist/home.min.js?ver=202404231"
        strategy="afterInteractive"
      />
    </>
  );
}
