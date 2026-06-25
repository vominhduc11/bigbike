"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * React thay thế các hành vi tương tác mà `home.min.js` (jQuery) từng đảm nhiệm trên
 * markup WP thuần — giữ NGUYÊN DOM/class/CSS nên giao diện bất biến. Chỉ port các hành
 * vi CÒN SỐNG (đã dò DOM thực tế: e2e/wp-interactions.e2e.ts là hợp đồng 1:1):
 *
 *  1. Header đổi nền khi cuộn   → toggle `headroom--not-top` trên <header> khi scrollY>0.
 *  2. Cuộn lên đầu trang        → click `.scrollToTop` → cuộn mượt về 0.
 *  3. Menu mobile               → click `.hammer-menu-mb` → toggle `.active` (nút + nav).
 *  4. Accordion submenu mobile  → mỗi `.menu-item-has-children` có `.arrow`; click → mở/đóng `.sub-menu`.
 *  5. Drawer liên hệ            → `.hammer-menu-desktop` mở / `.information-slide-bigbike .close` đóng.
 *  6. Accordion `.toggle--item` → click `.toggle--item-title` → mở/đóng phần kế.
 *  7. Sticky bộ lọc PLP         → `.product-list-filter` position:sticky top 80 (thay polyfill cũ).
 *  8. Đóng dropdown desktop     → bấm link trong `.header-nav` → gắn `.bb-nav-hover-off`
 *     lên mục vừa bấm (gỡ khi chuột rời) để dropdown không kẹt mở sau điều hướng SPA.
 *
 * Hành vi DEAD (selector không còn khớp sau khi React thay markup) được bỏ: +/- số lượng,
 * mua nhanh, chia sẻ FB/Twitter, vẽ sao `.rating-star`, select2, nút tìm kiếm header
 * (SearchToggle React đã thay). Tab PDP & "xem thêm" bộ lọc do React tự quản.
 *
 * Click dùng event-delegation trên document để bền qua điều hướng SPA; phần phụ thuộc
 * DOM của từng route (chèn `.arrow`, gán sticky) chạy lại mỗi khi đổi `pathname`.
 */

const PREFERS_REDUCED = "(prefers-reduced-motion: reduce)";

function slide(el: HTMLElement, show: boolean) {
  const reduce = window.matchMedia?.(PREFERS_REDUCED).matches;
  if (reduce) {
    el.style.display = show ? "block" : "none";
    el.style.height = "";
    return;
  }
  el.style.overflow = "hidden";
  const full = (() => {
    const prevDisplay = el.style.display;
    el.style.display = "block";
    const h = el.scrollHeight;
    if (!show) return h;
    el.style.display = prevDisplay;
    return h;
  })();
  if (show) {
    el.style.display = "block";
    el.style.height = "0px";
    requestAnimationFrame(() => {
      el.style.transition = "height 300ms ease";
      el.style.height = `${full}px`;
    });
    window.setTimeout(() => {
      el.style.transition = "";
      el.style.height = "";
      el.style.overflow = "";
    }, 320);
  } else {
    el.style.height = `${full}px`;
    requestAnimationFrame(() => {
      el.style.transition = "height 300ms ease";
      el.style.height = "0px";
    });
    window.setTimeout(() => {
      el.style.transition = "";
      el.style.display = "none";
      el.style.height = "";
      el.style.overflow = "";
    }, 320);
  }
}

function isHidden(el: HTMLElement) {
  return el.style.display === "none" || getComputedStyle(el).display === "none";
}

export function WpThemeInteractions() {
  const pathname = usePathname();

  // Hành vi gắn 1 lần (delegation + scroll) — bền qua điều hướng SPA.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      if (!target) return;

      // 3. Hamburger mobile: toggle .active trên nút + header .navigation.
      const burger = target.closest(".hammer-menu-mb");
      if (burger) {
        burger.classList.toggle("active");
        const nav = document.querySelector("header .navigation");
        if (nav) {
          nav.classList.toggle("active");
          nav.classList.remove("hidden");
        }
        const isOpen = burger.classList.contains("active");
        document.body.style.overflow = isOpen ? "hidden" : "";
        document.documentElement.style.overflow = isOpen ? "hidden" : "";
        return;
      }

      // 4. Mũi tên submenu mobile: toggle .active của mục + trượt .sub-menu.
      const arrow = target.closest(".arrow");
      if (arrow && arrow.parentElement?.classList.contains("menu-item-has-children")) {
        const item = arrow.parentElement;
        item.classList.toggle("active");
        const sub = item.querySelector(":scope > .sub-menu") as HTMLElement | null;
        if (sub) slide(sub, item.classList.contains("active"));
        return;
      }

      // 5a. Mở drawer liên hệ (nút desktop).
      if (target.closest(".hammer-menu-desktop")) {
        const drawer = document.querySelector(".information-slide-bigbike") as HTMLElement | null;
        if (drawer) {
          drawer.style.display = "block";
          window.setTimeout(() => drawer.classList.add("animation"), 300);
        }
        return;
      }

      // 5b. Đóng drawer liên hệ.
      if (target.closest(".information-slide-bigbike .close")) {
        const drawer = document.querySelector(".information-slide-bigbike") as HTMLElement | null;
        if (drawer) {
          drawer.classList.remove("animation");
          window.setTimeout(() => {
            drawer.style.display = "none";
          }, 300);
        }
        return;
      }

      // 6. Accordion `.toggle--item`: toggle .active của title + trượt phần kế.
      const title = target.closest(".toggle--item .toggle--item-title");
      if (title) {
        title.classList.toggle("active");
        const next = title.nextElementSibling as HTMLElement | null;
        if (next) slide(next, title.classList.contains("active"));
        return;
      }

      // 2. Cuộn lên đầu trang.
      if (target.closest(".scrollToTop")) {
        const reduce = window.matchMedia?.(PREFERS_REDUCED).matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        return;
      }

      // 8. Desktop: bấm link trong menu ngang → tắt dropdown hover của mục vừa bấm.
      // Điều hướng SPA không tải lại trang nên chuột còn nằm trên mục, `:hover` vẫn
      // đúng → dropdown kẹt mở. Gắn `.bb-nav-hover-off` ép ẩn cho tới khi chuột rời
      // mục (mục khác hover bình thường). CSS suppress chỉ tồn tại trong @media desktop
      // nên trên mobile (.sub-menu dùng .active, không hover) class này vô hại.
      const navLink = target.closest("header .navigation .header-nav a");
      if (navLink) {
        const item = navLink.closest(".navigation--item");
        if (item) {
          item.classList.add("bb-nav-hover-off");
          item.addEventListener(
            "mouseleave",
            () => item.classList.remove("bb-nav-hover-off"),
            { once: true },
          );
        }
      }
    }

    // 1. Header đổi nền khi cuộn.
    function onScroll() {
      const header = document.querySelector("header");
      if (!header) return;
      if (window.scrollY > 0) header.classList.add("headroom--not-top");
      else header.classList.remove("headroom--not-top");
    }

    document.addEventListener("click", onClick);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Đổi route SPA: nếu drawer liên hệ còn mở từ trang trước thì đóng (đồng bộ như reload).
  // (Mũi tên submenu `.arrow` + sticky `.product-list-filter` được render thẳng trong
  // markup React — KHÔNG mutate DOM React quản bằng JS để tránh lệch hydration.)
  useEffect(() => {
    const drawer = document.querySelector(".information-slide-bigbike") as HTMLElement | null;
    if (drawer && !isHidden(drawer)) {
      drawer.classList.remove("animation");
      drawer.style.display = "none";
    }
  }, [pathname]);

  return null;
}
