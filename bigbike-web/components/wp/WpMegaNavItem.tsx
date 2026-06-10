"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MegaMenu, type HeaderNavNode } from "@/components/layout/HeaderNavItem";
import { normalizeMenuUrl } from "@/lib/utils/nav";

const EXIT_MS = 200;
const CLOSE_DELAY_MS = 120;

/**
 * Item điều hướng cấp 1 của WP header có submenu (chỉ "Tất cả sản phẩm") —
 * desktop (≥1261px) hiện MEGA MENU (tái dùng <MegaMenu> của SiteHeader) khi hover
 * thay cho dropdown .sub-menu hẹp gốc; ≤1260px giữ nguyên markup .sub-menu lồng
 * (children) để off-canvas/hamburger của theme WP hoạt động như cũ.
 *
 * <li> giữ đúng class WP (.navigation--item.menu-item.menu-item-has-children) nên
 * trông giống hệt các item khác (chữ trắng, hover đỏ, kim cương đỏ). Marker
 * .bb-has-mega để globals.css ẩn .sub-menu hẹp trên desktop.
 */
export function WpMegaNavItem({
  node,
  children,
}: {
  node: HeaderNavNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const href = normalizeMenuUrl(node.url) || "/";
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathnameRef = useRef(pathname);
  const menuId = useId();

  const clearTimers = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (exitTimer.current) { clearTimeout(exitTimer.current); exitTimer.current = null; }
  }, []);

  const openMenu = useCallback(() => {
    clearTimers();
    setOpen(true);
    setMounted(true);
    requestAnimationFrame(() => setVisible(true));
  }, [clearTimers]);

  const closeMenu = useCallback(() => {
    clearTimers();
    setOpen(false);
    setVisible(false);
    exitTimer.current = setTimeout(() => setMounted(false), EXIT_MS);
  }, [clearTimers]);

  const scheduleClose = useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setVisible(false);
      exitTimer.current = setTimeout(() => setMounted(false), EXIT_MS);
    }, CLOSE_DELAY_MS);
  }, [clearTimers]);

  // Đổi route → đóng menu ngay (guard ref để không setState lúc mount).
  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    clearTimers();
    setOpen(false);
    setVisible(false);
    setMounted(false);
  }, [pathname, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <li
      className="navigation--item menu-item menu-item-has-children bb-has-mega"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <Link
        href={href}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        {node.label}
      </Link>

      {/* ≤1260px: .sub-menu lồng của WP cho drawer off-canvas (desktop ẩn qua CSS). */}
      {children}

      {/* ≥1261px: mega menu. max-[1260px]:hidden để không lộ panel trên mobile. */}
      {mounted && (
        <div className="max-[1260px]:hidden">
          <MegaMenu
            id={menuId}
            node={node}
            visible={visible}
            onItemClick={closeMenu}
            pathname={pathname}
          />
        </div>
      )}
    </li>
  );
}
