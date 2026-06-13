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
      {/*
        home.min.js (bundle theme WP) gọi $(".product-list-filter").sticky({topSpacing:80})
        trong layoutFront, nhưng plugin jquery.sticky KHÔNG được gộp vào dist →
        "$(...).sticky is not a function". Throw này cắt đứt phần còn lại của layoutFront
        (scroll → headroom--not-top, sideBarToggle, wooTabs) trên mọi trang archive.
        Cài plugin tối thiểu bằng position:sticky native NGAY khi bundle gán window.jQuery
        (đồng bộ, trước microtask ready) để layoutFront chạy trọn. Script inline này không
        fetch nên luôn chạy trước home.min.js (tải qua mạng).
      */}
      <Script id="wp-jq-sticky-polyfill" strategy="afterInteractive">
        {`(function(){
  function install(jq){
    if (jq && jq.fn && typeof jq.fn.sticky !== "function") {
      jq.fn.sticky = function(opts){
        var top = (opts && opts.topSpacing) || 0;
        return this.each(function(){
          this.style.position = "sticky";
          this.style.top = top + "px";
          if (!this.style.zIndex) this.style.zIndex = "20";
        });
      };
    }
    return jq;
  }
  if (window.jQuery) { install(window.jQuery); return; }
  var stored;
  try {
    Object.defineProperty(window, "jQuery", {
      configurable: true,
      get: function(){ return stored; },
      set: function(v){ stored = install(v); }
    });
  } catch (e) {}
})();`}
      </Script>
      <Script
        src="/wp-content/themes/bigbike/dist/home.min.js?ver=202404231"
        strategy="afterInteractive"
      />
    </>
  );
}
