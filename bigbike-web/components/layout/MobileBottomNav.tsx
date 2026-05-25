"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Grid2X2, Search, ShoppingCart, User } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { toHomePath, toCartPath, toAccountPath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { cartCount } = useCart();
  const { openPanel, isPanelOpen } = useHeaderUi();

  function isHomeActive() {
    return pathname === "/" || pathname === "";
  }

  function tabClass(active: boolean) {
    return cn(
      "flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[44px] px-1 relative",
      active ? "text-brand" : "text-muted-foreground",
    );
  }

  function ActiveBar() {
    return <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-brand" />;
  }

  const badge = cartCount != null && cartCount > 0 ? cartCount : null;
  const searchActive = isPanelOpen("search");
  const menuActive = isPanelOpen("mobile-menu");
  const homeActive = isHomeActive();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface-dark/[0.94] backdrop-blur-md border-t border-border"
      style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      aria-label="Điều hướng chính"
    >
      <div className="flex justify-around px-1 pt-1.5 pb-1">
        {/* Trang chủ */}
        <Link
          href={toHomePath()}
          className={tabClass(homeActive)}
          aria-current={homeActive ? "page" : undefined}
        >
          {homeActive && <ActiveBar />}
          <Home size={22} />
          <span className={cn("text-[10px] leading-none", homeActive ? "font-semibold" : "font-medium")}>
            Trang chủ
          </span>
        </Link>

        {/* Danh mục */}
        <button
          onClick={() => openPanel("mobile-menu")}
          className={tabClass(menuActive)}
          aria-pressed={menuActive}
          type="button"
        >
          {menuActive && <ActiveBar />}
          <Grid2X2 size={22} />
          <span className={cn("text-[10px] leading-none", menuActive ? "font-semibold" : "font-medium")}>
            Danh mục
          </span>
        </button>

        {/* Tìm kiếm */}
        <button
          onClick={() => openPanel("search")}
          className={tabClass(searchActive)}
          aria-pressed={searchActive}
          type="button"
        >
          {searchActive && <ActiveBar />}
          <Search size={22} />
          <span className={cn("text-[10px] leading-none", searchActive ? "font-semibold" : "font-medium")}>
            Tìm kiếm
          </span>
        </button>

        {/* Giỏ hàng */}
        <Link
          href={toCartPath()}
          className={tabClass(pathname.startsWith("/gio-hang"))}
          aria-current={pathname.startsWith("/gio-hang") ? "page" : undefined}
        >
          {pathname.startsWith("/gio-hang") && <ActiveBar />}
          <div className="relative">
            <ShoppingCart size={22} />
            {badge != null && (
              <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand text-white font-bold text-[9px] leading-4 text-center border-2 border-[#141414]">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </div>
          <span className={cn("text-[10px] leading-none", pathname.startsWith("/gio-hang") ? "font-semibold" : "font-medium")}>
            Giỏ hàng
          </span>
        </Link>

        {/* Tài khoản */}
        <Link
          href={toAccountPath()}
          className={tabClass(pathname.startsWith("/tai-khoan"))}
          aria-current={pathname.startsWith("/tai-khoan") ? "page" : undefined}
        >
          {pathname.startsWith("/tai-khoan") && <ActiveBar />}
          <User size={22} />
          <span className={cn("text-[10px] leading-none", pathname.startsWith("/tai-khoan") ? "font-semibold" : "font-medium")}>
            Tài khoản
          </span>
        </Link>
      </div>
    </nav>
  );
}
