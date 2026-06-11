"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Đóng off-canvas menu mobile của WP header.
 *
 * Theme WP gốc mở menu bằng cách thêm class `.active` vào `header .navigation`
 * (home.min.js, qua nút hamburger) và dựa vào việc TẢI LẠI TRANG khi bấm vào một
 * mục để reset trạng thái. Với điều hướng SPA của Next, trang đổi nhưng class
 * `.active` vẫn còn → menu kẹt mở sau khi bấm. Component này:
 *  1. Bắt click lên link trong menu → đóng ngay (kể cả khi điều hướng tới chính
 *     trang đang đứng, lúc đó pathname không đổi). Bỏ qua `.arrow` (toggle submenu).
 *  2. Pathname đổi → đóng (lưới an toàn cho mọi cách đổi route khác).
 */
export function WpMobileMenuController() {
  const pathname = usePathname();
  const prevPath = useRef(pathname);

  function closeMenu() {
    document
      .querySelectorAll(
        "header .navigation.active, header .user-control--item.hammer-menu.active",
      )
      .forEach((el) => el.classList.remove("active"));
  }

  useEffect(() => {
    const nav = document.querySelector("header .navigation");
    if (!nav) return;
    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a");
      // Chỉ đóng khi bấm vào link điều hướng; bấm vào .arrow chỉ mở/thu submenu.
      if (!link || target?.closest(".arrow") || !nav.contains(link)) return;
      closeMenu();
    };
    nav.addEventListener("click", onClick);
    return () => nav.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    closeMenu();
  }, [pathname]);

  return null;
}
